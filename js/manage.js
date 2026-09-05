/* ============================================================
 * 安心花 · 管理模块
 * 账户管理 / 分类管理 / 账单 CRUD / 余额校准 / 各类详情弹窗
 * ============================================================ */

const C2 = window.Calc;
const X2 = window.UIX;

/* ============================================================
 *  一、账户管理
 * ============================================================ */
function openAccountManager() {
  closeDrawer();
  const s = App.state;
  const list = (s.accounts || []).map((a) => {
    const bal = C2.accountBalance(s, a.id);
    return `
      <div class="manage-row" onclick="editAccount('${a.id}')">
        <div class="mr-emoji">${a.emoji}</div>
        <div class="mr-main">
          <div class="mr-name">${X2.escapeHtml(a.name)}${a.archived ? ' <span class="tag-muted">已停用</span>' : ''}</div>
          <div class="mr-sub">${kindLabel(a.kind)} · 余额 ${money(bal)}</div>
        </div>
        <div class="mr-arrow">›</div>
      </div>`;
  }).join('');
  const box = document.getElementById('modal-manage-content');
  box.innerHTML = `
    <div class="card">
      <div class="section-head"><span>我的账户</span><span class="more">点账户编辑</span></div>
      ${list || '<div class="empty-hint">还没有账户</div>'}
      <button class="add-row" onclick="addAccount()">＋ 新增账户</button>
    </div>
    <div class="hint-card">
      <strong>💚 日常可用</strong>：100% 计入安心花<br>
      <strong>🔶 备用可动</strong>：默认不计入，可在「补给与消费规则」里决定是否纳入<br>
      <strong>🔒 锁定储蓄</strong>：绝对不计入安心花
    </div>`;
  document.getElementById('modal-manage-title').textContent = '💳 账户与资金属性';
  openView('manage');
}
function addAccount() {
  X2.appForm({
    title: '新增账户',
    fields: [
      { name: 'name', label: '账户名称', value: '', placeholder: '如：微信 / 招行卡' },
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
      App.state.accounts.push({
        id: 'a_' + Date.now(), name: r.name, emoji: r.emoji || '💳',
        initialBalance: parseFloat(r.initialBalance) || 0,
        kind: r.kind || 'daily', archived: false,
      });
      commit('已添加账户 ' + r.name).then(openAccountManager);
    }
  });
}
function editAccount(id) {
  const s = App.state;
  const a = (s.accounts || []).find((x) => x.id === id);
  if (!a) return;
  const hasBills = (s.bills || []).some((b) => b.accountId === id || b.toAccountId === id);
  X2.appForm({
    title: '编辑账户',
    fields: [
      { name: 'name', label: '账户名称', value: a.name },
      { name: 'emoji', label: '图标 emoji', value: a.emoji },
      { name: 'kind', label: '资金属性', value: a.kind, type: 'choice', options: [
        { value: 'daily', label: '💚 日常可用' },
        { value: 'buffer', label: '🔶 备用可动' },
        { value: 'locked', label: '🔒 锁定储蓄' },
      ] },
      { name: 'archived', label: '状态', value: a.archived ? 'yes' : 'no', type: 'choice', options: [
        { value: 'no', label: '启用' }, { value: 'yes', label: '停用' },
      ] },
    ],
    confirmText: '保存',
    onConfirm: (r) => {
      if (!r || !r.name) return;
      a.name = r.name; a.emoji = r.emoji || a.emoji; a.kind = r.kind || a.kind;
      a.archived = r.archived === 'yes';
      commit('已更新账户').then(() => {
        if (App.tab === 'home') renderHome();
        openAccountManager();
      });
    }
  });
  /* 提供余额校准与删除入口（表单之外） */
  setTimeout(() => {
    const acts = document.createElement('div');
    acts.className = 'app-modal-extra';
    acts.innerHTML = `
      <button class="extra-btn" data-act="adjust">⚖️ 余额校准</button>
      ${hasBills ? '<button class="extra-btn muted" data-act="archive">停用账户（有账单，不建议删除）</button>'
                 : '<button class="extra-btn danger" data-act="delete">删除账户</button>'}`;
    const card = document.querySelector('.app-modal-card');
    if (card && !card.querySelector('.app-modal-extra')) {
      card.insertBefore(acts, card.querySelector('.app-modal-actions'));
      acts.querySelectorAll('.extra-btn').forEach((b) => {
        b.onclick = () => {
          const act = b.dataset.act;
          document.querySelectorAll('.app-modal').forEach((m) => m.remove());
          if (act === 'adjust') openBalanceAdjust(id);
          else if (act === 'archive') {
            App.state.accounts.find((x) => x.id === id).archived = true;
            commit('账户已停用').then(openAccountManager);
          } else if (act === 'delete') {
            const used = (App.state.bills || []).some((bb) => bb.accountId === id || bb.toAccountId === id);
            if (used) { X2.appToast('该账户已有账单，只能停用', 'error'); return; }
            X2.appConfirm({
              title: '删除账户', content: '确定删除「' + a.name + '」？', danger: true, confirmText: '删除',
              onConfirm: () => {
                App.state.accounts = App.state.accounts.filter((x) => x.id !== id);
                commit('已删除账户').then(openAccountManager);
              }
            });
          }
        };
      });
    }
  }, 80);
}
/* 余额校准：不静默改余额，而是记一条校准账单，保证账实一致 */
function openBalanceAdjust(accountId) {
  const s = App.state;
  const a = (s.accounts || []).find((x) => x.id === accountId);
  if (!a) return;
  const computed = C2.accountBalance(s, accountId);
  X2.appPrompt({
    title: '余额校准 · ' + a.name,
    label: `系统算出的余额是 ${money(computed)}。请输入你实际看到的余额，差值会记成一条校准记录。`,
    value: computed, type: 'number',
    onConfirm: (v) => {
      if (v === null) return;
      const actual = parseFloat(v);
      if (isNaN(actual)) { X2.appToast('请输入数字', 'error'); return; }
      const delta = Math.round((actual - computed) * 100) / 100;
      if (Math.abs(delta) < 0.005) { X2.appToast('余额一致，无需校准', 'info'); return; }
      s.bills.push({
        id: 'b_' + Date.now(), date: C2.todayStr(), time: C2.currentTimeHHMM(),
        amount: Math.abs(delta), adjustDelta: delta, catId: 'misc',
        accountId: accountId, type: 'adjust',
        note: `余额校准 ${delta > 0 ? '+' : '-'}${money(Math.abs(delta))}`,
        createdAt: new Date().toISOString(),
      });
      commit('已记录校准 ' + (delta > 0 ? '+' : '-') + money(Math.abs(delta))).then(() => {
        if (App.tab === 'home') renderHome();
      });
    }
  });
}

/* ============================================================
 *  二、分类管理
 * ============================================================ */
function openCategoryManager() {
  closeDrawer();
  const s = App.state;
  const renderGroup = (kind) => {
    const cats = (s.cats || []).filter((c) => c.kind === kind)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    return cats.map((c, i) => {
      const up = i > 0
        ? `<button class="cat-move" onclick="event.stopPropagation();moveCat('${c.id}','up')">▲</button>`
        : '<span class="cat-move-ghost"></span>';
      const down = i < cats.length - 1
        ? `<button class="cat-move" onclick="event.stopPropagation();moveCat('${c.id}','down')">▼</button>`
        : '<span class="cat-move-ghost"></span>';
      const spent = C2.catMonthSpent(s, c.id);
      return `
        <div class="manage-row" onclick="editCategory('${c.id}')">
          <div class="mr-emoji">${c.emoji}</div>
          <div class="mr-main">
            <div class="mr-name">${X2.escapeHtml(c.name)}${c.archived ? ' <span class="tag-muted">已停用</span>' : ''}</div>
            <div class="mr-sub">${kind === 'out' ? '本月预算 ' + money(c.budget) + ' · 已花 ' + money(spent) : '收入分类'}</div>
            </div>
            <div class="cat-moves">${up}${down}</div>
            <div class="mr-arrow">≡</div>
        </div>`;
    }).join('') || '<div class="empty-hint">暂无</div>';
  };
  document.getElementById('modal-manage-content').innerHTML = `
    <div class="card">
      <div class="section-head"><span>支出分类</span><span class="more">点分类编辑</span></div>
      ${renderGroup('out')}
      <button class="add-row" onclick="addCategory('out')">＋ 新增支出分类</button>
    </div>
    <div class="card">
      <div class="section-head"><span>收入分类</span><span class="more">点分类编辑</span></div>
      ${renderGroup('in')}
      <button class="add-row" onclick="addCategory('in')">＋ 新增收入分类</button>
    </div>
    <div class="hint-card">
      已有账单的分类不会真正删除，只会<strong>停用</strong>，历史账单保持完整。
    </div>`;
  document.getElementById('modal-manage-title').textContent = '🏷️ 分类管理';
  openView('manage');
}
function addCategory(kind) {
  X2.appForm({
    title: '新增' + (kind === 'in' ? '收入' : '支出') + '分类',
    fields: [
      { name: 'name', label: '分类名', value: '', placeholder: '如：宠物用品' },
      { name: 'emoji', label: '图标 emoji', value: '✨' },
      ...(kind === 'out' ? [{ name: 'budget', label: '本月预算（元）', value: '0', type: 'number' }] : []),
    ],
    onConfirm: (r) => {
      if (!r || !r.name) return;
      App.state.cats.push({
        id: 'cat_' + Date.now(), name: r.name, emoji: r.emoji || '✨',
        budget: kind === 'out' ? (parseFloat(r.budget) || 0) : 0,
        kind, sortOrder: (App.state.cats || []).length, archived: false,
      });
      commit('已添加分类').then(openCategoryManager);
    }
  });
}
function editCategory(id) {
  const s = App.state;
  const c = (s.cats || []).find((x) => x.id === id);
  if (!c) return;
  const used = (s.bills || []).filter((b) => b.catId === id).length;
  X2.appForm({
    title: '编辑分类',
    fields: [
      { name: 'name', label: '名称', value: c.name },
      { name: 'emoji', label: '图标 emoji', value: c.emoji },
      ...(c.kind === 'out' ? [{ name: 'budget', label: '本月预算（元）', value: c.budget, type: 'number' }] : []),
      { name: 'archived', label: '状态', value: c.archived ? 'yes' : 'no', type: 'choice', options: [
        { value: 'no', label: '启用' }, { value: 'yes', label: '停用' },
      ] },
    ],
    onConfirm: (r) => {
      if (!r || !r.name) return;
      c.name = r.name; c.emoji = r.emoji || c.emoji;
      if (c.kind === 'out') c.budget = parseFloat(r.budget) || 0;
      c.archived = r.archived === 'yes';
      commit('已更新分类').then(openCategoryManager);
    }
  });
  /* 删除 / 停用入口 */
  setTimeout(() => {
    const card = document.querySelector('.app-modal-card');
    if (!card || card.querySelector('.app-modal-extra')) return;
    const acts = document.createElement('div');
    acts.className = 'app-modal-extra';
    acts.innerHTML = used > 0
      ? `<button class="extra-btn muted" data-act="archive">该分类已有 ${used} 笔账单，只能停用</button>`
      : `<button class="extra-btn danger" data-act="delete">删除分类</button>`;
    card.insertBefore(acts, card.querySelector('.app-modal-actions'));
    acts.querySelectorAll('.extra-btn').forEach((b) => {
      b.onclick = () => {
        document.querySelectorAll('.app-modal').forEach((m) => m.remove());
        if (b.dataset.act === 'archive') {
          c.archived = true; commit('分类已停用').then(openCategoryManager);
        } else {
          X2.appConfirm({
            title: '删除分类', content: '该分类没有账单，可以安全删除。', danger: true, confirmText: '删除',
            onConfirm: () => {
              App.state.cats = App.state.cats.filter((x) => x.id !== id);
              commit('已删除分类').then(openCategoryManager);
            }
          });
        }
      };
    });
  }, 80);
}

/* ============================================================
 *  分类排序（P1：在管理页用 ▲▼ 调整同一 kind 内的展示顺序）
 * ============================================================ */
function moveCat(id, dir) {
  const s = App.state;
  const c = (s.cats || []).find((x) => x.id === id);
  if (!c) return;
  const group = (s.cats || []).filter((x) => x.kind === c.kind)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  const idx = group.findIndex((x) => x.id === id);
  const j = idx + (dir === 'up' ? -1 : 1);
  if (j < 0 || j >= group.length) return;
  const t = group[idx].sortOrder;
  group[idx].sortOrder = group[j].sortOrder;
  group[j].sortOrder = t;
  /* 重新压缩为 0..n-1，保持连续，避免后续新增分类顺序错乱 */
  group.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    .forEach((x, i) => { x.sortOrder = i; });
  commit('已调整分类顺序').then(openCategoryManager);
}

/* ============================================================
 *  三、账单 CRUD
 * ============================================================ */
function openBillEditor(billId) {
  const s = App.state;
  const b = (s.bills || []).find((x) => x.id === billId);
  if (!b) return;
  const cat = catOf(b.catId);
  const from = accOf(b.accountId), to = accOf(b.toAccountId);
  let typeLabel = b.type === 'out' ? '支出' : b.type === 'in' ? '收入' : b.type === 'transfer' ? '转账' : '余额校准';
  const detail = b.type === 'transfer'
    ? `${from ? from.name : '?'} → ${to ? to.name : '?'}`
    : (cat ? cat.emoji + ' ' + cat.name : '-') + (b.accountId ? ' · ' + (from ? from.name : '') : '');

  X2.appConfirm({
    title: `${typeLabel} ${money(b.type === 'adjust' ? Math.abs(b.adjustDelta || 0) : b.amount)}`,
    content: `${b.date} ${b.time || ''}\n${detail}${b.note ? '\n备注：' + b.note : ''}\n\n点「编辑」修改，或关闭后重新点账单选择删除。`,
    confirmText: '编辑', cancelText: '关闭',
    onConfirm: () => editBill(billId),
    onCancel: () => showBillDeleteOption(billId),
  });
}
/* 关闭确认框后再给一次删除机会（避免误删） */
function showBillDeleteOption(billId) {
  const s = App.state;
  const b = (s.bills || []).find((x) => x.id === billId);
  if (!b) return;
  X2.appConfirm({
    title: '要删除这笔账吗？',
    content: `${b.date} ${money(b.amount)}${b.note ? '（' + b.note + '）' : ''}\n删除后账户余额与所有统计会自动重算。`,
    confirmText: '删除', danger: true,
    onConfirm: () => {
      App.state.bills = (App.state.bills || []).filter((x) => x.id !== billId);
      commit('已删除，余额已重算');
    }
  });
}
function editBill(billId) {
  const s = App.state;
  const b = (s.bills || []).find((x) => x.id === billId);
  if (!b) return;
  const cats = C2.activeCats(s, b.type === 'in' ? 'in' : 'out');
  const accs = (s.accounts || []).filter((a) => !a.archived);
  const fields = [
    { name: 'amount', label: '金额（元）', value: b.amount, type: 'number' },
    { name: 'date', label: '日期', value: b.date, type: 'date' },
    { name: 'note', label: '备注', value: b.note || '' },
  ];
  if (b.type !== 'transfer' && b.type !== 'adjust') {
    fields.push({ name: 'catId', label: '分类', value: b.catId, type: 'choice',
      options: cats.map((c) => ({ value: c.id, label: c.emoji + ' ' + c.name })) });
    fields.push({ name: 'accountId', label: '账户', value: b.accountId, type: 'choice',
      options: accs.map((a) => ({ value: a.id, label: a.emoji + ' ' + a.name })) });
  }
  if (b.type === 'transfer') {
    fields.push({ name: 'accountId', label: '转出账户', value: b.accountId, type: 'choice',
      options: accs.map((a) => ({ value: a.id, label: a.emoji + ' ' + a.name })) });
    fields.push({ name: 'toAccountId', label: '转入账户', value: b.toAccountId, type: 'choice',
      options: accs.map((a) => ({ value: a.id, label: a.emoji + ' ' + a.name })) });
  }
  X2.appForm({
    title: '编辑账单', fields,
    onConfirm: (r) => {
      if (!r) return;
      const amt = parseFloat(r.amount);
      if (!amt || amt <= 0) { X2.appToast('金额无效', 'error'); return; }
      if (r.date && !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) { X2.appToast('日期格式不对', 'error'); return; }
      if (b.type === 'transfer' && r.accountId === r.toAccountId) { X2.appToast('转出与转入不能相同', 'error'); return; }
      b.amount = Math.round(amt * 100) / 100;
      if (r.date) b.date = r.date;
      b.note = r.note || '';
      if (r.catId) b.catId = r.catId;
      if (r.accountId) b.accountId = r.accountId;
      if (r.toAccountId) b.toAccountId = r.toAccountId;
      commit('已更新，余额已重算');
    }
  });
}

/* ============================================================
 *  四、详情弹窗
 * ============================================================ */
function openCalcDetail() {
  const s = App.state;
  const d = C2.safeToSpendBreakdown(s);
  document.getElementById('calc-content').innerHTML = `
    <div class="card card-mint">
      <div class="balance-label">🌞 今日安心花</div>
      <div class="balance-amount">${money(d.safe)}</div>
      <div class="balance-sub">距离下次补给 ${d.days} 天 · 可支配 ${money(d.disp)}</div>
    </div>
    <div class="card">
      <div class="section-head"><span>逐项组成</span></div>
      <div class="calc-list">
        <div class="calc-row"><span>💚 日常可用</span><span>${money(d.daily)}</span></div>
        <div class="calc-row"><span>🔶 备用可动</span><span>${money(d.buffer)} <em>${d.included ? '已纳入' : '未纳入'}</em></span></div>
        <div class="calc-row"><span>🔒 锁定储蓄</span><span>${money(d.locked)} <em>永不纳入</em></span></div>
        <div class="calc-row sum"><span>可动用资金</span><span>${money(d.usable)}</span></div>
        <div class="calc-row minus"><span>－ 必须预留</span><span>-${money(d.reserve)}</span></div>
        <div class="calc-row sum"><span>＝ 可支配</span><span>${money(d.disp)}</span></div>
        <div class="calc-row"><span>÷ 距补给天数</span><span>${d.days} 天</span></div>
        <div class="calc-row final"><span>＝ 今日安心花</span><span>${money(d.safe)}</span></div>
      </div>
    </div>
    <div class="hint-card">
      <strong>📌 想调整？</strong><br>
      · 提高预留 → 安心花变少<br>
      · 补给日期提前 → 安心花变多<br>
      · 备用资金纳入 → 在「补给与消费规则」里开启<br>
      · 锁定储蓄永远不进入安心花
    </div>`;
  openView('calc');
}
function openAsset() {
  const s = App.state;
  const rows = (s.accounts || []).filter((a) => !a.archived).map((a) => `
    <div class="asset-row" onclick="openBalanceAdjust('${a.id}')">
      <div class="asset-emoji">${a.emoji}</div>
      <div>
        <div class="asset-name">${X2.escapeHtml(a.name)}</div>
        <div style="font-size:11px;color:var(--ink-500;margin-top:2px">${kindLabel(a.kind)}</div>
      </div>
      <div class="asset-val">${money(C2.accountBalance(s, a.id))}</div>
    </div>`).join('');
  document.getElementById('asset-list').innerHTML = rows + `
    <div class="asset-total"><span class="lbl">合计</span><span class="vl">${money(C2.totalAssets(s))}</span></div>
    <div class="hint-card">点账户可做<strong>余额校准</strong>，不会静默改余额。</div>`;
  openView('asset');
}
function openDayDetail(ds) {
  const s = App.state;
  const items = (s.bills || []).filter((b) => b.date === ds);
  const t = C2.dayTotal(s, ds);
  const net = t.in - t.out;
  const review = (s.reviews || {})[ds] || C2.autoReview(s, ds);
  document.getElementById('day-title').textContent = `${C2.mdOf(ds)} 周${C2.weekdayOf(ds)}`;
  document.getElementById('day-content').innerHTML = `
    <div class="card card-mint">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;text-align:center">
        <div><div class="balance-label">收入</div><div class="mini-value income" style="font-size:20px">${money(t.in)}</div></div>
        <div><div class="balance-label">支出</div><div class="mini-value spent" style="font-size:20px">${money(t.out)}</div></div>
        <div><div class="balance-label">净变化</div><div class="mini-value" style="font-size:20px;color:${net >= 0 ? 'var(--mint-600)' : 'var(--danger)'}">${net >= 0 ? '+' : '-'}${money(Math.abs(net))}</div></div>
      </div>
    </div>
    <div class="card" style="padding:14px">
      <div class="section-head"><span>当天账单</span><span class="more">点账单可编辑</span></div>
      ${items.length ? items.map(billRowHtml).join('') : '<div class="empty-hint">这天没有记账</div>'}
    </div>
    <div class="card" style="padding:14px">
      <div class="section-head"><span>🌿 一句话复盘</span><button class="more" onclick="editReview('${ds}')">编辑</button></div>
      <div style="font-size:13px;color:var(--ink-700);line-height:1.7">${X2.escapeHtml(review)}</div>
    </div>`;
  openView('day');
}
function editReview(ds) {
  const s = App.state;
  const cur = (s.reviews || {})[ds] || C2.autoReview(s, ds);
  X2.appPrompt({
    title: '编辑复盘', label: '这天发生了什么', value: cur,
    onConfirm: (v) => {
      if (v === null) return;
      s.reviews = s.reviews || {};
      s.reviews[ds] = v;
      commit('复盘已保存');
      openDayDetail(ds);
    }
  });
}
function openReview() {
  const s = App.state;
  const ds = C2.todayStr();
  const items = (s.bills || []).filter((b) => b.date === ds);
  const ts = C2.todaySpent(s), ti = C2.todayIncome(s), net = ti - ts;
  document.getElementById('rev-net').textContent = (net >= 0 ? '+' : '-') + money(Math.abs(net));
  document.getElementById('rev-net').style.color = net >= 0 ? 'var(--mint-600)' : 'var(--danger)';
  document.getElementById('rev-spent').textContent = money(ts);
  document.getElementById('rev-income').textContent = money(ti);
  document.getElementById('review-cats').innerHTML = items.length
    ? items.map(billRowHtml).join('') : '<div class="empty-hint">今天还没记过账 🌿</div>';
  document.getElementById('review-txt').textContent = (s.reviews || {})[ds] || C2.autoReview(s, ds);
  document.getElementById('rev-date').textContent = C2.mdOf(ds);
  openView('review');
}
function renderBuyCatGrid() {
  const cats = C2.activeCats(App.state, 'out');
  document.getElementById('buy-cat-grid').innerHTML = cats.map((c) => `
    <div class="cat-cell ${App.pickedBuyCatId === c.id ? 'active' : ''}" onclick="pickBuyCat('${c.id}')">
      <div class="em">${c.emoji}</div><div class="nm">${X2.escapeHtml(c.name)}</div>
    </div>`).join('');
}
function pickBuyCat(id) { App.pickedBuyCatId = id; renderBuyCatGrid(); }
function openBuy() {
  App.pickedBuyCatId = App.pickedBuyCatId || (C2.activeCats(App.state, 'out')[0] || {}).id;
  renderBuyCatGrid();
  document.getElementById('buy-input').value = '';
  document.getElementById('buy-result').style.display = 'none';
  openView('buy');
}
function openBuyForWish(id) {
  const w = (App.state.wishlist || []).find((x) => x.id === id);
  if (!w) return;
  App.pickedBuyCatId = w.catId;
  renderBuyCatGrid();
  document.getElementById('buy-input').value = w.price;
  openView('buy');
  computeBuy();
}
function computeBuy() {
  const s = App.state;
  const n = parseFloat(document.getElementById('buy-input').value);
  if (!n || n <= 0) { X2.appToast('请输入金额', 'error'); return; }
  const disp = C2.disposable(s);
  const days = C2.daysToSupply(s);
  const reserve = C2.reserveAmount(s);
  const cat = catOf(App.pickedBuyCatId);
  const catRest = cat ? (Number(cat.budget) || 0) - C2.catMonthSpent(s, cat.id) : null;
  const after = disp - n;
  const dailyAfter = Math.max(0, Math.floor(after / days));

  let level, verdict, reason, alt;
  if (cat && catRest !== null && catRest - n < 0) {
    level = 'red'; verdict = '🔴 暂不建议买';
    reason = `这件 ${money(n)} 超出「${cat.name}」本月余额 ${money(catRest)} 共 ${money(n - catRest)}，这个分类会超支。`;
    alt = altByCat(cat.name);
  } else if (after < 0) {
    level = 'red'; verdict = '🔴 暂不建议买';
    reason = `买完可支配变成 ${money(after)}，撑不到 ${days} 天后的下次补给，会透支生活费。`;
    alt = '等补给到账后再买，或先看更便宜的替代款。';
  } else if (after < reserve * 1.5) {
    level = 'yellow'; verdict = '🟡 建议等等';
    reason = `买完可支配只剩 ${money(after)}，剩 ${days} 天日均 ${money(dailyAfter)}，比预留 ${money(reserve)} 多一点但日子会很紧。`;
    alt = '延一周或等补给后再买，会更稳。';
  } else {
    level = 'green'; verdict = '🟢 可以买';
    reason = `买完可支配 ${money(after)}，剩 ${days} 天日均 ${money(dailyAfter)}${cat ? `，「${cat.name}」还剩 ${money(catRest - n)}` : ''}。`;
    alt = '放心买，记得记一笔。';
  }
  const v = document.getElementById('buy-verdict');
  v.className = 'verdict ' + (level === 'red' ? 'stop' : level === 'yellow' ? 'slow' : 'go');
  v.textContent = verdict;
  document.getElementById('buy-reason').innerHTML =
    `<strong>${X2.escapeHtml(reason)}</strong><br><br>💡 <strong>替代方案</strong>：${X2.escapeHtml(alt)}`;
  document.getElementById('buy-result').style.display = '';
}
function altByCat(name) {
  const m = {
    '服饰美妆': '闲鱼/二手平台看看；或等下月分类额度刷新。',
    '零食饮品': '平替品牌或自制；下次补给后再买。',
    '旅行体验': '错峰出行；或先把存钱目标完成。',
    '学习书籍': '图书馆借阅、电子版、同学借。',
    '自我提升': '等打折季或拼团；先用免费资源。',
    '健康管理': '校医务室、团购、家庭药箱常备。',
  };
  return m[name] || '等下月分类额度刷新，或调整预算。';
}
function openSupplyEdit() {
  closeDrawer();
  const s = App.state;
  X2.appForm({
    title: '补给与消费规则',
    fields: [
      { name: 'nextSupplyDate', label: '下一次允许补给日期', value: s.cycle.nextSupplyDate || C2.todayStr(), type: 'date' },
      { name: 'supplyAmount', label: '计划补给金额（仅预测，不计入余额）', value: s.cycle.supplyAmount, type: 'number' },
      { name: 'reserveAmount', label: '必须预留生活费', value: s.cycle.reserveAmount, type: 'number' },
      { name: 'bufferIncluded', label: '备用可动资金是否纳入安心花', value: s.cycle.bufferIncluded ? 'yes' : 'no', type: 'choice',
        options: [{ value: 'no', label: '不纳入（推荐）' }, { value: 'yes', label: '纳入' }] },
    ],
    onConfirm: (r) => {
      if (!r) return;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(r.nextSupplyDate)) { X2.appToast('日期格式不对', 'error'); return; }
      s.cycle = {
        nextSupplyDate: r.nextSupplyDate,
        supplyAmount: parseFloat(r.supplyAmount) || 0,
        reserveAmount: parseFloat(r.reserveAmount) || 0,
        bufferIncluded: r.bufferIncluded === 'yes',
      };
      commit('补给规则已更新');
    }
  });
}
function backupMenu() {
  closeDrawer();
  X2.appConfirm({
    title: '数据备份与恢复',
    content: '点「导出」把当前账本存成 JSON 文件；点「导入」从备份文件恢复（会覆盖当前数据）。',
    confirmText: '导出备份', cancelText: '导入恢复',
    onConfirm: () => { Store.exportJSON(App.state); X2.appToast('已导出备份文件', 'success'); },
    onCancel: () => importData(),
  });
}
function importData() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json,application/json';
  input.onchange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      let obj;
      try { obj = JSON.parse(ev.target.result); }
      catch (err) { X2.appToast('不是合法的 JSON 文件', 'error'); return; }
      const errors = window.validateState(obj);
      if (errors.length) {
        X2.appConfirm({
          title: '数据结构校验未通过',
          content: '发现 ' + errors.length + ' 个问题：\n' + errors.slice(0, 6).join('\n') + (errors.length > 6 ? '\n…' : '') + '\n\n导入已阻止，账本未被修改。',
          confirmText: '我知道了', cancelText: '',
        });
        return;
      }
      X2.appConfirm({
        title: '确认导入', content: '导入会覆盖当前全部数据，不可撤销。', danger: true, confirmText: '导入',
        onConfirm: async () => {
          App.state = obj;
          if (!App.state.schemaVersion) App.state.schemaVersion = window.SCHEMA_VERSION;
          await commit('导入成功');
        }
      });
    };
    reader.readAsText(f);
  };
  input.click();
}
function openDrawer() {
  document.getElementById('drawer').classList.add('show');
  document.getElementById('drawer-mask').classList.add('show');
}
function closeDrawer() {
  document.getElementById('drawer').classList.remove('show');
  document.getElementById('drawer-mask').classList.remove('show');
}
function openView(n) { document.getElementById('modal-' + n).classList.remove('hidden'); }
function closeView(n) { document.getElementById('modal-' + n).classList.add('hidden'); }

window.Manage = {
  openAccountManager, addAccount, editAccount, openBalanceAdjust,
  openCategoryManager, addCategory, editCategory,
  openBillEditor, editBill, showBillDeleteOption,
  openCalcDetail, openAsset, openDayDetail, editReview, openReview,
  renderBuyCatGrid, pickBuyCat, openBuy, openBuyForWish, computeBuy,
  openSupplyEdit, backupMenu, importData, openDrawer, closeDrawer, openView, closeView, moveCat,
};
