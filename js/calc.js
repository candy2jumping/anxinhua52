/* ============================================================
 * 安心花 · 计算层
 * 硬性要求：禁止硬编码系统日期。
 * 所有"今天/本周/本月/当前时间"在函数被调用时动态读取 new Date()。
 * ============================================================ */

/* ---------- 日期工具（每次调用重新读取设备时间） ---------- */
function now() { return new Date(); }

function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
function todayStr() { return fmtDate(now()); }
function currentYM() {
  const d = now();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function dayOfMonth() { return now().getDate(); }
function currentTimeHHMM() {
  const d = now();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
/* 距今天 N 天前的日期字符串 */
function daysAgoStr(n) {
  const d = now();
  d.setDate(d.getDate() - n);
  return fmtDate(d);
}
/* 本月剩余天数（含今天） */
function monthRemainDays() {
  const d = now();
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return Math.max(1, last.getDate() - d.getDate() + 1);
}
/* 本月已过天数 */
function monthPassedDays() {
  return Math.max(1, dayOfMonth());
}
function weekdayOf(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return ['日','一','二','三','四','五','六'][d.getDay()];
}
function mdOf(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/* ---------- 账户余额：由账单流实时推导（账实一致） ----------
 * 账户不直接保存"当前余额"，而是：
 *   initialBalance（初始余额） + 所有相关账单的变动 = 当前余额
 * 这样任何账单增删改都会自动反映到余额，不会账实不符。
 */
function accountBalance(state, accountId) {
  const acc = (state.accounts || []).find((a) => a.id === accountId);
  if (!acc) return 0;
  let bal = Number(acc.initialBalance) || 0;
  (state.bills || []).forEach((b) => {
    if (b.type === 'out' && b.accountId === accountId) {
      bal -= Number(b.amount) || 0;
    } else if (b.type === 'in' && b.accountId === accountId) {
      bal += Number(b.amount) || 0;
    } else if (b.type === 'transfer') {
      if (b.accountId === accountId) bal -= Number(b.amount) || 0;      // 转出
      if (b.toAccountId === accountId) bal += Number(b.amount) || 0;    // 转入
    } else if (b.type === 'adjust' && b.accountId === accountId) {
      bal += Number(b.adjustDelta) || 0;                                // 余额校准
    }
  });
  return Math.round(bal * 100) / 100;
}

function balanceByKind(state, kinds) {
  return (state.accounts || [])
    .filter((a) => !a.archived && kinds.includes(a.kind))
    .reduce((s, a) => s + accountBalance(state, a.id), 0);
}
function totalAssets(state) { return balanceByKind(state, ['daily', 'buffer', 'locked']); }
function dailyAssets(state) { return balanceByKind(state, ['daily']); }
function bufferAssets(state) { return balanceByKind(state, ['buffer']); }
function lockedAssets(state) { return balanceByKind(state, ['locked']); }

/* 可动用资金：备用可动是否计入由 cycle.bufferIncluded 决定 */
function usableAssets(state) {
  const daily = dailyAssets(state);
  const buffer = state.cycle && state.cycle.bufferIncluded ? bufferAssets(state) : 0;
  return daily + buffer;
}

/* ---------- 安心花算法 ----------
 * 可支配 = 可动用资金 - 必须预留
 * 今日安心花 = floor(可支配 ÷ 距下次补给天数)
 * 注意：锁定储蓄永远不进入；备用可动由用户规则决定。
 */
function daysToSupply(state) {
  if (!state.cycle || !state.cycle.nextSupplyDate) return 30;
  const next = new Date(state.cycle.nextSupplyDate + 'T00:00:00');
  const diff = next - now();
  return Math.max(1, Math.ceil(diff / 86400000));
}
function reserveAmount(state) { return Number(state.cycle && state.cycle.reserveAmount) || 0; }
function disposable(state) { return usableAssets(state) - reserveAmount(state); }
function todaySafe(state) {
  return Math.max(0, Math.floor(disposable(state) / daysToSupply(state)));
}

/* 安心花计算详情（逐项组成，供"计算详情"页展示） */
function safeToSpendBreakdown(state) {
  const daily = dailyAssets(state);
  const buffer = bufferAssets(state);
  const locked = lockedAssets(state);
  const included = !!(state.cycle && state.cycle.bufferIncluded);
  const usable = usableAssets(state);
  const reserve = reserveAmount(state);
  const disp = disposable(state);
  const days = daysToSupply(state);
  const safe = todaySafe(state);
  return { daily, buffer, locked, included, usable, reserve, disp, days, safe };
}

/* ---------- 分类 / 月度统计 ---------- */
function activeCats(state, kind) {
  return (state.cats || []).filter((c) => c.kind === kind && !c.archived)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
}
function catMonthSpent(state, catId) {
  const ym = currentYM();
  return (state.bills || [])
    .filter((b) => b.type === 'out' && b.catId === catId && (b.date || '').startsWith(ym))
    .reduce((s, b) => s + (Number(b.amount) || 0), 0);
}
function monthSpent(state) {
  const ym = currentYM();
  return (state.bills || [])
    .filter((b) => b.type === 'out' && (b.date || '').startsWith(ym))
    .reduce((s, b) => s + (Number(b.amount) || 0), 0);
}
function monthIncome(state) {
  const ym = currentYM();
  return (state.bills || [])
    .filter((b) => b.type === 'in' && (b.date || '').startsWith(ym))
    .reduce((s, b) => s + (Number(b.amount) || 0), 0);
}
function todaySpent(state) {
  const t = todayStr();
  return (state.bills || [])
    .filter((b) => b.type === 'out' && b.date === t)
    .reduce((s, b) => s + (Number(b.amount) || 0), 0);
}
function todayIncome(state) {
  const t = todayStr();
  return (state.bills || [])
    .filter((b) => b.type === 'in' && b.date === t)
    .reduce((s, b) => s + (Number(b.amount) || 0), 0);
}
function weekSpent(state) {
  const from = daysAgoStr(6);
  return (state.bills || [])
    .filter((b) => b.type === 'out' && b.date >= from && b.date <= todayStr())
    .reduce((s, b) => s + (Number(b.amount) || 0), 0);
}
function weekIncome(state) {
  const from = daysAgoStr(6);
  return (state.bills || [])
    .filter((b) => b.type === 'in' && b.date >= from && b.date <= todayStr())
    .reduce((s, b) => s + (Number(b.amount) || 0), 0);
}
/* 本月储蓄：转账进"锁定储蓄"账户的金额（账实一致） */
function monthSaved(state) {
  const ym = currentYM();
  const lockedIds = (state.accounts || []).filter((a) => a.kind === 'locked').map((a) => a.id);
  return (state.bills || [])
    .filter((b) => b.type === 'transfer' && lockedIds.includes(b.toAccountId) && (b.date || '').startsWith(ym))
    .reduce((s, b) => s + (Number(b.amount) || 0), 0);
}
function monthBudgetTotal(state) {
  return activeCats(state, 'out').reduce((s, c) => s + (Number(c.budget) || 0), 0);
}
/* 某分类"今日还能花"：按补给周期剩余天数摊 */
function catTodayCan(state, cat) {
  const rest = (Number(cat.budget) || 0) - catMonthSpent(state, cat.id);
  return Math.max(0, Math.floor(rest / daysToSupply(state)));
}
/* 某日收支合计 */
function dayTotal(state, dateStr) {
  return (state.bills || [])
    .filter((b) => b.date === dateStr)
    .reduce((acc, b) => {
      if (b.type === 'out') acc.out += Number(b.amount) || 0;
      else if (b.type === 'in') acc.in += Number(b.amount) || 0;
      return acc;
    }, { in: 0, out: 0 });
}
/* 近 N 天消费趋势 */
function trendDays(state, n) {
  const arr = [];
  for (let i = n - 1; i >= 0; i--) {
    const ds = daysAgoStr(i);
    arr.push({ date: ds, label: mdOf(ds).replace('月', '/').replace('日', ''), out: dayTotal(state, ds).out });
  }
  return arr;
}
/* 分类占比排行（本月，降序） */
function catRanking(state) {
  return activeCats(state, 'out')
    .map((c) => ({ cat: c, spent: catMonthSpent(state, c.id) }))
    .filter((x) => x.spent > 0)
    .sort((a, b) => b.spent - a.spent);
}
/* 校准建议：账户余额与"应有余额"差值（用于提示做余额校准） */
function balanceDrift(state, accountId) {
  const acc = (state.accounts || []).find((a) => a.id === accountId);
  if (!acc) return 0;
  const computed = accountBalance(state, accountId);
  const declared = Number(acc.declaredBalance);
  if (isNaN(declared)) return 0;
  return Math.round((declared - computed) * 100) / 100;
}

/* ---------- 自动复盘 ---------- */
function autoReview(state, dateStr) {
  const bills = (state.bills || []).filter((b) => b.date === dateStr);
  const out = bills.filter((b) => b.type === 'out');
  if (!bills.length) return '这天还没有记账。';
  if (!out.length) return '这天只有收入，没有支出。';
  const total = out.reduce((s, b) => s + (Number(b.amount) || 0), 0);
  const byCat = {};
  out.forEach((b) => { byCat[b.catId] = (byCat[b.catId] || 0) + (Number(b.amount) || 0); });
  const top = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
  const cat = (state.cats || []).find((c) => c.id === top[0]);
  const name = cat ? `${cat.emoji} ${cat.name}` : '其他';
  return `这天支出 ¥${total}，${name}占比最大（¥${top[1]}），共 ${out.length} 笔。`;
}

/* ---------- 导出 ---------- */
window.Calc = {
  now, fmtDate, todayStr, currentYM, dayOfMonth, currentTimeHHMM, daysAgoStr,
  monthRemainDays, monthPassedDays, weekdayOf, mdOf,
  accountBalance, balanceByKind, totalAssets, dailyAssets, bufferAssets, lockedAssets,
  usableAssets, daysToSupply, reserveAmount, disposable, todaySafe, safeToSpendBreakdown,
  activeCats, catMonthSpent, monthSpent, monthIncome, todaySpent, todayIncome,
  weekSpent, weekIncome, monthSaved, monthBudgetTotal, catTodayCan, dayTotal,
  trendDays, catRanking, balanceDrift, autoReview,
};
