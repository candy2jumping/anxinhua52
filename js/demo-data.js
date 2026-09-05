/* ============================================================
 * 安心花 · 示例数据（Demo）
 * 严格隔离：正式首次使用绝不自动加载。
 * 只有通过"体验示例数据"入口，或用户主动点击，才会写入。
 * ============================================================ */

function buildDemoState() {
  const C = window.Calc;
  const t = C.todayStr();
  const y1 = C.daysAgoStr(1);
  const y2 = C.daysAgoStr(2);

  const state = window.emptyState();
  state.mode = 'demo';
  state.onboarded = true;

  /* 账户（含资金属性） */
  state.accounts = [
    { id: 'wechat',  name: '微信',        emoji: '💚', initialBalance: 624, kind: 'daily',  archived: false },
    { id: 'alipay',  name: '支付宝',      emoji: '💙', initialBalance: 328, kind: 'daily',  archived: false },
    { id: 'icbc',    name: '工商银行卡',  emoji: '💳', initialBalance: 180, kind: 'buffer', archived: false },
    { id: 'cash',    name: '现金',        emoji: '💴', initialBalance: 50,  kind: 'daily',  archived: false },
    { id: 'savings', name: '储蓄(农村商)', emoji: '🌱', initialBalance: 250, kind: 'locked', archived: false },
  ];

  /* 账单（近 3 天示例） */
  const seed = [
    [t,  '12:07', 30, 'food',   'wechat', 'out', '午饭'],
    [t,  '14:21', 4,  'trans',  'alipay', 'out', '地铁'],
    [t,  '16:05', 8,  'study',  'wechat', 'out', '打印资料'],
    [t,  '19:30', 25, 'food',   'wechat', 'out', '晚饭'],
    [t,  '20:15', 18, 'snack',  'wechat', 'out', '奶茶'],
    [y1, '08:12', 8,  'food',   'wechat', 'out', '早餐'],
    [y1, '12:30', 32, 'food',   'wechat', 'out', '午饭'],
    [y1, '18:40', 18, 'food',   'wechat', 'out', '晚饭'],
    [y1, '20:00', 5,  'social', 'cash',   'out', '电影'],
    [y2, '08:00', 10, 'food',   'wechat', 'out', '早餐'],
    [y2, '12:30', 38, 'food',   'wechat', 'out', '午饭'],
    [y2, '18:00', 22, 'food',   'wechat', 'out', '晚饭'],
    [y2, '19:30', 12, 'trans',  'wechat', 'out', '公交'],
  ];
  state.bills = seed.map((x, i) => ({
    id: 'demo_b_' + i,
    date: x[0], time: x[1], amount: x[2],
    catId: x[3], accountId: x[4], type: x[5], note: x[6],
    createdAt: new Date().toISOString(),
  }));

  /* 一笔真实转账示例：微信 -> 储蓄（本月储蓄） */
  state.bills.push({
    id: 'demo_transfer_1',
    date: y1, time: '21:00', amount: 100,
    catId: 'misc', accountId: 'wechat', toAccountId: 'savings',
    type: 'transfer', note: '存进旅行基金',
    createdAt: new Date().toISOString(),
  });

  /* 补给规则 */
  const supply = new Date();
  supply.setDate(supply.getDate() + 12);
  state.cycle = {
    nextSupplyDate: C.fmtDate(supply),
    supplyAmount: 1500,
    reserveAmount: 100,
    bufferIncluded: false,
  };

  /* 存钱目标 */
  state.goals = [
    { id: 'demo_g1', name: '旅行基金', emoji: '✈️', target: 5000, saved: 1200, monthTarget: 200, archived: false },
    { id: 'demo_g2', name: '应急基金', emoji: '🆘', target: 3000, saved: 0,   monthTarget: 100, archived: false },
  ];

  /* 想买清单 */
  state.wishlist = [
    { id: 'demo_w1', name: 'Pocket 4',    price: 3499, catId: 'misc', emoji: '📷', days: 6, addedAt: C.daysAgoStr(6) },
    { id: 'demo_w2', name: '泳衣',        price: 200,  catId: 'wear', emoji: '👙', days: 2, addedAt: C.daysAgoStr(2) },
    { id: 'demo_w3', name: '夏款连衣裙',  price: 280,  catId: 'wear', emoji: '👗', days: 1, addedAt: C.daysAgoStr(1) },
  ];

  /* 历史复盘 */
  state.reviews = {};
  state.reviews[y1] = '示例：这天餐饮花了 ¥58，主要在食堂。';
  state.reviews[y2] = '示例：通勤花了 ¥12，可以试试周票。';

  return state;
}

window.buildDemoState = buildDemoState;
