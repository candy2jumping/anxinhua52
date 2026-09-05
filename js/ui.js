/* ============================================================
 * 安心花 · 渲染与交互层
 * ============================================================ */

const C = window.Calc;
const X = window.UIX;

window.App = {
  state: null,
  tab: 'home',
  range: 'today',
  ledgerMode: 'detail',
  ledgerFilter: { type: 'all', catId: 'all' },
  ledgerSearch: '',
  calYear: null,
  calMonth: null,
  calSelected: null,
  planTab: 'budget',
  addType: 'out',
  pickedCatId: null,
  pickedAccountId: null,
  pickedToAccountId: null,
  pickedDate: null,
  pickedNote: '',
  pickedBuyCatId: null,
};

/* ---------- 通用 ---------- */
function money(n) {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  return '¥' + v.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
}
function catOf(id) { return (App.state.cats || []).find((c) => c.id === id); }
function accOf(id) { return (App.state.accounts || []).find((a) => a.id === id); }
function kindLabel(k) { return k === 'locked' ? '🔒 锁定储蓄' : k === 'buffer' ? '🔶 备用可动' : '💚 日常可用'; }

async function commit(msg) {
  await Store.save(App.state);
  if (msg) X.appToast(msg, 'success');
  renderAll();
}

function renderAll() {
  const t = App.tab;
  if (t === 'home') renderHome();
  else if (t === 'ledger') renderLedger();
  else if (t === 'add') renderAdd();
  else if (t === 'plan') renderPlan();
  else if (t === 'analysis') renderAnalysis();
  updateClock();
}

function switchTab(name) {
  App.tab = name;
  document.querySelectorAll('.tab').forEach((s) => s.classList.toggle('hidden', s.id !== 'tab-' + name));
  document.querySelectorAll('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  renderAll();
  window.scrollTo(0, 0);
}

function updateClock() {
  const el = document.getElementById('clock');
  if (el) el.textContent = C.currentTimeHHMM();
}

/* ---------- 单笔账单行 ---------- */
function billRowHtml(b) {
  const cat = catOf(b.catId);
  const acc = accOf(b.accountId);
  let sign = '', cls = '', name = '', em = '💼';
  if (b.type === 'out') { sign = '-'; cls = ''; name = cat ? cat.name : '支出'; em = cat ? cat.emoji : '💸'; }
  else if (b.type === 'in') { sign = '+'; cls = 'income'; name = cat ? cat.name : '收入'; em = cat ? cat.emoji : '✨'; }
  else if (b.type === 'transfer') {
    sign = ''; name = '转账 ' + (accOf(b.accountId) ? accOf(b.accountId).name : '?') + ' → ' + (accOf(b.toAccountId) ? accOf(b.toAccountId).name : '?');
    em = '🔄';
  } else if (b.type === 'adjust') { sign = (b.adjustDelta >= 0 ? '+' : ''); name = '余额校准'; em = '⚖️'; }
  return `
    <div class="bill-item" onclick="openBillEditor('${b.id}')">
      <div class="em">${em}</div>
      <div class="nm">${X.escapeHtml(name)}${b.note ? ' · ' + X.escapeHtml(b.note) : ''}</div>
      <div class="tm">${b.time || ''}</div>
      <div class="vl ${cls}">${sign}${money(b.type === 'adjust' ? Math.abs(b.adjustDelta || 0) : b.amount)}</div>
    </div>`;
}

/* ============================================================
 *  首页
 * ============================================================ */
function renderHome() {
  const s = App.state;
  const h = C.now().getHours();
  document.getElementById('greet-text').textContent =
    (h < 6 ? '凌晨好' : h < 11 ? '早上好' : h < 14 ? '中午好' : h < 18 ? '下午好' : '晚上好') + ' 🌿';

  let spent, income, safeLabel;
  if (App.range === 'today') { spent = C.todaySpent(s); income = C.todayIncome(s); safeLabel = '今天还能安心花'; }
  else if (App.range === 'week') { spent = C.weekSpent(s); income = C.weekIncome(s); safeLabel = '本周还能安心花'; }
  else { spent = C.monthSpent(s); income = C.monthIncome(s); safeLabel = '本月还能安心花'; }

  const safe = C.todaySafe(s);
  document.getElementById('balance-label-text').textContent = '🌞 ' + safeLabel;
  document.getElementById('balance-amount').textContent = money(safe);
  document.getElementById('balance-sub').innerHTML =
    `💰 当前余额 ${money(C.totalAssets(s))} · 距下次补给 ${C.daysToSupply(s)} 天 <span class="arrow">›</span>`;

  const rLabel = App.range === 'today' ? '今日' : App.range === 'week' ? '本周' : '本月';
  document.getElementById('mini-spent-label').textContent = '🍴 ' + rLabel + '花了';
  document.getElementById('mini-spent').textContent = money(spent);
  document.getElementById('mini-income-label').textContent = '✨ ' + rLabel + '挣了';
  document.getElementById('mini-income').textContent = money(income);
  document.getElementById('mini-saved').textContent = money(C.monthSaved(s));

  /* 本月预算 */
  const total = C.monthBudgetTotal(s);
  const used = C.monthSpent(s);
  const remain = total - used;
  const pct = total > 0 ? Math.round((used / total) * 100) : 0;
  document.getElementById('budget-ring-pct').textContent = pct + '%';
  document.getElementById('budget-ring-bar').setAttribute('stroke-dashoffset', 213.6 * (1 - Math.min(100, pct) / 100));
  document.getElementById('budget-total').textContent = money(total);
  document.getElementById('budget-used').textContent = money(used);
  document.getElementById('budget-remain').textContent = money(remain);
  document.getElementById('budget-daily').textContent = money(Math.round(used / C.monthPassedDays()));
  /* 修正：月预算用"本月剩余天数"，不再混用补给周期天数 */
  document.getElementById('budget-remain-daily').textContent = money(Math.max(0, Math.floor(remain / C.monthRemainDays())));

  renderRecentBills();
  renderTopCats();

  /* 储蓄进度 */
  const monthT = (s.goals || []).reduce((a, g) => a + (Number(g.monthTarget) || 0), 0);
  const saved = C.monthSaved(s);
  const sp = monthT > 0 ? Math.round((saved / monthT) * 100) : 0;
  document.getElementById('savings-month-target').textContent = money(monthT);
  document.getElementById('savings-month-saved').textContent = money(saved);
  document.getElementById('savings-pct').textContent = Math.min(100, sp) + '%';
  document.getElementById('savings-bar').style.width = Math.min(100, sp) + '%';
}

function setRange(r) {
  App.range = r;
  document.querySelectorAll('.range-tabs button').forEach((b) => b.classList.toggle('active', b.dataset.range === r));
  renderHome();
}

/* 近 3 日账单（按日期分组） */
function renderRecentBills() {
  const s = App.state;
  const groups = {};
  (s.bills || []).forEach((b) => { (groups[b.date] = groups[b.date] || []).push(b); });
  const dates = Object.keys(groups).sort().reverse().slice(0, 3);
  const box = document.getElementById('recent-bills');
  if (!dates.length) {
    box.innerHTML = '<div class="empty-hint">还没有账单，点下面 ＋ 记第一笔 🌱</div>';
    return;
  }
  const today = C.todayStr(), y1 = C.daysAgoStr(1);
  box.innerHTML = dates.map((d) => {
    const items = groups[d].slice().sort((a, b) => (b.time || '').localeCompare(a.time || ''));
    const out = items.filter((x) => x.type === 'out').reduce((a, x) => a + x.amount, 0);
    const badge = d === today ? '<span class="badge">今天</span>' : d === y1 ? '<span class="badge">昨天</span>' : '';
    return `
      <div class="bill-day">
        <div class="bill-day-head">
          <div class="date">${C.mdOf(d)} 周${C.weekdayOf(d)}${badge}</div>
          <div class="total">支出 ${money(out)}</div>
        </div>
        ${items.map(billRowHtml).join('')}
      </div>`;
  }).join('');
}

/* 重点分类：按"今日可花"升序（最紧的排前）+ 超支优先 */
function renderTopCats() {
  const s = App.state;
  const ranked = C.activeCats(s, 'out').map((c) => {
    const spent = C.catMonthSpent(s, c.id);
    return { cat: c, spent, can: C.catTodayCan(s, c), pct: c.budget > 0 ? Math.round((spent / c.budget) * 100) : 0 };
  }).sort((a, b) => {
    if (a.pct >= 100 && b.pct < 100) return -1;
    if (b.pct >= 100 && a.pct < 100) return 1;
    return a.can - b.can;
  }).slice(0, 4);
  const box = document.getElementById('top-cats');
  box.innerHTML = ranked.length ? ranked.map((x) => {
    const cls = x.pct >= 100 ? 'danger' : x.pct >= 70 ? 'warn' : '';
    return `
      <div class="cat-row">
        <div class="cat-emoji">${x.cat.emoji}</div>
        <div class="cat-info">
          <div class="cat-name">${X.escapeHtml(x.cat.name)}</div>
          <div class="cat-meta"><span class="spent">${money(x.spent)}</span> / ${money(x.cat.budget)}</div>
          <div class="cat-progress"><div class="cat-progress-bar ${cls}" style="width:${Math.min(100, x.pct)}%"></div></div>
        </div>
        <div class="cat-today">
          <div class="cat-today-label">今日</div>
          <div class="cat-today-val ${x.can === 0 ? 'zero' : ''}">${money(x.can)}</div>
        </div>
      </div>`;
  }).join('') : '<div class="empty-hint">还没有分类支出</div>';
}

/* ============================================================
 *  账本（明细 / 日历）
 * ============================================================ */
function setLedgerMode(m) {
  App.ledgerMode = m;
  if (m === 'cal') {
    const d = C.now();
    if (App.calYear === null) { App.calYear = d.getFullYear(); App.calMonth = d.getMonth() + 1; }
    App.calSelected = null;
  }
  document.querySelectorAll('.ledger-tabs button').forEach((b) => b.classList.toggle('active', b.dataset.mode === m));
  renderLedger();
}
function renderLedger() {
  const searchBox = document.getElementById('ledger-search');
  const detail = document.getElementById('ledger-detail');
  if (App.ledgerMode === 'detail') {
    searchBox.style.display = '';
    detail.innerHTML = renderLedgerDetail();
  } else {
    searchBox.style.display = 'none';
    detail.innerHTML = renderLedgerCalendar();
  }
}
function renderLedgerDetail() {
  const s = App.state;
  let bills = (s.bills || []).slice();
  if (App.ledgerFilter.type !== 'all') bills = bills.filter((b) => b.type === App.ledgerFilter.type);
  if (App.ledgerFilter.catId !== 'all') bills = bills.filter((b) => b.catId === App.ledgerFilter.catId);
  if (App.ledgerSearch) {
    const q = App.ledgerSearch.toLowerCase();
    bills = bills.filter((b) => {
      const c = catOf(b.catId);
      return (b.note || '').toLowerCase().includes(q) || (c && c.name.toLowerCase().includes(q));
    });
  }
  bills.sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')));
  if (!bills.length) return '<div class="empty-hint">没有符合条件的账单</div>';
  const groups = {};
  bills.forEach((b) => { (groups[b.date] = groups[b.date] || []).push(b); });
  return Object.keys(groups).sort().reverse().map((d) => {
    const items = groups[d];
    const out = items.filter((x) => x.type === 'out').reduce((a, x) => a + x.amount, 0);
    const inc = items.filter((x) => x.type === 'in').reduce((a, x) => a + x.amount, 0);
    return `
      <div class="bill-day">
        <div class="bill-day-head">
          <div class="date">${C.mdOf(d)} 周${C.weekdayOf(d)}</div>
          <div class="total" style="font-size:11px;color:var(--ink-500)">支 ${money(out)}${inc ? ' · 收 ' + money(inc) : ''}</div>
        </div>
        ${items.map(billRowHtml).join('')}
      </div>`;
  }).join('');
}
function renderLedgerCalendar() {
  const s = App.state;
  const y = App.calYear, m = App.calMonth;
  const first = new Date(y, m - 1, 1);
  const startW = first.getDay();
  const dim = new Date(y, m, 0).getDate();
  const prevDim = new Date(y, m - 1, 0).getDate();
  const cells = [];
  for (let i = startW - 1; i >= 0; i--) cells.push({ d: prevDim - i, muted: true });
  for (let d = 1; d <= dim; d++) {
    const ds = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const t = C.dayTotal(s, ds);
    cells.push({ d, ds, muted: false, isToday: ds === C.todayStr(), out: t.out, in: t.in });
  }
  let n = 1;
  while (cells.length < 42) { cells.push({ d: n, muted: true }); n++; }

  const head = ['日', '一', '二', '三', '四', '五', '六'].map((w, i) =>
    `<div class="${i === 0 || i === 6 ? 'weekend' : ''}">${w}</div>`).join('');

  const py = m - 1 < 1 ? y - 1 : y, pm = m - 1 < 1 ? 12 : m - 1;
  const ny = m + 1 > 12 ? y + 1 : y, nm = m + 1 > 12 ? 1 : m + 1;
  const sel = App.calSelected || C.todayStr();

  return `
    <div class="month-nav">
      <button onclick="setCalMonth(${py},${pm})">‹</button>
      <div style="display:flex;gap:8px;align-items:center">
        <div class="label">${y} 年 ${m} 月</div>
        <button class="today-btn" onclick="goCalToday()">今</button>
      </div>
      <button onclick="setCalMonth(${ny},${nm})">›</button>
    </div>
    <div class="cal">
      <div class="cal-head">${head}</div>
      <div class="cal-body">
        ${cells.map((c) => {
          if (c.muted) return '<div class="cal-cell muted"></div>';
          const isSel = c.ds === App.calSelected;
          const cls = `${c.isToday ? 'today' : ''} ${isSel ? 'selected' : ''} ${(c.out || c.in) ? 'has-data' : ''}`;
          const label = c.out ? `支${money(c.out)}` : c.in ? `收${money(c.in)}` : '';
          return `<div class="cal-cell ${cls}" onclick="pickCalDay('${c.ds}')">
            <div>${c.d}</div><div class="sub">${label}</div></div>`;
        }).join('')}
      </div>
    </div>
    ${renderDayQuick(sel)}`;
}
function setCalMonth(y, m) { App.calYear = y; App.calMonth = m; App.calSelected = null; renderLedger(); }
function goCalToday() {
  const d = C.now();
  App.calYear = d.getFullYear(); App.calMonth = d.getMonth() + 1; App.calSelected = null;
  renderLedger();
}
function pickCalDay(ds) { App.calSelected = ds; renderLedger(); }
/* 日历下方：默认显示"今天"小结，不点日历也能看 */
function renderDayQuick(ds) {
  const s = App.state;
  const items = (s.bills || []).filter((b) => b.date === ds);
  const t = C.dayTotal(s, ds);
  const net = t.in - t.out;
  const review = (s.reviews || {})[ds] || C.autoReview(s, ds);
  const list = items.slice(0, 4).map(billRowHtml).join('');
  return `
    <div class="day-quick">
      <div class="day-quick-head">
        <span>${C.mdOf(ds)} 周${C.weekdayOf(ds)}${ds === C.todayStr() ? ' · 今天' : ''}</span>
        <span class="total">支 ${money(t.out)}${t.in ? ' · 收 ' + money(t.in) : ''} · 净 ${net >= 0 ? '+' : '-'}${money(Math.abs(net))}</span>
      </div>
      <div class="day-quick-review">🌿 ${X.escapeHtml(review)}</div>
      ${list || '<div class="empty-hint" style="padding:8px">这天还没有账单</div>'}
      ${items.length ? `<button class="expand-btn" onclick="openDayDetail('${ds}')">${items.length > 4 ? '查看全部 ' + items.length + ' 笔' : '展开完整'} ›</button>` : ''}
    </div>`;
}
/* 筛选下拉 */
function toggleFilterMenu(name, e) {
  e.stopPropagation();
  const menu = document.getElementById('menu-' + name);
  document.querySelectorAll('.dropdown-menu').forEach((mm) => { if (mm.id !== 'menu-' + name) mm.classList.add('hidden'); });
  menu.classList.toggle('hidden');
}
function setFilter(type, value) {
  if (type === 'type') {
    App.ledgerFilter.type = value;
    document.getElementById('filter-type-label').textContent = value === 'all' ? '全部' : value === 'out' ? '支出' : '收入';
    document.querySelectorAll('#menu-type .dd-item').forEach((d) => d.classList.toggle('active', d.dataset.value === value));
  } else {
    App.ledgerFilter.catId = value;
    const c = catOf(value);
    document.getElementById('filter-cat-label').textContent = c ? c.name : '全部分类';
    document.querySelectorAll('#menu-cat .dd-item').forEach((d) => d.classList.toggle('active', d.dataset.value === value));
  }
  document.getElementById('menu-' + type).classList.add('hidden');
  renderLedger();
}
function renderCatDropdown() {
  const cats = C.activeCats(App.state, 'out');
  document.getElementById('menu-cat').innerHTML =
    `<div class="dd-item ${App.ledgerFilter.catId === 'all' ? 'active' : ''}" data-value="all" onclick="setFilter('cat','all')">全部分类</div>` +
    cats.map((c) => `<div class="dd-item ${App.ledgerFilter.catId === c.id ? 'active' : ''}" data-value="${c.id}" onclick="setFilter('cat','${c.id}')">${c.emoji} ${X.escapeHtml(c.name)}</div>`).join('');
}
document.addEventListener('click', () => {
  document.querySelectorAll('.dropdown-menu').forEach((mm) => mm.classList.add('hidden'));
});

/* ============================================================
 *  记一笔（含真实转账）
 * ============================================================ */
function renderAdd() { renderAddCatGrid(); renderAddAccounts(); renderAddOptional(); }
function setAddType(t) {
  App.addType = t; App.pickedCatId = null;
  document.querySelectorAll('.type-tabs button').forEach((b) => b.classList.toggle('active', b.dataset.type === t));
  renderAdd();
}
/* 全部分类可见，不再 slice 截断 */
function renderAddCatGrid() {
  const cats = C.activeCats(App.state, App.addType === 'in' ? 'in' : 'out');
  const grid = document.getElementById('cat-grid');
  if (App.addType === 'transfer') {
    grid.innerHTML = '<div class="empty-hint" style="grid-column:1/-1">转账不需要选分类，请在下方选择转出与转入账户</div>';
    return;
  }
  grid.innerHTML = cats.map((c) => `
    <div class="cat-cell ${App.pickedCatId === c.id ? 'active' : ''}" onclick="pickAddCat('${c.id}')">
      <div class="em">${c.emoji}</div><div class="nm">${X.escapeHtml(c.name)}</div>
    </div>`).join('') +
    `<div class="cat-cell add-cell" onclick="addCustomCat()">
      <div class="em" style="font-size:26px;color:var(--mint-600)">＋</div><div class="nm">自定义</div></div>`;
}
function pickAddCat(id) {
  App.pickedCatId = id;
  renderAddCatGrid();
}
function renderAddAccounts() {
  const accs = (App.state.accounts || []).filter((a) => !a.archived);
  const isT = App.addType === 'transfer';
  document.getElementById('acct-row').style.display = isT ? 'none' : '';
  document.getElementById('transfer-rows').style.display = isT ? '' : 'none';
  if (!isT) {
    if (!App.pickedAccountId && accs.length) App.pickedAccountId = accs[0].id;
    const a = accOf(App.pickedAccountId);
    document.getElementById('opt-account').innerHTML = a ? `${a.emoji} ${X.escapeHtml(a.name)} <span class="chev">›</span>` : '选择 <span class="chev">›</span>';
  } else {
    if (!App.pickedAccountId && accs.length) App.pickedAccountId = accs[0].id;
    if (!App.pickedToAccountId && accs.length > 1) App.pickedToAccountId = accs[1].id;
    const f = accOf(App.pickedAccountId), t = accOf(App.pickedToAccountId);
    document.getElementById('opt-from').innerHTML = f ? `${f.emoji} ${X.escapeHtml(f.name)} <span class="chev">›</span>` : '选择 <span class="chev">›</span>';
    document.getElementById('opt-to').innerHTML = t ? `${t.emoji} ${X.escapeHtml(t.name)} <span class="chev">›</span>` : '选择 <span class="chev">›</span>';
  }
}
function renderAddOptional() {
  const d = App.pickedDate || C.todayStr();
  const dt = new Date(d + 'T00:00:00');
  document.getElementById('opt-date').innerHTML = `${dt.getMonth() + 1}/${dt.getDate()} <span class="chev">›</span>`;
  document.getElementById('opt-note').innerHTML = `${App.pickedNote ? X.escapeHtml(App.pickedNote) : '点我添加'} <span class="chev">›</span>`;
}
function chooseAccount(which) {
  const accs = (App.state.accounts || []).filter((a) => !a.archived);
  X.appSheet({
    title: which === 'to' ? '转入到哪个账户' : '从哪个账户',
    options: accs.map((a) => ({ value: a.id, label: a.name, emoji: a.emoji, hint: money(C.accountBalance(App.state, a.id)) })),
    onSelect: (v) => {
      if (!v) return;
      if (which === 'to') App.pickedToAccountId = v; else App.pickedAccountId = v;
      renderAddAccounts();
    }
  });
}
function chooseDate() {
  X.appPrompt({
    title: '选择日期', label: '格式 YYYY-MM-DD', value: App.pickedDate || C.todayStr(),
    placeholder: C.todayStr(),
    onConfirm: (v) => {
      if (!v) return;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) { X.appToast('日期格式不对', 'error'); return; }
      App.pickedDate = v; renderAddOptional();
    }
  });
}
function chooseNote() {
  X.appPrompt({
    title: '备注', label: '想写点什么', value: App.pickedNote, placeholder: '比如：午饭',
    onConfirm: (v) => { if (v === null) return; App.pickedNote = v; renderAddOptional(); }
  });
}
function addCustomCat() {
  X.appForm({
    title: '新增自定义分类',
    fields: [
      { name: 'name', label: '分类名', value: '', placeholder: '如：宠物用品' },
      { name: 'emoji', label: '图标 emoji', value: '✨' },
      { name: 'budget', label: '本月预算（元）', value: '0', type: 'number' },
    ],
    onConfirm: (r) => {
      if (!r || !r.name) return;
      const id = 'cat_' + Date.now();
      App.state.cats.push({
        id, name: r.name, emoji: r.emoji || '✨',
        budget: parseFloat(r.budget) || 0,
        kind: App.addType === 'in' ? 'in' : 'out',
        sortOrder: App.state.cats.length, archived: false,
      });
      commit('已添加分类 ' + r.name);
    }
  });
}
/* 提交：支出 / 收入 / 转账 都正确处理账户余额 */
async function submitAdd() {
  const s = App.state;
  const amount = parseFloat(document.getElementById('amount-input').value);
  if (!amount || amount <= 0) { X.appToast('请输入有效金额', 'error'); return; }

  const base = {
    id: 'b_' + Date.now(),
    date: App.pickedDate || C.todayStr(),
    time: C.currentTimeHHMM(),
    amount: Math.round(amount * 100) / 100,
    note: App.pickedNote || '',
    createdAt: new Date().toISOString(),
  };

  if (App.addType === 'transfer') {
    if (!App.pickedAccountId || !App.pickedToAccountId) { X.appToast('请选择转出和转入账户', 'error'); return; }
    if (App.pickedAccountId === App.pickedToAccountId) { X.appToast('转出与转入不能是同一个账户', 'error'); return; }
    s.bills.push(Object.assign({}, base, {
      type: 'transfer', catId: 'misc',
      accountId: App.pickedAccountId, toAccountId: App.pickedToAccountId,
    }));
  } else {
    if (!App.pickedCatId) { X.appToast('请选分类', 'error'); return; }
    if (!App.pickedAccountId) { X.appToast('请选账户', 'error'); return; }
    s.bills.push(Object.assign({}, base, {
      type: App.addType, catId: App.pickedCatId, accountId: App.pickedAccountId,
    }));
  }

  document.getElementById('amount-input').value = '';
  App.pickedCatId = null; App.pickedNote = '';
  await commit(App.addType === 'transfer' ? '转账已记录，总资产不变' : '已记一笔');
  switchTab('home');
}

/* ============================================================
 *  计划（预算 / 存钱 / 想买）—— 真正切换 DOM
 * ============================================================ */
function setPlanTab(t) {
  App.planTab = t;
  document.querySelectorAll('.plan-tabs button').forEach((b) => b.classList.toggle('active', b.dataset.plan === t));
  const box = document.getElementById('plan-container');
  if (t === 'budget') box.innerHTML = planBudgetHtml();
  else if (t === 'save') box.innerHTML = planSaveHtml();
  else box.innerHTML = planWishHtml();
}
function renderPlan() { setPlanTab(App.planTab); }

function planBudgetHtml() {
  const s = App.state;
  const total = C.monthBudgetTotal(s);
  const used = C.monthSpent(s);
  const rows = C.activeCats(s, 'out').map((c) => {
    const spent = C.catMonthSpent(s, c.id);
    const pct = c.budget > 0 ? Math.round((spent / c.budget) * 100) : 0;
    const cls = pct >= 100 ? 'danger' : pct >= 70 ? 'warn' : '';
    return `
      <div class="cat-row" onclick="editCat('${c.id}')">
        <div class="cat-emoji">${c.emoji}</div>
        <div class="cat-info">
          <div class="cat-name">${X.escapeHtml(c.name)}</div>
          <div class="cat-meta"><span class="spent">${money(spent)}</span> / ${money(c.budget)}</div>
          <div class="cat-progress"><div class="cat-progress-bar ${cls}" style="width:${Math.min(100, pct)}%"></div></div>
        </div>
        <div class="cat-today"><div class="cat-today-label">已用</div><div class="cat-today-val">${pct}%</div></div>
      </div>`;
  }).join('');
  return `
    <div class="card card-mint" style="padding:16px 18px;">
      <div class="balance-label">本月总预算</div>
      <div class="balance-amount">${money(total)}</div>
      <div class="balance-sub">已花 ${money(used)} · 剩余 ${money(total - used)} · 已用 ${total > 0 ? Math.round(used / total * 100) : 0}%</div>
    </div>
    <div class="card">
      <div class="section-head"><span>分类预算</span><span class="more">点行编辑</span></div>
      <div class="cat-list">${rows}</div>
    </div>`;
}
function planSaveHtml() {
  const s = App.state;
  const goals = (s.goals || []).filter((g) => !g.archived).map((g) => {
    const pct = g.target > 0 ? Math.round((g.saved / g.target) * 100) : 0;
    return `
      <div class="goal-card">
        <div class="goal-emoji">${g.emoji}</div>
        <div onclick="editGoal('${g.id}')">
          <div class="goal-name">${X.escapeHtml(g.name)}</div>
          <div class="goal-meta">${money(g.saved)} / ${money(g.target)} · 本月计划 ${money(g.monthTarget)}</div>
          <div class="goal-progress"><div class="goal-progress-bar" style="width:${Math.min(100, pct)}%"></div></div>
        </div>
        <div class="goal-pct">${pct}%</div>
        <button class="goal-action" onclick="depositToGoal('${g.id}')">＋ 存入金额（真实转账）</button>
      </div>`;
  }).join('');
  return `
    <div class="card">
      <div class="section-head"><span>我的存钱目标</span><span class="more">点名字编辑</span></div>
      ${goals || '<div class="empty-hint">还没有目标</div>'}
      <button class="add-row" onclick="addGoal()">＋ 添加存钱目标</button>
    </div>`;
}
function planWishHtml() {
  const s = App.state;
  const list = (s.wishlist || []).map((w) => {
    const c = catOf(w.catId);
    return `
      <div class="wish-card" onclick="openBuyForWish('${w.id}')">
        <div class="wish-emoji">${w.emoji}</div>
        <div>
          <div class="wish-name">${X.escapeHtml(w.name)}</div>
          <div class="wish-meta">${c ? c.emoji + ' ' + X.escapeHtml(c.name) : '未分类'} · 已 ${w.days} 天</div>
        </div>
        <div style="text-align:right">
          <div class="wish-price">${money(w.price)}</div>
          <div style="font-size:11px;color:var(--danger);margin-top:4px" onclick="event.stopPropagation();deleteWish('${w.id}')">删除</div>
        </div>
      </div>`;
  }).join('');
  return `
    <div class="card">
      <div class="section-head"><span>想买清单</span><span class="more">点卡片判断</span></div>
      ${list || '<div class="empty-hint">还没有想买的东西</div>'}
      <button class="add-row" onclick="addWish()">＋ 添加想买的东西</button>
    </div>`;
}
function editCat(catId) {
  const c = catOf(catId);
  if (!c) return;
  const hasBills = (App.state.bills || []).some((b) => b.catId === catId);
  X.appForm({
    title: '编辑分类',
    fields: [
      { name: 'name', label: '名称', value: c.name },
      { name: 'emoji', label: '图标 emoji', value: c.emoji },
      { name: 'budget', label: '本月预算（元）', value: c.budget, type: 'number' },
    ],
    onConfirm: (r) => {
      if (!r || !r.name) return;
      c.name = r.name; c.emoji = r.emoji || c.emoji; c.budget = parseFloat(r.budget) || 0;
      commit('已更新分类');
    }
  });
  if (hasBills) setTimeout(() => X.appToast('该分类已有账单，删除会改为停用', 'info'), 100);
}
function addGoal() {
  X.appForm({
    title: '添加存钱目标',
    fields: [
      { name: 'name', label: '目标名', value: '', placeholder: '如：换新手机' },
      { name: 'emoji', label: '图标 emoji', value: '🌟' },
      { name: 'target', label: '总额度（元）', value: '1000', type: 'number' },
      { name: 'monthTarget', label: '本月计划存（元）', value: '100', type: 'number' },
    ],
    onConfirm: (r) => {
      if (!r || !r.name) return;
      App.state.goals.push({
        id: 'g_' + Date.now(), name: r.name, emoji: r.emoji || '🌟',
        target: parseFloat(r.target) || 0, saved: 0,
        monthTarget: parseFloat(r.monthTarget) || 0, archived: false,
      });
      commit('已添加目标');
    }
  });
}
function editGoal(id) {
  const g = (App.state.goals || []).find((x) => x.id === id);
  if (!g) return;
  X.appForm({
    title: '编辑目标',
    fields: [
      { name: 'name', label: '名称', value: g.name },
      { name: 'emoji', label: '图标 emoji', value: g.emoji },
      { name: 'target', label: '总额度（元）', value: g.target, type: 'number' },
      { name: 'monthTarget', label: '本月计划存（元）', value: g.monthTarget, type: 'number' },
    ],
    onConfirm: (r) => {
      if (!r || !r.name) return;
      g.name = r.name; g.emoji = r.emoji || g.emoji;
      g.target = parseFloat(r.target) || 0; g.monthTarget = parseFloat(r.monthTarget) || 0;
      commit('已更新目标');
    }
  });
}
/* 存入目标 = 真实账户转账，保证账实一致 */
function depositToGoal(id) {
  const s = App.state;
  const g = (s.goals || []).find((x) => x.id === id);
  if (!g) return;
  const accs = (s.accounts || []).filter((a) => !a.archived);
  if (accs.length < 2) { X.appToast('至少需要两个账户才能转账存钱', 'error'); return; }
  X.appForm({
    title: '存入「' + g.name + '」',
    fields: [
      { name: 'amount', label: '金额（元）', value: '100', type: 'number' },
      { name: 'from', label: '从哪个账户转出', value: accs[0].id, type: 'choice',
        options: accs.map((a) => ({ value: a.id, label: a.emoji + ' ' + a.name })) },
      { name: 'to', label: '存入哪个账户', value: (accs.find((a) => a.kind === 'locked') || accs[1]).id, type: 'choice',
        options: accs.map((a) => ({ value: a.id, label: a.emoji + ' ' + a.name + (a.kind === 'locked' ? '（锁定）' : '') })) },
    ],
    onConfirm: (r) => {
      if (!r) return;
      const amt = parseFloat(r.amount);
      if (!amt || amt <= 0) { X.appToast('金额无效', 'error'); return; }
      if (r.from === r.to) { X.appToast('转出与转入不能相同', 'error'); return; }
      s.bills.push({
        id: 'b_' + Date.now(), date: C.todayStr(), time: C.currentTimeHHMM(),
        amount: Math.round(amt * 100) / 100, catId: 'misc',
        accountId: r.from, toAccountId: r.to, type: 'transfer',
        note: '存进' + g.name, createdAt: new Date().toISOString(),
      });
      g.saved += amt;
      commit('已存入 ' + money(amt) + '，账户已同步');
    }
  });
}
function deleteWish(id) {
  X.appConfirm({
    title: '删除想买的', content: '确定从清单移除？', confirmText: '删除', danger: true,
    onConfirm: () => {
      App.state.wishlist = (App.state.wishlist || []).filter((x) => x.id !== id);
      commit('已删除');
    }
  });
}
function addWish() {
  const cats = C.activeCats(App.state, 'out');
  X.appForm({
    title: '添加想买的东西',
    fields: [
      { name: 'name', label: '想买什么', value: '', placeholder: '如：夏款连衣裙' },
      { name: 'price', label: '大概多少钱（元）', value: '100', type: 'number' },
      { name: 'catId', label: '属于哪个分类', value: cats[0] ? cats[0].id : '', type: 'choice',
        options: cats.map((c) => ({ value: c.id, label: c.emoji + ' ' + c.name })) },
      { name: 'emoji', label: '图标 emoji', value: '🛍️' },
    ],
    onConfirm: (r) => {
      if (!r || !r.name) return;
      App.state.wishlist.push({
        id: 'w_' + Date.now(), name: r.name, price: parseFloat(r.price) || 0,
        catId: r.catId, emoji: r.emoji || '🛍️', days: 0, addedAt: C.todayStr(),
      });
      commit('已添加');
    }
  });
}

/* ============================================================
 *  分析
 * ============================================================ */
function renderAnalysis() {
  const s = App.state;
  const spent = C.monthSpent(s), income = C.monthIncome(s), net = income - spent;
  const rate = income > 0 ? Math.round((net / income) * 100) : 0;
  document.getElementById('a-spent').textContent = money(spent);
  document.getElementById('a-income').textContent = money(income);
  document.getElementById('a-net').textContent = (net >= 0 ? '+' : '-') + money(Math.abs(net));
  document.getElementById('a-net').style.color = net >= 0 ? 'var(--mint-600)' : 'var(--danger)';
  document.getElementById('a-save').textContent = Math.max(0, rate) + '%';

  const rank = C.catRanking(s);
  const tot = rank.reduce((a, x) => a + x.spent, 0) || 1;
  document.getElementById('a-cat-rank').innerHTML = rank.length ? rank.map((x, i) => {
    const pct = Math.round((x.spent / tot) * 100);
    return `
      <div class="pct-row" onclick="drillCat('${x.cat.id}')">
        <div class="top"><span>${i + 1}. ${x.cat.emoji} ${X.escapeHtml(x.cat.name)}</span><span>${money(x.spent)} · ${pct}%</span></div>
        <div class="bar"><div class="fill" style="width:${pct}%"></div></div>
      </div>`;
  }).join('') : '<div class="empty-hint">本月还没有支出</div>';

  const trend = C.trendDays(s, 7);
  const max = Math.max(...trend.map((d) => d.out), 1);
  document.getElementById('a-trend').innerHTML = trend.map((d) => `
    <div class="trend-col">
      <div class="trend-val">${money(d.out)}</div>
      <div class="trend-fill" style="height:${Math.max(4, (d.out / max) * 90)}px"></div>
      <div class="trend-label">${d.label}</div>
    </div>`).join('');

  const bt = C.monthBudgetTotal(s);
  document.getElementById('a-budget-cmp').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;text-align:center;padding-top:8px">
      <div><div style="font-size:11px;color:var(--ink-500)">预算</div><div style="font-size:18px;font-weight:500">${money(bt)}</div></div>
      <div><div style="font-size:11px;color:var(--ink-500)">已花</div><div style="font-size:18px;font-weight:500;color:var(--warn)">${money(spent)}</div></div>
      <div><div style="font-size:11px;color:var(--ink-500)">剩余</div><div style="font-size:18px;font-weight:500;color:var(--mint-600)">${money(bt - spent)}</div></div>
    </div>`;
}
function drillCat(catId) {
  switchTab('ledger');
  App.ledgerMode = 'detail';
  App.ledgerFilter.catId = catId;
  App.ledgerFilter.type = 'all';
  document.getElementById('filter-type-label').textContent = '全部';
  const c = catOf(catId);
  document.getElementById('filter-cat-label').textContent = c ? c.name : '全部分类';
  renderCatDropdown();
  document.querySelectorAll('#menu-type .dd-item').forEach((d) => d.classList.toggle('active', d.dataset.value === 'all'));
  document.querySelectorAll('#menu-cat .dd-item').forEach((d) => d.classList.toggle('active', d.dataset.value === catId));
  renderLedger();
}

window.UI = {
  money, renderAll, switchTab, setRange, setLedgerMode, renderLedger, setCalMonth, goCalToday,
  pickCalDay, toggleFilterMenu, setFilter, renderCatDropdown, setAddType, pickAddCat,
  chooseAccount, chooseDate, chooseNote, addCustomCat, submitAdd, setPlanTab, renderPlan,
  editCat, addGoal, editGoal, depositToGoal, deleteWish, addWish, drillCat, updateClock,
};
