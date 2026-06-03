/* ============================================
   房东管家 — 主页逻辑（带调试日志）
   ============================================ */

// ---- 调试日志工具 ----
var _logBody = null;
function _log(msg, type) {
  try {
    if (!_logBody) _logBody = document.getElementById('debugBody');
    if (!_logBody) return;
    var now = new Date();
    var ts = String(now.getHours()).padStart(2,'0') + ':' +
             String(now.getMinutes()).padStart(2,'0') + ':' +
             String(now.getSeconds()).padStart(2,'0') + '.' +
             String(now.getMilliseconds()).padStart(3,'0');
    var div = document.createElement('div');
    div.className = 'debug-line' + (type ? ' ' + type : '');
    div.textContent = '[' + ts + '] ' + msg;
    _logBody.appendChild(div);
    _logBody.scrollTop = _logBody.scrollHeight;
  } catch(e) {}
}

(function () {
  'use strict';

  // 日志面板开关
  var toggle = document.getElementById('debugToggle');
  if (toggle) {
    toggle.addEventListener('click', function() {
      toggle.parentElement.classList.toggle('open');
    });
  }

  // 全局错误捕获
  window.onerror = function(msg, src, line, col, err) {
    _log('❌ 全局错误: ' + msg + ' (行 ' + line + ')', 'err');
  };
  window.addEventListener('unhandledrejection', function(e) {
    _log('❌ Promise异常: ' + (e.reason && e.reason.message || e.reason), 'err');
  });

  _log('📋 主页加载');

  var KEY = 'landlord_data';

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
    catch (e) { _log('❌ 读localStorage: ' + e.message, 'err'); return {}; }
  }

  // ---- 日期 ----
  var d = new Date();
  var dateEl = document.getElementById('todayDate');
  if (dateEl) {
    dateEl.textContent = d.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' });
  }

  // ---- 统计刷新 ----
  function refresh() {
    try {
      var data = load();
      var rooms = document.querySelectorAll('.room');
      var rented = 0;

      rooms.forEach(function(el) {
        var k = el.dataset.building + '-' + el.dataset.room;
        var info = data[k];
        var dot = el.querySelector('.room-dot');

        if (info && info.rented) {
          rented++;
          el.classList.add('rented');
          if (dot) dot.classList.add('rented');
        } else {
          el.classList.remove('rented');
          if (dot) dot.classList.remove('rented');
        }
      });

      var elTotal = document.getElementById('totalRooms');
      var elRented = document.getElementById('rentedRooms');
      var elVacant = document.getElementById('vacantRooms');
      if (elTotal) elTotal.textContent = rooms.length;
      if (elRented) elRented.textContent = rented;
      if (elVacant) elVacant.textContent = rooms.length - rented;

      _log('🔄 统计: 总' + rooms.length + ' 已租' + rented + ' 空置' + (rooms.length - rented));
    } catch (e) {
      _log('❌ 刷新统计失败: ' + e.message, 'err');
    }
  }

  // ---- 点击跳转详情页 ----
  document.querySelectorAll('.room').forEach(function(el) {
    el.addEventListener('click', function () {
      var b = encodeURIComponent(el.dataset.building);
      var r = encodeURIComponent(el.dataset.room);
      _log('👉 点击房间: ' + el.dataset.building + ' ' + el.dataset.room);
      window.location.href = 'detail.html?b=' + b + '&r=' + r;
    });
  });
  _log('✅ 房间点击已绑定 (' + document.querySelectorAll('.room').length + '间)');

  // ---- 从详情页返回时刷新 ----
  window.addEventListener('pageshow', function (e) {
    _log('📥 pageshow (persisted=' + e.persisted + ')');
    refresh();
  });

  // ---- 提醒检查 ----
  function checkReminders() {
    if (!('Notification' in window)) {
      _log('⚠ 浏览器不支持 Notification');
      return;
    }
    if (Notification.permission !== 'granted') {
      _log('ℹ 通知权限: ' + Notification.permission);
      return;
    }

    var today = new Date().getDate();
    var curMonth = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0');
    var data = load();

    if (typeof LandlordDB === 'undefined') {
      _log('⚠ LandlordDB 未加载，跳过提醒检查', 'warn');
      return;
    }

    LandlordDB.getAllReminders().then(function (reminders) {
      _log('🔔 检查提醒: ' + reminders.length + '条, 今天' + today + '日');
      reminders.forEach(function (rem) {
        if (!rem.enabled || rem.day !== today) return;
        var info = data[rem.building + '-' + rem.room] || {};
        if (info.lastPaidMonth === curMonth) return;

        _log('📬 推送提醒: ' + rem.building + ' ' + rem.room);
        new Notification('收租提醒', {
          body: rem.building + ' ' + rem.room + ' — 今日应收租金',
          tag: rem.building + '-' + rem.room + '-' + curMonth,
        });
      });
    }).catch(function(e) {
      _log('❌ 提醒检查失败: ' + e.message, 'err');
    });
  }

  // ---- Service Worker ----
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').then(function(reg) {
        _log('✅ SW注册成功, scope=' + reg.scope);
      }).catch(function(e) {
        _log('❌ SW注册失败: ' + e.message, 'err');
      });
    });
  }

  // ---- 启动 ----
  refresh();
  checkReminders();
  _log('✅ 主页初始化完成');
})();
