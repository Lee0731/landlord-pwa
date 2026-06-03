/* ============================================
   房东管家 — Service Worker
   ============================================ */

const CACHE_NAME = 'landlord-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/detail.html',
  '/detail.css',
  '/detail.js',
  '/db.js',
  '/manifest.json',
];

// 安装 — 预缓存
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// 激活 — 清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// 拦截请求 — 缓存优先
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request);
    })
  );
});

// ---- 周期同步提醒 (Chrome) ----
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'rent-reminder') {
    event.waitUntil(checkReminders());
  }
});

async function checkReminders() {
  try {
    const db = await openDB();
    const store = db.transaction('reminders', 'readonly').objectStore('reminders');
    const all = await wrapRequest(store.getAll());
    db.close();

    const today = new Date().getDate();
    const curMonth = new Date().getFullYear() + '-' +
      String(new Date().getMonth() + 1).padStart(2, '0');

    // 读 localStorage 数据需要通过 clients
    const clients = await self.clients.matchAll({ type: 'window' });
    // SW 无法直接读 localStorage，所以用简易方案：
    // 只对比提醒日，不判断已付（已付由主页判断）
    all.forEach((rem) => {
      if (rem.enabled && rem.day === today) {
        self.registration.showNotification('收租提醒', {
          body: rem.building + ' ' + rem.room + ' — 今日应收租金',
          tag: rem.building + '-' + rem.room + '-' + curMonth,
        });
      }
    });
  } catch (e) { /* ignore */ }
}

// ---- IndexedDB 辅助 ----
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('landlord_db', 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('id_cards')) {
        db.createObjectStore('id_cards', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('reminders')) {
        db.createObjectStore('reminders', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function wrapRequest(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ---- 点击通知打开应用 ----
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      if (clients.length > 0) {
        clients[0].focus();
      } else {
        self.clients.openWindow('/');
      }
    })
  );
});
