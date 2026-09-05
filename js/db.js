/* ============================================================
 * 安心花 · 数据层 (IndexedDB)
 * - 单一 store 保存整个 app state（个人账本数据量小，无需拆分表）
 * - schemaVersion + 迁移机制
 * - JSON 导出 / 导入（导入前严格校验结构）
 * - IndexedDB 不可用时自动降级到 localStorage
 * ============================================================ */

const DB_NAME = 'easybudget';
const DB_VERSION = 1;
const STORE = 'app';
const STATE_KEY = 'state';
const LS_KEY = 'easybudget_state_fallback';
const SCHEMA_VERSION = 2;

let _dbPromise = null;

/* ---------- 底层：打开 / 读写 ---------- */
function openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('no-idb')); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('idb-blocked'));
  });
  return _dbPromise;
}

function idbGet() {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(STATE_KEY);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  }));
}

function idbSet(payload) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(Object.assign({ id: STATE_KEY }, payload));
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }));
}

/* ---------- 降级：localStorage ---------- */
function lsGet() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
function lsSet(payload) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(payload));
    return true;
  } catch (e) { console.error(e); return false; }
}

/* ---------- 空账本（正式模式首次使用的基础） ---------- */
function emptyState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    mode: 'real',           // 'real' | 'demo'
    onboarded: false,       // 是否完成初始化引导
    accounts: [],
    cats: defaultCats(),
    bills: [],
    cycle: {
      nextSupplyDate: null,
      supplyAmount: 0,
      reserveAmount: 0,
      bufferIncluded: false,  // 备用资金是否纳入安心花（默认否）
    },
    goals: [],
    wishlist: [],
    reviews: {},
    createdAt: new Date().toISOString(),
  };
}

function defaultCats() {
  const out = [
    ['food',    '餐饮伙食', '🍴', 720],
    ['trans',   '交通',     '🚌', 100],
    ['phone',   '话费网费', '📱', 50],
    ['study',   '学习书籍', '📚', 100],
    ['daily',   '日用品',   '🧴', 100],
    ['skill',   '自我提升', '💡', 50],
    ['health',  '健康管理', '💊', 50],
    ['snack',   '零食饮品', '🍵', 50],
    ['social',  '社交娱乐', '🎬', 20],
    ['wear',    '服饰美妆', '👗', 100],
    ['travel',  '旅行体验', '🗺️', 100],
    ['misc',    '意外支出', '🛠️', 20],
  ].map((x, i) => ({ id: x[0], name: x[1], emoji: x[2], budget: x[3], kind: 'out', sortOrder: i, archived: false }));
  const inc = [
    ['parents',   '父母补给', '💝'],
    ['living',    '生活费',   '🍱'],
    ['workstudy', '勤工俭学', '🏫'],
    ['parttime',  '兼职接单', '💼'],
    ['family',    '家庭支持', '🎁'],
    ['other',     '其他收入', '✨'],
  ].map((x, i) => ({ id: x[0], name: x[1], emoji: x[2], budget: 0, kind: 'in', sortOrder: i, archived: false }));
  return out.concat(inc);
}

/* ---------- 迁移 ---------- */
function migrate(state) {
  if (!state) return emptyState();
  let v = state.schemaVersion || 1;

  if (v < 2) {
    // v1 -> v2：新增 bufferIncluded / account.initialBalance / bill.type=adjust
    if (state.cycle) {
      if (state.cycle.bufferIncluded === undefined) state.cycle.bufferIncluded = false;
    }
    (state.accounts || []).forEach((a) => {
      if (a.initialBalance === undefined) a.initialBalance = a.balance || 0;
      if (a.archived === undefined) a.archived = false;
    });
    (state.cats || []).forEach((c) => {
      if (c.archived === undefined) c.archived = false;
      if (c.sortOrder === undefined) c.sortOrder = 0;
    });
    v = 2;
  }

  state.schemaVersion = v;
  return state;
}

/* ---------- 校验（导入前必须调用） ---------- */
function validateState(obj) {
  const errors = [];
  if (!obj || typeof obj !== 'object') return ['文件内容不是有效对象'];

  if (!Array.isArray(obj.accounts)) errors.push('accounts 不是数组');
  if (!Array.isArray(obj.cats)) errors.push('cats 不是数组');
  if (!Array.isArray(obj.bills)) errors.push('bills 不是数组');
  if (!obj.cycle || typeof obj.cycle !== 'object') errors.push('cycle 缺失');

  (obj.accounts || []).forEach((a, i) => {
    if (!a.id) errors.push(`账户 #${i} 缺 id`);
    if (typeof a.initialBalance !== 'number' && typeof a.balance !== 'number') {
      errors.push(`账户 #${i} 余额不是数字`);
    }
    if (!['daily', 'buffer', 'locked'].includes(a.kind)) {
      errors.push(`账户 #${i} kind 非法：${a.kind}`);
    }
  });

  (obj.cats || []).forEach((c, i) => {
    if (!c.id) errors.push(`分类 #${i} 缺 id`);
    if (!['out', 'in'].includes(c.kind)) errors.push(`分类 #${i} kind 非法：${c.kind}`);
  });

  const catIds = new Set((obj.cats || []).map((c) => c.id));
  const accIds = new Set((obj.accounts || []).map((a) => a.id));
  (obj.bills || []).forEach((b, i) => {
    if (!b.id) errors.push(`账单 #${i} 缺 id`);
    if (typeof b.amount !== 'number' || isNaN(b.amount)) errors.push(`账单 #${i} 金额不是数字`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date || '')) errors.push(`账单 #${i} 日期格式错：${b.date}`);
    if (!['out', 'in', 'transfer', 'adjust'].includes(b.type)) errors.push(`账单 #${i} 类型非法：${b.type}`);
    if (b.catId && !catIds.has(b.catId)) errors.push(`账单 #${i} 引用了不存在的分类 ${b.catId}`);
    if (b.accountId && !accIds.has(b.accountId)) errors.push(`账单 #${i} 引用了不存在的账户 ${b.accountId}`);
    if (b.type === 'transfer' && !b.toAccountId) errors.push(`转账 #${i} 缺 toAccountId`);
  });

  return errors;
}

/* ---------- 对外 API ---------- */
const Store = {
  /* 读取（自动迁移） */
  async load() {
    let rec = null;
    try { rec = await idbGet(); }
    catch (e) { rec = lsGet(); }   // 降级
    if (!rec) rec = lsGet();        // 可能之前存在 localStorage
    if (!rec) return null;
    const state = Object.assign({}, rec);
    delete state.id;
    return migrate(state);
  },

  /* 保存（IndexedDB 优先，失败降级 localStorage） */
  async save(state) {
    state.schemaVersion = SCHEMA_VERSION;
    try { await idbSet(state); }
    catch (e) { lsSet(state); }
    lsSet(state);  // 双写：localStorage 作为兜底快照
    return true;
  },

  /* 清空并开始正式使用 */
  async resetToEmpty() {
    const s = emptyState();
    await Store.save(s);
    return s;
  },

  /* 导出 JSON 文件 */
  exportJSON(state) {
    const json = JSON.stringify(state, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const d = new Date();
    const stamp = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
    a.href = url;
    a.download = `安心花备份_${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  /* 申请持久存储（减少浏览器自动清理风险） */
  async requestPersistence() {
    if (navigator.storage && navigator.storage.persist) {
      try {
        const granted = await navigator.storage.persist();
        return granted;
      } catch (e) { return false; }
    }
    return false;
  },

  async estimate() {
    if (navigator.storage && navigator.storage.estimate) {
      try { return await navigator.storage.estimate(); } catch (e) { return null; }
    }
    return null;
  },
};

window.Store = Store;
window.emptyState = emptyState;
window.validateState = validateState;
window.SCHEMA_VERSION = SCHEMA_VERSION;
