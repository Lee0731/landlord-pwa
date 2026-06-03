/* ============================================
   房东管家 — 房间详情页逻辑
   ============================================ */

(function () {
  'use strict';

  // ---- 路由参数 ----
  const params = new URLSearchParams(window.location.search);
  const building = params.get('b') || '';
  const room = params.get('r') || '';
  if (!building || !room) { window.location.href = 'index.html'; return; }

  const DB = window.LandlordDB;
  const SKEY = 'landlord_data';

  function load() {
    try { return JSON.parse(localStorage.getItem(SKEY)) || {}; }
    catch { return {}; }
  }
  function save(data) { localStorage.setItem(SKEY, JSON.stringify(data)); }
  function rk() { return building + '-' + room; }

  // ---- DOM 引用 ----
  const $ = id => document.getElementById(id);

  const elNavTitle   = $('navTitle');
  const elNavBldg    = $('navBuilding');
  const elNavStatus  = $('navStatus');

  const elName       = $('tenantName');
  const elPhone      = $('tenantPhone');
  const elRent       = $('rentAmount');
  const elStart      = $('rentStart');
  const elNote       = $('rentNote');

  const elWaterPrice = $('waterPrice');
  const elWaterPrev  = $('waterPrev');
  const elWaterCurr  = $('waterCurr');
  const elWaterRes   = $('waterResult');

  const elElecPrice  = $('elecPrice');
  const elElecPrev   = $('elecPrev');
  const elElecCurr   = $('elecCurr');
  const elElecRes    = $('elecResult');

  const elDepAmt     = $('depositAmount');
  const elDepDate    = $('depositDate');
  const elDepNote    = $('depositNote');

  const elRemindDay  = $('remindDay');

  const elSumRent    = $('sumRent');
  const elSumWater   = $('sumWater');
  const elSumElec    = $('sumElec');
  const elSumTotal   = $('sumTotal');

  const elBtnPaid    = $('btnPaid');
  const elBtnShare   = $('btnShare');
  const elBtnSave    = $('btnSave');
  const elBtnDelete  = $('btnDelete');
  const elBtnBack    = $('btnBack');

  const elViewer     = $('imgViewer');
  const elViewerImg  = $('imgViewerSrc');
  const elViewerClose= $('imgViewerClose');
  const elImgDown    = $('imgDownload');
  const elImgRepl    = $('imgReplace');

  const elIdFront    = $('idFront');
  const elIdBack     = $('idBack');
  const elIdFrontImg = $('idFrontImg');
  const elIdBackImg  = $('idBackImg');

  // ---- 填充提醒日选项 ----
  (function () {
    for (let i = 1; i <= 31; i++) {
      const opt = document.createElement('option');
      opt.value = i; opt.textContent = i + ' 日';
      elRemindDay.appendChild(opt);
    }
  })();

  // ---- 初始化顶栏 ----
  elNavTitle.textContent = room;
  elNavBldg.textContent = building;

  // ---- 加载数据 ----
  const allData = load();
  const info = allData[rk()] || {};

  elName.value  = info.tenantName || '';
  elPhone.value = info.tenantPhone || '';
  elRent.value  = info.rentAmount || '';
  elStart.value = info.rentStart || '';
  elNote.value  = info.rentNote || '';

  elWaterPrice.value = info.waterPrice || '';
  elWaterPrev.value  = info.waterPrevReading || '';
  elWaterCurr.value  = info.waterCurrReading || '';

  elElecPrice.value = info.elecPrice || '';
  elElecPrev.value  = info.elecPrevReading || '';
  elElecCurr.value  = info.elecCurrReading || '';

  elDepAmt.value  = info.depositAmount || '';
  elDepDate.value = info.depositDate || '';
  elDepNote.value = info.depositNote || '';

  elRemindDay.value = info.rentRemindDay || 0;

  // 状态
  function updateStatus() {
    const rented = elName.value.trim().length > 0;
    elNavStatus.textContent = rented ? '已出租' : '空置';
    elNavStatus.className = 'nav-status badge ' + (rented ? 'rented' : 'vacant');
  }
  updateStatus();
  elName.addEventListener('input', updateStatus);

  // 已付状态
  const now = new Date();
  const curMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  let lastPaid = info.lastPaidMonth || '';

  function updatePaidBtn() {
    if (lastPaid === curMonth) {
      elBtnPaid.textContent = '已付 (' + curMonth + ')';
      elBtnPaid.classList.add('marked');
    } else {
      elBtnPaid.textContent = '标记已付';
      elBtnPaid.classList.remove('marked');
    }
  }
  updatePaidBtn();

  // ---- 水电计算 ----
  function calcMeter(priceEl, prevEl, currEl, resultEl, unit) {
    const price = parseFloat(priceEl.value) || 0;
    const prev  = parseFloat(prevEl.value)  || 0;
    const curr  = parseFloat(currEl.value)  || 0;

    if (curr > 0 && price > 0) {
      const usage = Math.max(0, curr - prev);
      const cost = usage * price;
      resultEl.innerHTML =
        '<span class="meter-usage">用量 <b>' + usage + '</b> ' + unit + '</span>' +
        '<span class="meter-cost">费用 <b>¥ ' + cost.toFixed(2) + '</b></span>';
      return cost;
    }
    resultEl.innerHTML =
      '<span class="meter-usage">用量 <b>--</b> ' + unit + '</span>' +
      '<span class="meter-cost">费用 <b>¥ --</b></span>';
    return 0;
  }

  function updateSummary() {
    const rent = parseFloat(elRent.value) || 0;
    const wc = calcMeter(elWaterPrice, elWaterPrev, elWaterCurr, elWaterRes, '吨');
    const ec = calcMeter(elElecPrice, elElecPrev, elElecCurr, elElecRes, '度');
    const total = rent + wc + ec;

    elSumRent.textContent  = '¥ ' + rent.toFixed(2);
    elSumWater.textContent = '¥ ' + wc.toFixed(2);
    elSumElec.textContent  = '¥ ' + ec.toFixed(2);
    elSumTotal.textContent = '¥ ' + total.toFixed(2);
  }

  // 监听水电变化
  [elWaterPrice, elWaterPrev, elWaterCurr,
   elElecPrice, elElecPrev, elElecCurr,
   elRent].forEach(el => {
    el.addEventListener('input', updateSummary);
  });

  // 首次计算
  updateSummary();

  // ---- 身份证图片 ----

  // 加载已有图片
  DB.getImage(rk() + '-front').then(data => {
    if (data) showImage(elIdFront, elIdFrontImg, data);
  });
  DB.getImage(rk() + '-back').then(data => {
    if (data) showImage(elIdBack, elIdBackImg, data);
  });

  function showImage(slot, img, data) {
    img.src = data;
    slot.classList.add('has-image');
  }

  // 图片压缩
  function compressImage(file) {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = function (e) {
        const img = new Image();
        img.onload = function () {
          const MAX = 1200;
          let w = img.width, h = img.height;
          if (w > MAX) { h = h * MAX / w; w = MAX; }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // 点击上传
  function setupSlot(slot, img, side) {
    const input = slot.querySelector('input[type=file]');

    slot.addEventListener('click', function (e) {
      if (slot.classList.contains('has-image')) {
        openViewer(slot, img, side);
      } else {
        input.click();
      }
    });

    input.addEventListener('change', async function () {
      const file = input.files[0];
      if (!file) return;
      const data = await compressImage(file);
      await DB.saveImage(rk() + '-' + side, data);
      showImage(slot, img, data);
      input.value = '';
    });
  }

  setupSlot(elIdFront, elIdFrontImg, 'front');
  setupSlot(elIdBack, elIdBackImg, 'back');

  // ---- 图片全屏查看 ----
  let viewerSide = '';

  function openViewer(slot, img, side) {
    viewerSide = side;
    elViewerImg.src = img.src;
    elViewer.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeViewer() {
    elViewer.classList.remove('active');
    document.body.style.overflow = '';
  }

  elViewerClose.addEventListener('click', closeViewer);

  // 下载
  elImgDown.addEventListener('click', function () {
    const a = document.createElement('a');
    a.href = elViewerImg.src;
    a.download = building + room + '-身份证-' + (viewerSide === 'front' ? '正面' : '反面') + '.jpg';
    a.click();
  });

  // 更换
  elImgReplace.addEventListener('click', function () {
    closeViewer();
    const slot = viewerSide === 'front' ? elIdFront : elIdBack;
    const input = slot.querySelector('input[type=file]');
    setTimeout(() => input.click(), 300);
  });

  // ---- 标记已付 ----
  elBtnPaid.addEventListener('click', function () {
    if (lastPaid === curMonth) {
      lastPaid = '';
      elBtnPaid.textContent = '标记已付';
      elBtnPaid.classList.remove('marked');
    } else {
      lastPaid = curMonth;
      elBtnPaid.textContent = '已付 (' + curMonth + ')';
      elBtnPaid.classList.add('marked');
    }
  });

  // ---- 分享账单 ----
  elBtnShare.addEventListener('click', function () {
    const rent = parseFloat(elRent.value) || 0;
    const wp = parseFloat(elWaterPrice.value) || 0;
    const wPrev = parseFloat(elWaterPrev.value) || 0;
    const wCurr = parseFloat(elWaterCurr.value) || 0;
    const wUse = Math.max(0, wCurr - wPrev);
    const wCost = wUse * wp;
    const ep = parseFloat(elElecPrice.value) || 0;
    const ePrev = parseFloat(elElecPrev.value) || 0;
    const eCurr = parseFloat(elElecCurr.value) || 0;
    const eUse = Math.max(0, eCurr - ePrev);
    const eCost = eUse * ep;
    const total = rent + wCost + eCost;

    const text =
      '【' + building + ' ' + room + '】月度账单\n' +
      '房租：¥' + rent.toFixed(2) + '\n' +
      '水费：¥' + wCost.toFixed(2) + ' (' + wUse + '吨)\n' +
      '电费：¥' + eCost.toFixed(2) + ' (' + eUse + '度)\n' +
      '合计：¥' + total.toFixed(2);

    if (navigator.share) {
      navigator.share({ title: building + ' ' + room + ' 账单', text: text });
    } else {
      navigator.clipboard.writeText(text).then(function () {
        elBtnShare.textContent = '已复制';
        setTimeout(function () { elBtnShare.textContent = '分享账单'; }, 1500);
      });
    }
  });

  // ---- 保存 ----
  elBtnSave.addEventListener('click', async function () {
    const data = load();
    const name = elName.value.trim();
    const day = parseInt(elRemindDay.value) || 0;

    data[rk()] = {
      building: building,
      room: room,
      tenantName: name,
      tenantPhone: elPhone.value.trim(),
      rentAmount: elRent.value.trim(),
      rentStart: elStart.value,
      rentNote: elNote.value.trim(),
      rented: name.length > 0,
      waterPrice: elWaterPrice.value.trim(),
      waterPrevReading: elWaterPrev.value.trim(),
      waterCurrReading: elWaterCurr.value.trim(),
      elecPrice: elElecPrice.value.trim(),
      elecPrevReading: elElecPrev.value.trim(),
      elecCurrReading: elElecCurr.value.trim(),
      rentRemindDay: day,
      rentRemindEnabled: day > 0,
      depositAmount: elDepAmt.value.trim(),
      depositDate: elDepDate.value,
      depositNote: elDepNote.value.trim(),
      lastPaidMonth: lastPaid,
    };
    save(data);

    // 提醒存 IndexedDB（SW 可读）
    if (day > 0) {
      await DB.saveReminder(rk(), {
        building: building, room: room,
        day: day, enabled: true, tenantName: name,
      });
      // 请求通知权限
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
    } else {
      await DB.deleteReminder(rk());
    }

    // 注册 periodicSync（Chrome）
    if ('serviceWorker' in navigator && 'periodicSync' in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        await reg.periodicSync.register('rent-reminder', { minInterval: 24 * 60 * 60 * 1000 });
      } catch (e) { /* not supported */ }
    }

    window.location.href = 'index.html';
  });

  // ---- 清空 ----
  elBtnDelete.addEventListener('click', async function () {
    if (!confirm('确定清空该房间所有数据？')) return;
    const data = load();
    delete data[rk()];
    save(data);
    await DB.deleteRoomImages(building, room);
    await DB.deleteReminder(rk());
    window.location.href = 'index.html';
  });

  // ---- 返回 ----
  elBtnBack.addEventListener('click', function () {
    window.location.href = 'index.html';
  });

})();
