/* ============================================
   房东管家 — 房间详情页逻辑（带调试日志）
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

// 日志面板开关
function _initDebugToggle() {
  try {
    var toggle = document.getElementById('debugToggle');
    if (toggle) {
      toggle.addEventListener('click', function() {
        toggle.parentElement.classList.toggle('open');
      });
    }
  } catch(e) {}
}

// ---- 捕获全局错误 ----
window.onerror = function(msg, src, line, col, err) {
  _log('❌ 全局错误: ' + msg + ' (行 ' + line + ')', 'err');
};
window.addEventListener('unhandledrejection', function(e) {
  _log('❌ Promise异常: ' + (e.reason && e.reason.message || e.reason), 'err');
});

// ---- 主逻辑 ----
(function () {
  'use strict';

  _initDebugToggle();
  _log('📋 详情页加载');

  // ① 最先绑定返回按钮 —— 保证一定能返回
  var btnBack = document.getElementById('btnBack');
  if (btnBack) {
    btnBack.addEventListener('click', function () {
      _log('⬅ 点击返回');
      try {
        window.location.href = 'index.html';
      } catch (e) {
        _log('❌ 返回失败: ' + e.message, 'err');
        window.location.replace('index.html');
      }
    });
    _log('✅ 返回按钮已绑定');
  } else {
    _log('❌ 找不到返回按钮 #btnBack', 'err');
  }

  // ② 解析路由参数
  var params = new URLSearchParams(window.location.search);
  var building = params.get('b') || '';
  var room = params.get('r') || '';
  _log('📍 参数: building=' + building + ', room=' + room);

  if (!building || !room) {
    _log('❌ 缺少参数，跳转首页', 'err');
    window.location.href = 'index.html';
    return;
  }

  var DB = window.LandlordDB;
  if (!DB) {
    _log('❌ LandlordDB 未加载 (db.js)', 'err');
    return;
  }
  _log('✅ LandlordDB 已就绪');

  var SKEY = 'landlord_data';
  function load() {
    try { return JSON.parse(localStorage.getItem(SKEY)) || {}; }
    catch (e) { _log('❌ 读localStorage失败: ' + e.message, 'err'); return {}; }
  }
  function save(data) {
    try { localStorage.setItem(SKEY, JSON.stringify(data)); _log('💾 数据已保存到localStorage'); }
    catch (e) { _log('❌ 写localStorage失败: ' + e.message, 'err'); }
  }
  function rk() { return building + '-' + room; }

  // ---- DOM 引用（带容错） ----
  var $ = function(id) {
    var el = document.getElementById(id);
    if (!el) _log('⚠ DOM未找到: #' + id, 'warn');
    return el;
  };

  var elNavTitle   = $('navTitle');
  var elNavBldg    = $('navBuilding');
  var elNavStatus  = $('navStatus');

  var elName       = $('tenantName');
  var elPhone      = $('tenantPhone');
  var elRent       = $('rentAmount');
  var elStart      = $('rentStart');
  var elNote       = $('rentNote');

  var elWaterPrice = $('waterPrice');
  var elWaterPrev  = $('waterPrev');
  var elWaterCurr  = $('waterCurr');
  var elWaterRes   = $('waterResult');

  var elElecPrice  = $('elecPrice');
  var elElecPrev   = $('elecPrev');
  var elElecCurr   = $('elecCurr');
  var elElecRes    = $('elecResult');

  var elNetFee     = $('netFee');
  var elOtherFee   = $('otherFee');
  var elOtherNote  = $('otherFeeNote');

  var elDepAmt     = $('depositAmount');
  var elDepDate    = $('depositDate');
  var elDepNote    = $('depositNote');

  var elRemindDay  = $('remindDay');

  var elSumRent    = $('sumRent');
  var elSumWater   = $('sumWater');
  var elSumElec    = $('sumElec');
  var elSumNet     = $('sumNet');
  var elSumOther   = $('sumOther');
  var elSumTotal   = $('sumTotal');
  var elActualPaid = $('actualPaid');
  var elMonthArrears = $('sumMonthArrears');
  var elTotalArrears = $('sumTotalArrears');
  var elArrearsBanner = $('arrearsBanner');

  var elBtnPaid    = $('btnPaid');
  var elBtnShare   = $('btnShare');
  var elBtnSave    = $('btnSave');
  var elBtnDelete  = $('btnDelete');

  var elViewer     = $('imgViewer');
  var elViewerImg  = $('imgViewerSrc');
  var elViewerClose= $('imgViewerClose');
  var elImgDown    = $('imgDownload');
  var elImgRepl    = $('imgReplace');

  var elIdFront    = $('idFront');
  var elIdBack     = $('idBack');
  var elIdFrontImg = $('idFrontImg');
  var elIdBackImg  = $('idBackImg');

  _log('✅ DOM引用获取完成');

  // ---- 填充提醒日选项 ----
  if (elRemindDay) {
    for (var i = 1; i <= 31; i++) {
      var opt = document.createElement('option');
      opt.value = i; opt.textContent = i + ' 日';
      elRemindDay.appendChild(opt);
    }
    _log('✅ 提醒日选项已填充 (1-31)');
  }

  // ---- 初始化顶栏 ----
  if (elNavTitle) elNavTitle.textContent = room;
  if (elNavBldg) elNavBldg.textContent = building;

  // ---- 加载数据 ----
  var allData = load();
  var info = allData[rk()] || {};
  _log('📂 房间数据: ' + JSON.stringify(info).substring(0, 120));

  if (elName) elName.value = info.tenantName || '';
  if (elPhone) elPhone.value = info.tenantPhone || '';
  if (elRent) elRent.value = info.rentAmount || '';
  if (elStart) elStart.value = info.rentStart || '';
  if (elNote) elNote.value = info.rentNote || '';

  if (elWaterPrice) elWaterPrice.value = info.waterPrice || '';
  if (elWaterPrev) elWaterPrev.value = info.waterPrevReading || '';
  if (elWaterCurr) elWaterCurr.value = info.waterCurrReading || '';

  if (elElecPrice) elElecPrice.value = info.elecPrice || '';
  if (elElecPrev) elElecPrev.value = info.elecPrevReading || '';
  if (elElecCurr) elElecCurr.value = info.elecCurrReading || '';

  if (elNetFee) elNetFee.value = info.netFee || '';
  if (elOtherFee) elOtherFee.value = info.otherFee || '';
  if (elOtherNote) elOtherNote.value = info.otherFeeNote || '';

  if (elDepAmt) elDepAmt.value = info.depositAmount || '';
  if (elDepDate) elDepDate.value = info.depositDate || '';
  if (elDepNote) elDepNote.value = info.depositNote || '';

  if (elRemindDay) elRemindDay.value = info.rentRemindDay || 0;

  if (elActualPaid) elActualPaid.value = info.actualPaid || '';
  // totalArrears 不需要输入框，由计算得出
  // 加载后渲染欠款横幅
  renderArrearsBanner();

  _log('✅ 表单数据已填充');

  // ---- 状态 ----
  function updateStatus() {
    if (!elName || !elNavStatus) return;
    var rented = elName.value.trim().length > 0;
    elNavStatus.textContent = rented ? '已出租' : '空置';
    elNavStatus.className = 'nav-status badge ' + (rented ? 'rented' : 'vacant');
  }
  updateStatus();
  if (elName) elName.addEventListener('input', updateStatus);

  // ---- 已付状态 ----
  var now = new Date();
  var curMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  var lastPaid = info.lastPaidMonth || '';

  function updatePaidBtn() {
    if (!elBtnPaid) return;
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
    if (!priceEl || !prevEl || !currEl || !resultEl) return 0;
    var price = parseFloat(priceEl.value) || 0;
    var prev  = parseFloat(prevEl.value)  || 0;
    var curr  = parseFloat(currEl.value)  || 0;

    if (curr > 0 && price > 0) {
      var usage = Math.max(0, curr - prev);
      var cost = usage * price;
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
    var rent = parseFloat(elRent ? elRent.value : 0) || 0;
    var wc = calcMeter(elWaterPrice, elWaterPrev, elWaterCurr, elWaterRes, '吨');
    var ec = calcMeter(elElecPrice, elElecPrev, elElecCurr, elElecRes, '度');
    var net = parseFloat(elNetFee ? elNetFee.value : 0) || 0;
    var other = parseFloat(elOtherFee ? elOtherFee.value : 0) || 0;
    var total = rent + wc + ec + net + other;

    if (elSumRent)  elSumRent.textContent  = '¥ ' + rent.toFixed(2);
    if (elSumWater) elSumWater.textContent = '¥ ' + wc.toFixed(2);
    if (elSumElec)  elSumElec.textContent  = '¥ ' + ec.toFixed(2);
    if (elSumNet)   elSumNet.textContent   = '¥ ' + net.toFixed(2);
    if (elSumOther) elSumOther.textContent = '¥ ' + other.toFixed(2);
    if (elSumTotal) elSumTotal.textContent = '¥ ' + total.toFixed(2);

    // 本月欠款
    var paid = parseFloat(elActualPaid ? elActualPaid.value : 0) || 0;
    var monthArrears = Math.max(0, total - paid);
    if (elMonthArrears) elMonthArrears.textContent = '¥ ' + monthArrears.toFixed(2);

    // 历史欠款总计
    var list = getArrearsList();
    var totalArrears = list.reduce(function(s, a) { return s + (parseFloat(a.amount) || 0); }, 0);
    var finalArrears = totalArrears + monthArrears;
    if (elTotalArrears) elTotalArrears.textContent = '¥ ' + finalArrears.toFixed(2);

    // 渲染红色横幅
    renderArrearsBanner();
  }

  // ---- 欠款历史列表 ----
  function getArrearsList() {
    try {
      var d = load();
      var info = d[rk()] || {};
      return info.arrearsList ? JSON.parse(info.arrearsList) : [];
    } catch(e) { return []; }
  }

  function saveArrearsList(list) {
    var d = load();
    if (!d[rk()]) d[rk()] = {};
    d[rk()].arrearsList = JSON.stringify(list);
    save(d);
  }

  function renderArrearsBanner() {
    if (!elArrearsBanner) return;
    var list = getArrearsList();
    if (list.length === 0) {
      elArrearsBanner.innerHTML = '';
      return;
    }
    var html = '';
    list.forEach(function(item, idx) {
      var monthStr = item.month || '';
      var monthDisplay = monthStr.replace('-', '年') + '月';
      html += '<div class="arrears-item" data-idx="' + idx + '">' +
        '<div class="arrears-info">' +
          '<span class="arrears-month">' + monthDisplay + '</span>' +
          '<span class="arrears-amount">欠 ¥' + parseFloat(item.amount).toFixed(2) + '</span>' +
        '</div>' +
        '<button class="arrears-settle" data-idx="' + idx + '">已结清</button>' +
      '</div>';
    });
    elArrearsBanner.innerHTML = html;

    // 绑定结清按钮
    elArrearsBanner.querySelectorAll('.arrears-settle').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var idx = parseInt(btn.dataset.idx);
        settleArrears(idx);
      });
    });
  }

  function settleArrears(idx) {
    var list = getArrearsList();
    if (idx >= 0 && idx < list.length) {
      _log('✅ 结清欠款: ' + JSON.stringify(list[idx]));
      list.splice(idx, 1);
      saveArrearsList(list);
      renderArrearsBanner();
      updateSummary();
    }
  }

  // 计算新的累计欠款（保存时用）
  function calcTotalArrears() {
    var rent = parseFloat(elRent ? elRent.value : 0) || 0;
    var wc = 0, ec = 0;
    if (elWaterPrice && elWaterPrev && elWaterCurr && elWaterRes) {
      var p = parseFloat(elWaterPrice.value)||0, pv = parseFloat(elWaterPrev.value)||0, c = parseFloat(elWaterCurr.value)||0;
      if(c>0&&p>0) wc = Math.max(0,c-pv)*p;
    }
    if (elElecPrice && elElecPrev && elElecCurr && elElecRes) {
      var p2 = parseFloat(elElecPrice.value)||0, pv2 = parseFloat(elElecPrev.value)||0, c2 = parseFloat(elElecCurr.value)||0;
      if(c2>0&&p2>0) ec = Math.max(0,c2-pv2)*p2;
    }
    var net = parseFloat(elNetFee ? elNetFee.value : 0) || 0;
    var other = parseFloat(elOtherFee ? elOtherFee.value : 0) || 0;
    var total = rent + wc + ec + net + other;
    var paid = parseFloat(elActualPaid ? elActualPaid.value : 0) || 0;
    var monthArrears = Math.max(0, total - paid);

    var list = getArrearsList();
    // 如果本月有欠款，加入历史
    if (monthArrears > 0) {
      var curMonth = new Date().getFullYear() + '-' + String(new Date().getMonth()+1).padStart(2,'0');
      list.push({ month: curMonth, amount: monthArrears.toFixed(2) });
      _log('📝 新增欠款: ' + curMonth + ' ¥' + monthArrears.toFixed(2));
    }
    // 保存更新后的列表
    var d = load();
    if (!d[rk()]) d[rk()] = {};
    d[rk()].arrearsList = JSON.stringify(list);
    save(d);

    var totalA = list.reduce(function(s,a){ return s + (parseFloat(a.amount)||0); }, 0);
    return totalA.toFixed(2);
  }

  // 监听变化 → 更新汇总
  [elWaterPrice, elWaterPrev, elWaterCurr,
   elElecPrice, elElecPrev, elElecCurr,
   elRent, elNetFee, elOtherFee, elActualPaid].forEach(function(el) {
    if (el) el.addEventListener('input', updateSummary);
  });

  updateSummary();
  _log('✅ 费用计算就绪');

  // ---- 结转下月 ----
  function setupRoll(btnId, prevEl, currEl, label) {
    var btn = $(btnId);
    if (!btn || !prevEl || !currEl) return;

    btn.addEventListener('click', function () {
      var currVal = currEl.value;
      if (!currVal || parseFloat(currVal) <= 0) {
        _log('⚠ 结转' + label + ': 本月读数为空', 'warn');
        return;
      }
      // 本月 → 上月，本月清空
      prevEl.value = currVal;
      currEl.value = '';
      updateSummary();
      // 按钮反馈
      btn.classList.add('done');
      btn.textContent = '✓ 已结转';
      _log('✅ ' + label + '结转: 本月读数 ' + currVal + ' → 上月');
      setTimeout(function () {
        btn.classList.remove('done');
        btn.textContent = '⏎ 结转下月';
      }, 1500);
    });
  }

  setupRoll('btnRollWater', elWaterPrev, elWaterCurr, '水费');
  setupRoll('btnRollElec', elElecPrev, elElecCurr, '电费');
  _log('✅ 结转按钮就绪');

  // ---- 身份证图片 ----
  var btnDownFront = $('btnDownFront');
  var btnReplFront = $('btnReplFront');
  var btnDownBack  = $('btnDownBack');
  var btnReplBack  = $('btnReplBack');

  function showImage(slot, img, data) {
    img.src = data;
    slot.classList.add('has-image');
    // 启用下载按钮
    if (slot === elIdFront && btnDownFront) btnDownFront.disabled = false;
    if (slot === elIdBack  && btnDownBack)  btnDownBack.disabled = false;
  }

  function compressImage(file) {
    return new Promise(function(resolve) {
      var reader = new FileReader();
      reader.onload = function (e) {
        var img = new Image();
        img.onload = function () {
          var MAX = 1200;
          var w = img.width, h = img.height;
          if (w > MAX) { h = h * MAX / w; w = MAX; }
          var canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          var result = canvas.toDataURL('image/jpeg', 0.7);
          _log('📷 图片压缩: ' + (file.size/1024).toFixed(0) + 'KB → ' + (result.length*0.75/1024).toFixed(0) + 'KB');
          resolve(result);
        };
        img.onerror = function() {
          _log('❌ 图片加载失败', 'err');
          resolve(null);
        };
        img.src = e.target.result;
      };
      reader.onerror = function() {
        _log('❌ FileReader失败', 'err');
        resolve(null);
      };
      reader.readAsDataURL(file);
    });
  }

  // 加载已有图片
  DB.getImage(rk() + '-front').then(function(data) {
    if (data && elIdFront && elIdFrontImg) {
      showImage(elIdFront, elIdFrontImg, data);
      _log('✅ 身份证正面已加载');
    }
  }).catch(function(e) { _log('⚠ 正面图片加载: ' + e.message, 'warn'); });

  DB.getImage(rk() + '-back').then(function(data) {
    if (data && elIdBack && elIdBackImg) {
      showImage(elIdBack, elIdBackImg, data);
      _log('✅ 身份证反面已加载');
    }
  }).catch(function(e) { _log('⚠ 反面图片加载: ' + e.message, 'warn'); });

  // 点击上传
  function setupSlot(slot, img, side) {
    if (!slot) return;
    var input = slot.querySelector('input[type=file]');

    slot.addEventListener('click', function (e) {
      if (slot.classList.contains('has-image')) {
        openViewer(slot, img, side);
      } else {
        if (input) input.click();
      }
    });

    if (input) {
      input.addEventListener('change', function () {
        var file = input.files[0];
        if (!file) return;
        _log('📷 选择图片: ' + side + ' (' + (file.size/1024).toFixed(0) + 'KB)');
        compressImage(file).then(function(data) {
          if (!data) return;
          return DB.saveImage(rk() + '-' + side, data).then(function() {
            showImage(slot, img, data);
            _log('✅ ' + side + ' 已保存');
          });
        }).catch(function(e) {
          _log('❌ 保存图片失败: ' + e.message, 'err');
        });
        input.value = '';
      });
    }
  }

  setupSlot(elIdFront, elIdFrontImg, 'front');
  setupSlot(elIdBack, elIdBackImg, 'back');
  _log('✅ 图片上传已初始化');

  // ---- 下载 / 更换 按钮 ----
  function downloadImg(imgEl, side) {
    if (!imgEl || !imgEl.src) return;
    var a = document.createElement('a');
    a.href = imgEl.src;
    a.download = building + room + '-身份证-' + (side === 'front' ? '正面' : '反面') + '.jpg';
    a.click();
    _log('📥 下载: ' + side);
  }

  function replaceImg(slot) {
    var input = slot ? slot.querySelector('input[type=file]') : null;
    if (input) input.click();
  }

  if (btnDownFront) btnDownFront.addEventListener('click', function() { downloadImg(elIdFrontImg, 'front'); });
  if (btnReplFront) btnReplFront.addEventListener('click', function() { replaceImg(elIdFront); });
  if (btnDownBack)  btnDownBack.addEventListener('click', function() { downloadImg(elIdBackImg, 'back'); });
  if (btnReplBack)  btnReplBack.addEventListener('click', function() { replaceImg(elIdBack); });
  _log('✅ 下载/更换按钮就绪');

  // ---- 图片全屏查看 ----
  var viewerSide = '';

  function openViewer(slot, img, side) {
    viewerSide = side;
    if (elViewerImg) elViewerImg.src = img.src;
    if (elViewer) elViewer.classList.add('active');
    document.body.style.overflow = 'hidden';
    _log('🔍 查看图片: ' + side);
  }

  function closeViewer() {
    if (elViewer) elViewer.classList.remove('active');
    document.body.style.overflow = '';
  }

  if (elViewerClose) elViewerClose.addEventListener('click', closeViewer);

  if (elImgDown) {
    elImgDown.addEventListener('click', function () {
      _log('📥 下载图片: ' + viewerSide);
      var a = document.createElement('a');
      a.href = elViewerImg.src;
      a.download = building + room + '-身份证-' + (viewerSide === 'front' ? '正面' : '反面') + '.jpg';
      a.click();
    });
  }

  if (elImgRepl) {
    elImgRepl.addEventListener('click', function () {
      closeViewer();
      var slot = viewerSide === 'front' ? elIdFront : elIdBack;
      var input = slot ? slot.querySelector('input[type=file]') : null;
      if (input) setTimeout(function() { input.click(); }, 300);
    });
  }

  // ---- 标记已付 ----
  if (elBtnPaid) {
    elBtnPaid.addEventListener('click', function () {
      if (lastPaid === curMonth) {
        lastPaid = '';
        _log('↩ 取消已付标记');
      } else {
        lastPaid = curMonth;
        _log('✅ 标记已付: ' + curMonth);
      }
      updatePaidBtn();
    });
  }

  // ---- 分享账单 ----
  if (elBtnShare) {
    elBtnShare.addEventListener('click', function () {
      var rent = parseFloat(elRent ? elRent.value : 0) || 0;
      var wp = parseFloat(elWaterPrice ? elWaterPrice.value : 0) || 0;
      var wPrev = parseFloat(elWaterPrev ? elWaterPrev.value : 0) || 0;
      var wCurr = parseFloat(elWaterCurr ? elWaterCurr.value : 0) || 0;
      var wUse = Math.max(0, wCurr - wPrev);
      var wCost = wUse * wp;
      var ep = parseFloat(elElecPrice ? elElecPrice.value : 0) || 0;
      var ePrev = parseFloat(elElecPrev ? elElecPrev.value : 0) || 0;
      var eCurr = parseFloat(elElecCurr ? elElecCurr.value : 0) || 0;
      var eUse = Math.max(0, eCurr - ePrev);
      var eCost = eUse * ep;
      var net = parseFloat(elNetFee ? elNetFee.value : 0) || 0;
      var other = parseFloat(elOtherFee ? elOtherFee.value : 0) || 0;
      var otherN = elOtherNote ? elOtherNote.value.trim() : '';
      var paid = parseFloat(elActualPaid ? elActualPaid.value : 0) || 0;
      var total = rent + wCost + eCost + net + other;
      var monthArrears = Math.max(0, total - paid);

      var text =
        '【' + building + ' ' + room + '】月度账单\n' +
        '房租：¥' + rent.toFixed(2) + '\n' +
        '水费：¥' + wCost.toFixed(2) + ' (' + wUse + '吨)\n' +
        '电费：¥' + eCost.toFixed(2) + ' (' + eUse + '度)\n' +
        '网费：¥' + net.toFixed(2) + '\n' +
        '其他：¥' + other.toFixed(2) + (otherN ? '(' + otherN + ')' : '') + '\n' +
        '合计：¥' + total.toFixed(2) + '\n' +
        '实收：¥' + paid.toFixed(2) + '\n' +
        (monthArrears > 0 ? '⚠ 本月欠款：¥' + monthArrears.toFixed(2) : '✅ 已付清');

      _log('📤 分享账单: 合计 ¥' + total.toFixed(2));

      if (navigator.share) {
        navigator.share({ title: building + ' ' + room + ' 账单', text: text })
          .then(function() { _log('✅ 分享成功'); })
          .catch(function(e) { _log('⚠ 分享取消/失败: ' + e.message, 'warn'); });
      } else {
        navigator.clipboard.writeText(text).then(function () {
          elBtnShare.textContent = '已复制';
          _log('✅ 账单已复制到剪贴板');
          setTimeout(function () { elBtnShare.textContent = '分享账单'; }, 1500);
        }).catch(function(e) {
          _log('❌ 复制失败: ' + e.message, 'err');
        });
      }
    });
  }

  // ---- 保存 ----
  if (elBtnSave) {
    elBtnSave.addEventListener('click', function () {
      _log('💾 保存中...');
      try {
        var data = load();
        var name = elName ? elName.value.trim() : '';
        var day = parseInt(elRemindDay ? elRemindDay.value : 0) || 0;

        data[rk()] = {
          building: building,
          room: room,
          tenantName: name,
          tenantPhone: elPhone ? elPhone.value.trim() : '',
          rentAmount: elRent ? elRent.value.trim() : '',
          rentStart: elStart ? elStart.value : '',
          rentNote: elNote ? elNote.value.trim() : '',
          rented: name.length > 0,
          waterPrice: elWaterPrice ? elWaterPrice.value.trim() : '',
          waterPrevReading: elWaterPrev ? elWaterPrev.value.trim() : '',
          waterCurrReading: elWaterCurr ? elWaterCurr.value.trim() : '',
          elecPrice: elElecPrice ? elElecPrice.value.trim() : '',
          elecPrevReading: elElecPrev ? elElecPrev.value.trim() : '',
          elecCurrReading: elElecCurr ? elElecCurr.value.trim() : '',
          netFee: elNetFee ? elNetFee.value.trim() : '',
          otherFee: elOtherFee ? elOtherFee.value.trim() : '',
          otherFeeNote: elOtherNote ? elOtherNote.value.trim() : '',
          rentRemindDay: day,
          rentRemindEnabled: day > 0,
          depositAmount: elDepAmt ? elDepAmt.value.trim() : '',
          depositDate: elDepDate ? elDepDate.value : '',
          depositNote: elDepNote ? elDepNote.value.trim() : '',
          actualPaid: elActualPaid ? elActualPaid.value.trim() : '',
          lastPaidMonth: lastPaid,
        };
        // 计算欠款并写入 arrearsList（calcTotalArrears 内部会 save）
        calcTotalArrears();
        // 重新加载，确保 arrearsList 合并
        data = load();

        // 云端同步
        if (typeof LandlordAuth !== 'undefined') {
          LandlordAuth.pushRoom(building, room, data[rk()]);
        }

        // 提醒存 IndexedDB
        if (day > 0) {
          DB.saveReminder(rk(), {
            building: building, room: room,
            day: day, enabled: true, tenantName: name,
          }).then(function() {
            _log('✅ 提醒已存储 (每月' + day + '日)');
          }).catch(function(e) {
            _log('❌ 存提醒失败: ' + e.message, 'err');
          });

          if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().then(function(p) {
              _log('🔔 通知权限: ' + p);
            });
          }
        } else {
          DB.deleteReminder(rk()).catch(function(e) {
            _log('⚠ 删提醒: ' + e.message, 'warn');
          });
        }

        // periodicSync
        if ('serviceWorker' in navigator && 'periodicSync' in navigator) {
          navigator.serviceWorker.ready.then(function(reg) {
            return reg.periodicSync.register('rent-reminder', { minInterval: 24 * 60 * 60 * 1000 });
          }).then(function() {
            _log('✅ periodicSync 已注册');
          }).catch(function(e) {
            _log('⚠ periodicSync: ' + e.message, 'warn');
          });
        }

        _log('✅ 保存成功，跳转首页');
        window.location.href = 'index.html';

      } catch (e) {
        _log('❌ 保存失败: ' + e.message, 'err');
      }
    });
  }

  // ---- 清空 ----
  if (elBtnDelete) {
    elBtnDelete.addEventListener('click', function () {
      if (!confirm('确定清空该房间所有数据？')) {
        _log('↩ 取消清空');
        return;
      }
      _log('🗑 清空数据...');
      try {
        var data = load();
        delete data[rk()];
        save(data);

        DB.deleteRoomImages(building, room).catch(function() {});
        DB.deleteReminder(rk()).catch(function() {});

        // 等云端删完再跳转，防止主页又拉回来
        var cloudDone;
        if (typeof LandlordAuth !== 'undefined') {
          cloudDone = LandlordAuth.deleteRoom(building, room);
        } else {
          cloudDone = Promise.resolve();
        }

        cloudDone.then(function() {
          _log('✅ 已清空，跳转首页');
          window.location.href = 'index.html';
        }).catch(function() {
          _log('⚠ 云端删除失败，仍跳转', 'warn');
          window.location.href = 'index.html';
        });
      } catch (e) {
        _log('❌ 清空失败: ' + e.message, 'err');
      }
    });
  }

  _log('✅ 详情页初始化完成');

  // ---- 重新从 IndexedDB 加载图片 ----
  function reloadImages() {
    DB.getImage(rk() + '-front').then(function(data) {
      if (data && elIdFront && elIdFrontImg) {
        showImage(elIdFront, elIdFrontImg, data);
        _log('☁ 图片已刷新: 正面');
      }
    }).catch(function() {});
    DB.getImage(rk() + '-back').then(function(data) {
      if (data && elIdBack && elIdBackImg) {
        showImage(elIdBack, elIdBackImg, data);
        _log('☁ 图片已刷新: 反面');
      }
    }).catch(function() {});
  }

  // ---- Supabase 登录 + 拉云端数据 ----
  if (typeof LandlordAuth !== 'undefined') {
    LandlordAuth.ensureLogin(function (session) {
      if (!session) return;
      // 拉取该房间最新云端数据
      LandlordAuth.pullFromCloud();
      setTimeout(function() {
        // 重新加载表单（如果云端有更新）
        var freshData = load();
        var freshInfo = freshData[rk()];
        if (freshInfo) {
          if (elName) elName.value = freshInfo.tenantName || '';
          if (elPhone) elPhone.value = freshInfo.tenantPhone || '';
          if (elRent) elRent.value = freshInfo.rentAmount || '';
          if (elStart) elStart.value = freshInfo.rentStart || '';
          if (elNote) elNote.value = freshInfo.rentNote || '';
          if (elWaterPrice) elWaterPrice.value = freshInfo.waterPrice || '';
          if (elWaterPrev) elWaterPrev.value = freshInfo.waterPrevReading || '';
          if (elWaterCurr) elWaterCurr.value = freshInfo.waterCurrReading || '';
          if (elElecPrice) elElecPrice.value = freshInfo.elecPrice || '';
          if (elElecPrev) elElecPrev.value = freshInfo.elecPrevReading || '';
          if (elElecCurr) elElecCurr.value = freshInfo.elecCurrReading || '';
          if (elDepAmt) elDepAmt.value = freshInfo.depositAmount || '';
          if (elDepDate) elDepDate.value = freshInfo.depositDate || '';
          if (elDepNote) elDepNote.value = freshInfo.depositNote || '';
          if (elRemindDay) elRemindDay.value = freshInfo.rentRemindDay || 0;
          lastPaid = freshInfo.lastPaidMonth || '';
          updateStatus();
          updatePaidBtn();
          updateSummary();
          _log('☁ 云端数据已合并');
        }
        // 云端图片已缓存到 IndexedDB，重新加载显示
        reloadImages();
      }, 2000);
    });
  }
})();
