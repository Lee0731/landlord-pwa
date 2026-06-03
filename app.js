/* ============================================
   房东管家 — 主页逻辑
   ============================================ */

(function () {
  'use strict';

  const KEY = 'landlord_data';

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
    catch { return {}; }
  }

  // ---- 日期 ----
  const d = new Date();
  document.getElementById('todayDate').textContent =
    d.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' });

  // ---- 统计刷新 ----
  function refresh() {
    const data = load();
    const rooms = document.querySelectorAll('.room');
    let rented = 0;

    rooms.forEach(el => {
      const k = el.dataset.building + '-' + el.dataset.room;
      const info = data[k];
      const dot = el.querySelector('.room-dot');

      if (info && info.rented) {
        rented++;
        el.classList.add('rented');
        dot.classList.add('rented');
      } else {
        el.classList.remove('rented');
        dot.classList.remove('rented');
      }
    });

    document.getElementById('totalRooms').textContent = rooms.length;
    document.getElementById('rentedRooms').textContent = rented;
    document.getElementById('vacantRooms').textContent = rooms.length - rented;
  }

  // ---- 点击跳转详情页 ----
  document.querySelectorAll('.room').forEach(el => {
    el.addEventListener('click', function () {
      const b = encodeURIComponent(el.dataset.building);
      const r = encodeURIComponent(el.dataset.room);
      window.location.href = 'detail.html?b=' + b + '&r=' + r;
    });
  });

  // ---- 从详情页返回时刷新 ----
  window.addEventListener('pageshow', function (e) {
    refresh();
  });

  // ---- 提醒检查 ----
  function checkReminders() {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const today = new Date().getDate();
    const curMonth = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0');
    const data = load();

    if (typeof LandlordDB === 'undefined') return;
    LandlordDB.getAllReminders().then(function (reminders) {
      reminders.forEach(function (rem) {
        if (!rem.enabled || rem.day !== today) return;
        var info = data[rem.building + '-' + rem.room] || {};
        if (info.lastPaidMonth === curMonth) return; // 已付不提醒

        new Notification('收租提醒', {
          body: rem.building + ' ' + rem.room + ' — 今日应收租金',
          icon: 'icons/icon-192.png',
          tag: rem.building + '-' + rem.room + '-' + curMonth,
        });
      });
    });
  }

  // ---- Service Worker ----
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }

  // ---- 启动 ----
  refresh();
  checkReminders();
})();
