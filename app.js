/* ============================================
   房东管家 — App Logic (Mobile-first)
   ============================================ */

(function () {
  'use strict';

  // ---- 数据 ----
  const KEY = 'landlord_data';

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
    catch { return {}; }
  }

  function save(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  function roomKey(b, r) { return b + '-' + r; }

  // ---- 日期 ----
  const d = new Date();
  document.getElementById('todayDate').textContent =
    d.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' });

  // ---- 统计 ----
  function refresh() {
    const data = load();
    const rooms = document.querySelectorAll('.room');
    let rented = 0;

    rooms.forEach(el => {
      const k = roomKey(el.dataset.building, el.dataset.room);
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

  // ---- 弹窗 ----
  const overlay = document.getElementById('modalOverlay');
  const sheetTitle = document.getElementById('modalRoomId');
  const sheetBldg = document.getElementById('modalBuilding');
  const statusBadge = document.getElementById('modalStatus');
  const inName = document.getElementById('tenantName');
  const inPhone = document.getElementById('tenantPhone');
  const inRent = document.getElementById('rentAmount');
  const inStart = document.getElementById('rentStart');
  const inNote = document.getElementById('rentNote');

  let curB = '', curR = '';

  function open(b, r) {
    curB = b; curR = r;
    const data = load();
    const info = data[roomKey(b, r)] || {};

    sheetTitle.textContent = r;
    sheetBldg.textContent = b;
    inName.value = info.tenantName || '';
    inPhone.value = info.tenantPhone || '';
    inRent.value = info.rentAmount || '';
    inStart.value = info.rentStart || '';
    inNote.value = info.rentNote || '';

    setStatus(info.rented);
    overlay.classList.add('active');
  }

  function close() {
    overlay.classList.remove('active');
  }

  function setStatus(rented) {
    if (rented) {
      statusBadge.textContent = '已出租';
      statusBadge.className = 'modal-status-badge rented';
    } else {
      statusBadge.textContent = '空置';
      statusBadge.className = 'modal-status-badge vacant';
    }
  }

  // 房间点击
  document.querySelectorAll('.room').forEach(el => {
    el.addEventListener('click', () => open(el.dataset.building, el.dataset.room));
  });

  // 点击遮罩关闭
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  // 保存
  document.getElementById('btnSave').addEventListener('click', () => {
    const data = load();
    const k = roomKey(curB, curR);
    const name = inName.value.trim();

    data[k] = {
      building: curB,
      room: curR,
      tenantName: name,
      tenantPhone: inPhone.value.trim(),
      rentAmount: inRent.value.trim(),
      rentStart: inStart.value,
      rentNote: inNote.value.trim(),
      rented: name.length > 0,
    };
    save(data);
    refresh();
    close();
  });

  // 清空
  document.getElementById('btnDelete').addEventListener('click', () => {
    const data = load();
    delete data[roomKey(curB, curR)];
    save(data);
    refresh();
    close();
  });

  // ---- Service Worker ----
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }

  // ---- 启动 ----
  refresh();
})();
