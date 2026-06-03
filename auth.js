/* ============================================
   房东管家 — Supabase 认证 + 云同步
   ============================================ */

(function () {
  'use strict';

  var SUPABASE_URL = 'https://cgjknvaxjfborfnwxtqa.supabase.co';
  var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnamtudmF4amZib3Jmbnd4dHFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0ODEzMDgsImV4cCI6MjA5NjA1NzMwOH0.Lz4fO6hVtEaTyUOc6VQXpG8aZRxVwqz48TWRbs307FI';

  var _sb = null;

  function sb() {
    if (!_sb && window.supabase) {
      _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
    return _sb;
  }

  // ---- 同步状态 ----
  function setSync(s) {
    var el = document.getElementById('syncIcon');
    if (!el) return;
    el.className = 'sync-icon ' + s;
    el.title = { offline:'离线', syncing:'同步中…', synced:'已同步', error:'同步失败' }[s] || '';
  }

  // ---- 登录 ----
  function ensureLogin(cb) {
    var client = sb();
    if (!client) { _log('⚠ Supabase SDK 未加载', 'warn'); if(cb) cb(null); return; }

    client.auth.getSession().then(function(r) {
      var s = r.data && r.data.session;
      if (s) { _log('✅ 已登录: ' + s.user.email); if(cb) cb(s); return; }

      _log('⚠ 未登录');
      showLogin(function() {
        client.auth.getSession().then(function(r2) { if(cb) cb(r2.data&&r2.data.session); });
      });
    }).catch(function(e) { _log('❌ getSession: ' + e.message, 'err'); if(cb) cb(null); });
  }

  function showLogin(onOk) {
    var ov = document.getElementById('loginOverlay');
    if (!ov) return;
    ov.classList.add('active');

    var email = document.getElementById('loginEmail');
    var pass = document.getElementById('loginPass');
    var btn = document.getElementById('loginBtn');
    var err = document.getElementById('loginErr');

    function doLogin() {
      var e = email.value.trim(), p = pass.value;
      if (!e||!p) { err.textContent='请输入邮箱和密码'; return; }
      err.textContent=''; btn.textContent='登录中…'; btn.disabled=true;
      _log('🔐 登录: ' + e);

      sb().auth.signInWithPassword({email:e,password:p}).then(function(r) {
        if (r.error) { err.textContent=r.error.message; btn.textContent='登录'; btn.disabled=false; _log('❌ '+r.error.message,'err'); return; }
        _log('✅ 登录成功');
        ov.classList.remove('active');
        if(onOk) onOk();
      }).catch(function(e) { err.textContent=e.message||'登录失败'; btn.textContent='登录'; btn.disabled=false; });
    }

    btn.onclick = doLogin;
    pass.onkeydown = function(e){if(e.key==='Enter')doLogin();};
    email.onkeydown = function(e){if(e.key==='Enter')pass.focus();};
  }

  // ---- 云端读写 ----
  var SKEY = 'landlord_data';

  function loadLocal() { try{return JSON.parse(localStorage.getItem(SKEY))||{};}catch(e){return {};} }
  function saveLocal(d) { localStorage.setItem(SKEY, JSON.stringify(d)); }

  // 从 IndexedDB 读图片
  function readLocalImages(key) {
    var frontP = window.LandlordDB ? LandlordDB.getImage(key+'-front') : Promise.resolve(null);
    var backP  = window.LandlordDB ? LandlordDB.getImage(key+'-back')  : Promise.resolve(null);
    return Promise.all([frontP, backP]);
  }

  // 写图片到 IndexedDB
  function writeLocalImages(key, front, back) {
    var DB = window.LandlordDB;
    if (!DB) return Promise.resolve();
    var p1 = front ? DB.saveImage(key+'-front', front) : Promise.resolve();
    var p2 = back  ? DB.saveImage(key+'-back', back)   : Promise.resolve();
    return Promise.all([p1, p2]);
  }

  function pullFromCloud() {
    var client = sb();
    if (!client) return;
    setSync('syncing'); _log('☁ 拉取云端数据…');

    client.from('rooms').select('*').then(function(r) {
      if (r.error) { _log('❌ 拉取: '+r.error.message,'err'); setSync('error'); return; }
      var rows = r.data||[];
      _log('☁ 拉到 '+rows.length+' 条');

      var local = loadLocal(), changed = false;

      // 构建云端 key 集合
      var cloudSet = {};
      var imageSyncQueue = []; // 需要同步图片的房间

      rows.forEach(function(row) {
        var key = row.building+'-'+row.room;
        cloudSet[key] = true;

        var cloudT = new Date(row.updated_at).getTime();
        var localT = (local[key]&&local[key]._cloudTime)||0;
        if (cloudT > localT) {
          local[key] = rowToData(row, local[key]);
          changed = true;
          // 检查是否有云端图片需要下载
          if (row.id_front || row.id_back) {
            imageSyncQueue.push({ key: key, front: row.id_front, back: row.id_back });
          }
        }
      });

      // 云端已删除 → 本地也删
      Object.keys(local).forEach(function(k) {
        var d = local[k];
        if (!d.building || !d.room) return;
        if (d._cloudTime && !cloudSet[k]) {
          _log('☁ 本地删除(云端已无): '+k);
          delete local[k];
          changed = true;
        }
      });

      // 本地有但云端没有(从未同步过) → 补上传
      var needPush = [];
      Object.keys(local).forEach(function(k) {
        var d = local[k];
        if (!d.building || !d.room) return;
        if (!cloudSet[k] && d.rented) {
          needPush.push(d);
        }
      });

      if (needPush.length > 0) {
        _log('☁ 发现 '+needPush.length+' 条本地数据未上传，补传中…');
        // 补传包含图片
        needPush.reduce(function(chain, d) {
          return chain.then(function() {
            var k = d.building+'-'+d.room;
            return readLocalImages(k).then(function(imgs) {
              var row = dataToRow(d);
              row.building = d.building; row.room = d.room;
              row.id_front = imgs[0] || '';
              row.id_back  = imgs[1] || '';
              return client.from('rooms').upsert(row, {onConflict:'building,room'});
            });
          });
        }, Promise.resolve()).then(function() {
          _log('✅ 补传完成');
        }).catch(function(e) { _log('❌ 补传异常: '+e.message,'err'); });
      }

      if (changed) { saveLocal(local); _log('☁ 本地已更新'); }

      // 同步图片：云端图片 → IndexedDB
      if (imageSyncQueue.length > 0) {
        _log('☁ 同步 '+imageSyncQueue.length+' 间房图片…');
        imageSyncQueue.forEach(function(item) {
          writeLocalImages(item.key, item.front, item.back).then(function() {
            _log('☁ 图片已缓存: '+item.key);
          }).catch(function(e) {
            _log('⚠ 图片缓存失败: '+item.key+' '+e.message, 'warn');
          });
        });
      }

      setSync('synced');
    }).catch(function(e) { _log('❌ 拉取异常: '+e.message,'err'); setSync('error'); });
  }

  function pushRoom(building, room, roomData) {
    var client = sb();
    if (!client) return;
    var key = building+'-'+room;
    setSync('syncing'); _log('☁ 上传 '+key+'…');

    var row = dataToRow(roomData);
    row.building = building; row.room = room;

    // 读本地图片一起上传
    readLocalImages(key).then(function(imgs) {
      row.id_front = imgs[0] || '';
      row.id_back  = imgs[1] || '';

      _log('☁ 图片: 正面'+(imgs[0]?'有':'无')+' 反面'+(imgs[1]?'有':'无'));

      return client.from('rooms').upsert(row, {onConflict:'building,room'});
    }).then(function(r) {
      if (r.error) { _log('❌ 上传: '+r.error.message,'err'); setSync('error'); return; }
      _log('☁ '+key+' 已同步');
      var local = loadLocal();
      if (local[key]) local[key]._cloudTime = Date.now();
      saveLocal(local);
      setSync('synced');
    }).catch(function(e) { _log('❌ 上传异常: '+e.message,'err'); setSync('error'); });
  }

  function deleteRoom(building, room) {
    var client = sb();
    if (!client) return Promise.resolve();
    _log('☁ 删除 '+building+'-'+room);
    return client.from('rooms').delete().eq('building',building).eq('room',room)
      .then(function(r) {
        if(r.error) { _log('❌ 删除: '+r.error.message,'err'); throw r.error; }
        else _log('☁ 已从云端删除');
      }).catch(function(e){ _log('❌ 删除异常: '+e.message,'err'); throw e; });
  }

  // ---- 数据转换 ----
  function dataToRow(d) {
    return {
      tenant_name: d.tenantName||'', tenant_phone: d.tenantPhone||'',
      rent_amount: d.rentAmount||'', rent_start: d.rentStart||'',
      rent_note: d.rentNote||'', rented: d.rented||false,
      water_price: d.waterPrice||'', water_prev: d.waterPrevReading||'',
      water_curr: d.waterCurrReading||'',
      elec_price: d.elecPrice||'', elec_prev: d.elecPrevReading||'',
      elec_curr: d.elecCurrReading||'',
      net_fee: d.netFee||'',
      other_fee: d.otherFee||'', other_fee_note: d.otherFeeNote||'',
      deposit_amount: d.depositAmount||'', deposit_date: d.depositDate||'',
      deposit_note: d.depositNote||'',
      remind_day: d.rentRemindDay||0, remind_enabled: d.rentRemindEnabled||false,
      actual_paid: d.actualPaid||'', total_arrears: d.totalArrears||'0',
      last_paid_month: d.lastPaidMonth||'',
    };
  }

  function rowToData(row, old) {
    var d = old||{};
    d.building=row.building; d.room=row.room;
    d.tenantName=row.tenant_name||''; d.tenantPhone=row.tenant_phone||'';
    d.rentAmount=row.rent_amount||''; d.rentStart=row.rent_start||'';
    d.rentNote=row.rent_note||''; d.rented=row.rented||false;
    d.waterPrice=row.water_price||''; d.waterPrevReading=row.water_prev||'';
    d.waterCurrReading=row.water_curr||'';
    d.elecPrice=row.elec_price||''; d.elecPrevReading=row.elec_prev||'';
    d.elecCurrReading=row.elec_curr||'';
    d.netFee=row.net_fee||'';
    d.otherFee=row.other_fee||''; d.otherFeeNote=row.other_fee_note||'';
    d.depositAmount=row.deposit_amount||''; d.depositDate=row.deposit_date||'';
    d.depositNote=row.deposit_note||'';
    d.rentRemindDay=row.remind_day||0; d.rentRemindEnabled=row.remind_enabled||false;
    d.actualPaid=row.actual_paid||'';
    d.totalArrears=row.total_arrears||'0';
    d.lastPaidMonth=row.last_paid_month||'';
    d._cloudTime=new Date(row.updated_at).getTime();
    return d;
  }

  // ---- 本地数据迁移 ----
  function migrateToCloud() {
    if (localStorage.getItem('cloud_migrated')) return;
    var local = loadLocal();
    var keys = Object.keys(local);
    if (!keys.length) { localStorage.setItem('cloud_migrated','true'); return; }

    _log('🔄 迁移本地数据到云端 ('+keys.length+' 条)…');
    setSync('syncing');

    var client = sb();
    if (!client) return;

    // 逐条迁移（含图片）
    keys.reduce(function(chain, k) {
      return chain.then(function() {
        var d = local[k];
        return readLocalImages(k).then(function(imgs) {
          var row = dataToRow(d);
          row.building = d.building; row.room = d.room;
          row.id_front = imgs[0] || '';
          row.id_back  = imgs[1] || '';
          return client.from('rooms').upsert(row, {onConflict:'building,room'});
        });
      });
    }, Promise.resolve()).then(function() {
      _log('✅ 迁移完成，上传 '+keys.length+' 条');
      localStorage.setItem('cloud_migrated','true');
      setSync('synced');
    }).catch(function(e){ _log('❌ 迁移异常: '+e.message,'err'); setSync('error'); });
  }

  // ---- 暴露 API ----
  window.LandlordAuth = {
    ensureLogin: ensureLogin,
    pullFromCloud: pullFromCloud,
    pushRoom: pushRoom,
    deleteRoom: deleteRoom,
    migrateToCloud: migrateToCloud,
    setSync: setSync,
  };

})();
