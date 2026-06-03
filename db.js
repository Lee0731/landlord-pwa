/* ============================================
   房东管家 — IndexedDB 封装
   存储：身份证图片 + 收租提醒
   ============================================ */

(function () {
  'use strict';

  const DB_NAME = 'landlord_db';
  const DB_VERSION = 1;

  function open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
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

  function tx(store, mode) {
    return open().then(db => {
      const t = db.transaction(store, mode);
      return t.objectStore(store);
    });
  }

  // ---- 图片 API ----

  function saveImage(key, data) {
    return tx('id_cards', 'readwrite').then(store => {
      return new Promise((resolve, reject) => {
        const r = store.put({ id: key, data: data, ts: Date.now() });
        r.onsuccess = () => resolve();
        r.onerror = () => reject(r.error);
      });
    });
  }

  function getImage(key) {
    return tx('id_cards', 'readonly').then(store => {
      return new Promise((resolve, reject) => {
        const r = store.get(key);
        r.onsuccess = () => resolve(r.result ? r.result.data : null);
        r.onerror = () => reject(r.error);
      });
    });
  }

  function deleteImage(key) {
    return tx('id_cards', 'readwrite').then(store => {
      return new Promise((resolve, reject) => {
        const r = store.delete(key);
        r.onsuccess = () => resolve();
        r.onerror = () => reject(r.error);
      });
    });
  }

  function deleteRoomImages(building, room) {
    return Promise.all([
      deleteImage(building + '-' + room + '-front'),
      deleteImage(building + '-' + room + '-back'),
    ]);
  }

  // ---- 提醒 API ----

  function saveReminder(id, data) {
    return tx('reminders', 'readwrite').then(store => {
      return new Promise((resolve, reject) => {
        const r = store.put({ id: id, ...data });
        r.onsuccess = () => resolve();
        r.onerror = () => reject(r.error);
      });
    });
  }

  function getReminder(id) {
    return tx('reminders', 'readonly').then(store => {
      return new Promise((resolve, reject) => {
        const r = store.get(id);
        r.onsuccess = () => resolve(r.result || null);
        r.onerror = () => reject(r.error);
      });
    });
  }

  function deleteReminder(id) {
    return tx('reminders', 'readwrite').then(store => {
      return new Promise((resolve, reject) => {
        const r = store.delete(id);
        r.onsuccess = () => resolve();
        r.onerror = () => reject(r.error);
      });
    });
  }

  function getAllReminders() {
    return tx('reminders', 'readonly').then(store => {
      return new Promise((resolve, reject) => {
        const r = store.getAll();
        r.onsuccess = () => resolve(r.result || []);
        r.onerror = () => reject(r.error);
      });
    });
  }

  window.LandlordDB = {
    open: open,
    saveImage: saveImage,
    getImage: getImage,
    deleteImage: deleteImage,
    deleteRoomImages: deleteRoomImages,
    saveReminder: saveReminder,
    getReminder: getReminder,
    deleteReminder: deleteReminder,
    getAllReminders: getAllReminders,
  };
})();
