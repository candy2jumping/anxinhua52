/* ============================================================
 * 安心花 · 入口
 * ============================================================ */

const C0 = window.Calc;

/* 记录当前日期，用于检测"跨天"并自动刷新所有统计 */
let _lastDate = C0.todayStr();

async function boot() {
  let state = null;
  try { state = await Store.load(); }
  catch (e) { console.warn('读取 IndexedDB 失败，尝试 localStorage', e); }

  if (!state) {
    state = window.emptyState();
    App.state = state;
    await Store.save(state);
  } else {
    App.state = state;
  }

  /* 分类下拉（筛选用） */
  window.UI.renderCatDropdown();

  /* 首次使用：启动引导；否则直接进入首页 */
  if (!App.state.onboarded) {
    window.UI.switchTab('home');
    window.Onboarding.startOnboarding();
  } else {
    window.UI.switchTab('home');
  }

  /* 时钟：持续更新（原来只执行一次，已修复）
     同时检测跨天 —— 跨天后所有"今天/本月"统计自动重算 */
  window.UI.updateClock();
  setInterval(() => {
    window.UI.updateClock();
    const d = C0.todayStr();
    if (d !== _lastDate) {
      _lastDate = d;
      window.UI.renderAll();
      window.UIX.appToast('已跨天，统计已刷新', 'info');
    }
  }, 15000);

  /* PWA：注册 Service Worker（离线可打开） */
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(() => console.log('[PWA] Service Worker 已注册'))
      .catch((e) => console.warn('[PWA] SW 注册失败：', e));
  }

  /* 申请持久存储，降低被浏览器清理的风险 */
  Store.requestPersistence().then((ok) => {
    if (ok) console.log('[Storage] 已获得持久存储权限');
  });

  /* 处理 PWA 快捷方式（?action=add / buy） */
  const params = new URLSearchParams(location.search);
  const action = params.get('action');
  if (action === 'add') window.UI.switchTab('add');
  else if (action === 'buy') window.Manage.openBuy();

  /* 调试入口 */
  window.__easybudget = { App, Store, Calc: window.Calc, resetAll };

  console.log('[安心花] 已启动 · schema v' + (App.state.schemaVersion || 1) +
              ' · 模式：' + (App.state.mode || 'real'));
}

/* 清空数据并重新开始（会二次确认） */
async function resetAll() {
  window.UIX.appConfirm({
    title: '清空所有数据',
    content: '这会删除全部账户、账单、预算和目标，且无法撤销。建议先导出备份。',
    confirmText: '确认清空', danger: true,
    onConfirm: () => {
      window.UIX.appConfirm({
        title: '再确认一次',
        content: '真的要清空吗？清空后需要重新初始化账本。',
        confirmText: '我确定，清空', danger: true,
        onConfirm: async () => {
          App.state = await Store.resetToEmpty();
          window.UI.switchTab('home');
          window.Onboarding.startOnboarding();
        }
      });
    }
  });
}

document.addEventListener('DOMContentLoaded', boot);
