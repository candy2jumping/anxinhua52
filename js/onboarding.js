/* ============================================================
 * 安心花 · 首次使用引导（Onboarding）
 * 正式模式首次打开：绝不自动写入任何示例数据。
 * 用户逐步录入：账户 → 资金属性 → 预算 → 补给规则 → 存钱目标（可跳过）
 * 示例数据只能通过独立"体验示例"入口加载。
 * ============================================================ */

const C3 = window.Calc;
const X3 = window.UIX;

let OB = { step: 1, accounts: [], goals: [] };

function startOnboarding() {
  OB = { step: 1, accounts: [], goals: [] };
  document.getElementById('modal-onboarding').classList.remove('hidden');
  showOb();
}

function closeOb() {
  document.getElementById('modal-onboarding').classList.add('hidden');
}

/* ---------- 各步骤渲染 ---------- */
function showOb() {
  const title = document.getElementById('ob-title');
  const body = document.getElementById('ob-content');
  const foot = document.getElementById('ob-foot');

  if (OB.step === 1) {
    title.textContent = `① 设置账户`;
    body.innerHTML = `
      <div class="ob-progress"><div class="ob-bar" style="width:25%"></div></div>
      <p class="ob-desc">先把你真实在用的钱袋子加进来。之后可以随时增删。</p>
      ${OB.accounts.length ? OB.accounts.map((a, i) => `
        <div class="manage-row">
          <div class="mr-emoji">${a.emoji}</div>
          <div class="mr-main">
            <div class="mr-name">${X3.escapeHtml(a.name)}</div>
            <div class="mr-sub">${kindLabel(a.kind)} · ${money(a.initialBalance)}</div>
          </div>
          <div class="mr-del" onclick="obRemoveAccount(${i})">✕</div>
        </div>`).join('') : '<div class="empty-hint">还没有账户，点下面添加</div>'}
      <button class="add-row" onclick="obAddAccount()">＋ 添加账户</button>
      <div class="hint-card">
        建议先加：微信、支付宝、银行卡、现金。至少加 1 个才能继续。
      </div>`;
    foot.innerHTML = `
      <button class="ob-btn ghost" onclick="obLoadDemo()">先体验示例数据</button>
      <button class="ob-btn primary" onclick="obNext(2)">下一步 →</button>`;
  }

  else if (OB.step === 2) {
    const s = App.state;
    const total = C3.monthBudgetTotal(s);
    title.textContent = `② 设置本月预算`;
    body.innerHTML = `
      <div class="ob-progress"><div class="ob-bar" style="width:50%"></div></div>
      <p class="ob-desc">给每个分类定个上限。不知道填多少就先用推荐值，以后随时改。</p>
      <div class="card" style="padding:14px">
        <div class="section-head"><span>本月总预算</span><span class="more">${money(total)}</span></div>
        <div class="cat-list">
          ${C3.activeCats(s, 'out').map((c) => `
            <div class="cat-row" onclick="obEditCatBudget('${c.id}')">
              <div class="cat-emoji">${c.emoji}</div>
              <div class="cat-info"><div class="cat-name">${X3.escapeHtml(c.name)}</div></div>
              <div class="cat-today"><div class="cat-today-val">${money(c.budget)}</div></div>
            </div>`).join('')}
        </div>
      </div>
      <button class="add-row" onclick="obResetBudget()">全部清零，自己填</button>`;
    foot.innerHTML = `
      <button class="ob-btn ghost" onclick="obPrev(1)">← 上一步</button>
      <button class="ob-btn primary" onclick="obNext(3)">下一步 →</button>`;
  }

  else if (OB.step === 3) {
    const s = App.state;
    const next = s.cycle.nextSupplyDate || C3.todayStr();
    title.textContent = `③ 补给与消费规则`;
    body.innerHTML = `
      <div class="ob-progress"><div class="ob-bar" style="width:75%"></div></div>
      <p class="ob-desc">这决定了「今天还能安心花多少」怎么算。</p>
      <div class="card" style="padding:14px">
        <div class="ob-field" onclick="obEditCycle()">
          <span class="ob-fl">下一次允许补给日期</span>
          <span class="ob-fv">${next} ›</span>
        </div>
        <div class="ob-field" onclick="obEditCycle()">
          <span class="ob-fl">必须预留生活费</span>
          <span class="ob-fv">${money(s.cycle.reserveAmount)} ›</span>
        </div>
        <div class="ob-field" onclick="obEditCycle()">
          <span class="ob-fl">计划补给金额（仅预测）</span>
          <span class="ob-fv">${money(s.cycle.supplyAmount)} ›</span>
        </div>
        <div class="ob-field" onclick="obEditCycle()">
          <span class="ob-fl">备用可动纳入安心花</span>
          <span class="ob-fv">${s.cycle.bufferIncluded ? '纳入' : '不纳入（推荐）'} ›</span>
        </div>
      </div>
      <div class="hint-card">
        <strong>预留生活费</strong>是底线，安心花会把它先扣掉再摊到每天。<br>
        <strong>锁定储蓄</strong>永远不计入，不用在这里设置。
      </div>`;
    foot.innerHTML = `
      <button class="ob-btn ghost" onclick="obPrev(2)">← 上一步</button>
      <button class="ob-btn primary" onclick="obNext(4)">下一步 →</button>`;
  }

  else if (OB.step === 4) {
    title.textContent = `④ 存钱目标（可跳过）`;
    body.innerHTML = `
      <div class="ob-progress"><div class="ob-bar" style="width:100%"></div></div>
      <p class="ob-desc">想存钱就设个目标，不想现在设可以直接跳过。</p>
      ${OB.goals.length ? OB.goals.map((g, i) => `
        <div class="manage-row">
          <div class="mr-emoji">${g.emoji}</div>
          <div class="mr-main">
            <div class="mr-name">${X3.escapeHtml(g.name)}</div>
            <div class="mr-sub">目标 ${money(g.target)} · 本月计划 ${money(g.monthTarget)}</div>
          </div>
          <div class="mr-del" onclick="obRemoveGoal(${i})">✕</div>
        </div>`).join('') : '<div class="empty-hint">还没有目标</div>'}
      <button class="add-row" onclick="obAddGoal()">＋ 添加存钱目标</button>`;
    foot.innerHTML = `
      <button class="ob-btn ghost" onclick="obFinish(true)">跳过</button>
      <button class="ob-btn primary" onclick="obFinish(false)">完成，开始记账 🌱</button>`;
  }
}

/* ---------- 步骤流转 ---------- */
function obNext(step) {
  if (step === 2 && OB.step === 1) {
    if (!OB.accounts.length) { X3.appToast('至少添加 1 个账户', 'error'); return; }
    App.state.accounts = OB.accounts.map((a) => ({
      id: 'a_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      name: a.name, emoji: a.emoji, initialBalance: a.initialBalance, kind: a.kind, archived: false,
    }));
  }
  if (step === 3 && OB.step === 2) {
    if (!App.state.cycle.nextSupplyDate) {
      const d = C3.now(); d.setDate(d.getDate() + 30);
      App.state.cycle.nextSupplyDate = C3.fmtDate(d);
    }
  }
  OB.step = step;
  showOb();
}
function obPrev(step) { OB.step = step; showOb(); }

/* ---------- 账户 ---------- */
function obAddAccount() {
  X3.appForm({
    title: '添加账户',
    fields: [
      { name: 'name', label: '账户名称', value: '', placeholder: '如：微信' },
      { name: 'emoji', label: '图标 emoji', value: '💳' },
      { name: 'initialBalance', label: '当前余额（元）', value: '0', type: 'number' },
      { name: 'kind', label: '资金属性', value: 'daily', type: 'choice', options: [
        { value: 'daily', label: '💚 日常可用' },
        { value: 'buffer', label: '🔶 备用可动' },
        { value: 'locked', label: '🔒 锁定储蓄' },
      ] },
    ],
    onConfirm: (r) => {
      if (!r || !r.name) return;
      OB.accounts.push({
        name: r.name, emoji: r.emoji || '💳',
        initialBalance: parseFloat(r.initialBalance) || 0, kind: r.kind || 'daily',
      });
      showOb();
    }
  });
}
function obRemoveAccount(i) { OB.accounts.splice(i, 1); showOb(); }

/* ---------- 预算 ---------- */
function obEditCatBudget(catId) {
  const c = (App.state.cats || []).find((x) => x.id === catId);
  if (!c) return;
  X3.appPrompt({
    title: c.name + ' 本月预算', label: '单位：元', value: c.budget, type: 'number',
    onConfirm: (v) => {
      if (v === null) return;
      c.budget = parseFloat(v) || 0;
      showOb();
    }
  });
}
function obResetBudget() {
  C3.activeCats(App.state, 'out').forEach((c) => { c.budget = 0; });
  showOb();
}

/* ---------- 补给规则 ---------- */
function obEditCycle() {
  const s = App.state;
  X3.appForm({
    title: '补给与消费规则',
    fields: [
      { name: 'nextSupplyDate', label: '下一次允许补给日期', value: s.cycle.nextSupplyDate || C3.todayStr(), type: 'date' },
      { name: 'reserveAmount', label: '必须预留生活费（元）', value: s.cycle.reserveAmount, type: 'number' },
      { name: 'supplyAmount', label: '计划补给金额（元，仅预测）', value: s.cycle.supplyAmount, type: 'number' },
      { name: 'bufferIncluded', label: '备用可动纳入安心花', value: s.cycle.bufferIncluded ? 'yes' : 'no', type: 'choice',
        options: [{ value: 'no', label: '不纳入（推荐）' }, { value: 'yes', label: '纳入' }] },
    ],
    onConfirm: (r) => {
      if (!r) return;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(r.nextSupplyDate)) { X3.appToast('日期格式不对', 'error'); return; }
      s.cycle = {
        nextSupplyDate: r.nextSupplyDate,
        reserveAmount: parseFloat(r.reserveAmount) || 0,
        supplyAmount: parseFloat(r.supplyAmount) || 0,
        bufferIncluded: r.bufferIncluded === 'yes',
      };
      showOb();
    }
  });
}

/* ---------- 存钱目标 ---------- */
function obAddGoal() {
  X3.appForm({
    title: '添加存钱目标',
    fields: [
      { name: 'name', label: '目标名', value: '', placeholder: '如：换新手机' },
      { name: 'emoji', label: '图标 emoji', value: '🌟' },
      { name: 'target', label: '总额度（元）', value: '1000', type: 'number' },
      { name: 'monthTarget', label: '本月计划存（元）', value: '100', type: 'number' },
    ],
    onConfirm: (r) => {
      if (!r || !r.name) return;
      OB.goals.push({
        name: r.name, emoji: r.emoji || '🌟',
        target: parseFloat(r.target) || 0, monthTarget: parseFloat(r.monthTarget) || 0, saved: 0,
      });
      showOb();
    }
  });
}
function obRemoveGoal(i) { OB.goals.splice(i, 1); showOb(); }

/* ---------- 完成 ---------- */
async function obFinish(skip) {
  const s = App.state;
  if (!skip && OB.goals.length) {
    s.goals = OB.goals.map((g) => ({
      id: 'g_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      name: g.name, emoji: g.emoji, target: g.target, saved: g.saved || 0,
      monthTarget: g.monthTarget, archived: false,
    }));
  } else {
    s.goals = [];
  }
  if (!s.cycle.nextSupplyDate) {
    const d = C3.now(); d.setDate(d.getDate() + 30);
    s.cycle.nextSupplyDate = C3.fmtDate(d);
  }
  s.onboarded = true;
  s.mode = 'real';
  await Store.save(s);
  closeOb();
  X3.appToast('账本建好了，开始记账吧 🌱', 'success');
  window.UI.switchTab('home');
}

/* ---------- 体验示例数据 ---------- */
async function obLoadDemo() {
  X3.appConfirm({
    title: '加载示例数据',
    content: '会写入一套演示用的账户、账单和目标，方便你先熟悉界面。\n之后可在左上方 ☰ → 数据备份恢复 → 清空，重新开始真实记账。',
    confirmText: '加载示例',
    onConfirm: async () => {
      const demo = window.buildDemoState();
      App.state = demo;
      await Store.save(App.state);
      closeOb();
      X3.appToast('示例数据已加载', 'success');
      window.UI.switchTab('home');
    }
  });
}

window.Onboarding = { startOnboarding, closeOb, obNext, obPrev, obAddAccount, obRemoveAccount, obEditCatBudget, obResetBudget, obEditCycle, obAddGoal, obRemoveGoal, obFinish, obLoadDemo };
