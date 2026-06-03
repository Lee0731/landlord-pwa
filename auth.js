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

  function pullFromCloud() {
    var client = sb();
    if (!client) return;
    setSync('syncing'); _log('☁ 拉取云端数据…');

    client.from('rooms').select('*').then(function(r) {
      if (r.error) { _log('❌ 拉取: '+r.error.message,'err'); setSync('error'); return; }
      var rows = r.data||[];
      _log('☁ 拉到 '+rows.length+' 条');

      var local = loadLocal(), changed = false;

      // 云端 → 本地
      rows.forEach(function(row) {
        var key = row.building+'-'+row.room;
        var cloudT = new Date(row.updated_at).getTime();
        var localT = (local[key]&&local[key]._cloudTime)||0;
        if (cloudT > localT) { local[key]=rowToData(row,local[key]); changed=true; }
      });

      // 本地有但云端没有 → 补上传
      var cloudSet = {};
      rows.forEach(function(row) { cloudSet[row.building+'-'+row.room] = true; });

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
        var rows2 = needPush.map(function(d) {
          var row = dataToRow(d);
          row.building = d.building; row.room = d.room;
          return row;
        });
        client.from('rooms').upsert(rows2, {onConflict:'building,room'}).then(function(r2) {
          if (r2.error) { _log('❌ 补传: '+r2.error.message,'err'); }
          else { _log('✅ 补传 '+needPush.length+' 条完成'); }
        }).catch(function(e){ _log('❌ 补传异常: '+e.message,'err'); });
      }

      if (changed) { saveLocal(local); _log('☁ 本地已更新'); }
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

    client.from('rooms').upsert(row, {onConflict:'building,room'}).then(function(r) {
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
    if (!client) return;
    _log('☁ 删除 '+building+'-'+room);
    client.from('rooms').delete().eq('building',building).eq('room',room)
      .then(function(r) {
        if(r.error) _log('❌ 删除: '+r.error.message,'err');
        else _log('☁ 已从云端删除');
      }).catch(function(e){ _log('❌ 删除异常: '+e.message,'err'); });
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
      deposit_amount: d.depositAmount||'', deposit_date: d.depositDate||'',
      deposit_note: d.depositNote||'',
      remind_day: d.rentRemindDay||0, remind_enabled: d.rentRemindEnabled||false,
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
    d.depositAmount=row.deposit_amount||''; d.depositDate=row.deposit_date||'';
    d.depositNote=row.deposit_note||'';
    d.rentRemindDay=row.remind_day||0; d.rentRemindEnabled=row.remind_enabled||false;
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

    var rows = keys.map(function(k) {
      var d = local[k], row = dataToRow(d);
      row.building=d.building; row.room=d.room;
      return row;
    });

    var client = sb();
    if (!client) return;

    client.from('rooms').upsert(rows, {onConflict:'building,room'}).then(function(r) {
      if(r.error){ _log('❌ 迁移: '+r.error.message,'err'); setSync('error'); return; }
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
