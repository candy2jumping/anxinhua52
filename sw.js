/* 安心花 Service Worker
 * 目标：断网也能打开和记账（静态资源缓存优先）
 * 策略：核心静态资源 cache-first，失败回退 network
 */

const CACHE_NAME = 'easybudget-v1.0.0';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/db.js',
  './js/calc.js',
  './js/modals.js',
  './js/ui.js',
  './js/onboarding.js',
  './js/demo-data.js',
  './js/init.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

/* 安装：预缓存核心文件 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
      .catch((err) => console.warn('[SW] pre-cache failed:', err))
  );
});

/* 激活：清理旧版本缓存 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* 请求拦截：cache-first，回退 network，再回退首页 */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith(
    caches.match(req)
      .then((cached) => {
        if (cached) {
          // 后台静默更新（stale-while-revalidate 简化版）
          fetch(req).then((res) => {
            if (res && res.status === 200) {
              caches.open(CACHE_NAME).then((c) => c.put(req, res.clone()));
            }
          }).catch(() => {});
          return cached;
        }
        return fetch(req).then((res) => {
          if (res && res.status === 200 && req.url.startsWith('http')) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          }
          return res;
        }).catch(() => {
          // 断网且无缓存：回退首页
          if (req.mode === 'navigate') return caches.match('./index.html');
          return new Response('', { status: 504, statusText: 'offline' });
        });
      })
  );
});
