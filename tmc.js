(function () {

  // ============================================================
  // 1. SINGLETON
  // ============================================================
  var PANEL_ID = '__TMC_MONITOR_PANEL__';
  var existing = document.getElementById(PANEL_ID);
  if (existing) {
    existing.style.display = existing.style.display === 'none' ? 'flex' : 'none';
    return;
  }

  // ============================================================
  // 2. CONSTANTES
  // ============================================================
  var PREFS_KEY   = '__TMC_PREFS__';
  var BASE_URL    = 'https://envios.adminml.com';
  var DISPATCH_EP = BASE_URL + '/logistics/last-mile/monitoring/frm-provider/api/dispatch';
  var BASES       = ['SRJ1','SRJ3','SRJ5','SRJ7','SRJ8','SRJ10','SES1','SES2'];
  var CICLOS      = ['AM1','PM1','SD','CHP'];
  var AR_INTERVAL = 60;

  // ============================================================
  // 3. TEMA
  // ============================================================
  var T = {
    bg:      '#0d1117',
    bg2:     '#0f172a',
    border:  '#1e293b',
    grad:    'linear-gradient(135deg,#f2b705,#e6a800)',
    gradClr: '#f2b705',
    text:    '#e2e8f0',
    muted:   '#64748b',
    green:   '#22c55e',
    yellow:  '#eab308',
    red:     '#ef4444',
    purple:  '#7c3aed',
    card:    '#111827',
    shadow:  '0 25px 80px rgba(0,0,0,0.7)'
  };

  // ============================================================
  // 4. LABELS
  // ============================================================
  var L = {
    title:'⏱ TMC Monitor',
    search:'Buscar rota...',
    refresh:'🔄',
    autoRefresh:'Auto',
    next:'Próx:',
    all:'TODOS',
    tabRealtime:'⏱ Tempo Real',
    tabHistory:'📋 Histórico',
    tabStats:'📊 Stats',
    statusAll:'Todos Status',
    statusLoad:'Carregando',
    statusCustoms:'Em aduana',
    statusCount:'Contagem',
    statusDisp:'Expedido',
    statusWait:'Aguardando',
    areaAll:'Todas Áreas',
    dock:'Doca',
    cycle:'Ciclo',
    status:'Status',
    time:'Tempo',
    route:'Rota',
    lostTMC:'💀 PERDEU TMC',
    totalRoutes:'Total Rotas',
    inTMC:'No TMC',
    attention:'Atenção',
    critical:'Crítico',
    lostKPI:'Perderam',
    avgTime:'Tempo Médio',
    inTMCpct:'% No TMC',
    fetchOk:'Atualizado!',
    fetchErr:'Erro ao buscar',
    noData:'Nenhuma rota encontrada.',
    minimize:'—',
    maximize:'⛶',
    restore:'⛶',
    close:'✕'
  };

  // ============================================================
  // 5. APP GLOBAL
  // ============================================================
  var APP = {
    cardTimers: {},
    cdTimer:    null,
    dragL:      [],
    domL:       [],
    panel:      null,
    destroy: function () {
      Object.keys(APP.cardTimers).forEach(function (k) { clearInterval(APP.cardTimers[k]); });
      APP.cardTimers = {};
      if (APP.cdTimer) clearInterval(APP.cdTimer);
      APP.dragL.forEach(function (l) { l.el.removeEventListener(l.type, l.fn); });
      APP.domL.forEach(function (l)  { l.el.removeEventListener(l.type, l.fn); });
      APP.dragL = []; APP.domL = [];
      var p = document.getElementById(PANEL_ID);          if (p) p.remove();
      var s = document.getElementById(PANEL_ID + '_CSS'); if (s) s.remove();
      delete window.__TMC_MONITOR__;
    }
  };

  window.__TMC_MONITOR__ = APP;

  // ============================================================
  // 6. STATE
  // ============================================================
  var STATE = {
    facilityId:   'SRJ3',
    cicloFiltro:  '',
    statusFiltro: '',
    gaiolaFiltro: '',
    searchText:   '',
    tab:          'realtime',
    data:         [],
    fetchTs:      null,
    autoRefresh:  true,
    countdown:    AR_INTERVAL,
    loading:      false,
    minimized:    false,
    maximized:    false
  };

  // ============================================================
  // 7. HELPERS
  // ============================================================
  function pad(n) { return String(Math.floor(n)).padStart(2, '0'); }

  function formatMMSS(s) {
    if (s == null || isNaN(s)) return '--:--';
    s = Math.max(0, Math.floor(s));
    return pad(Math.floor(s / 60)) + ':' + pad(s % 60);
  }

  function esc(str) {
    return String(str || '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function mk(tag, attrs, html) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'style') el.style.cssText = attrs[k];
      else el.setAttribute(k, attrs[k]);
    });
    if (html != null) el.innerHTML = html;
    return el;
  }

  function $(sel, ctx)  { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); }

  function on(el, type, fn) {
    if (!el) return;
    el.addEventListener(type, fn);
    APP.domL.push({ el: el, type: type, fn: fn });
  }

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '' + pad(d.getMonth() + 1) + '' + pad(d.getDate());
  }

  function todayBR() {
    var d = new Date();
    return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear();
  }

  // ============================================================
  // 8. PREFS
  // ============================================================
  function loadPrefs() {
    try {
      var p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
      if (p.facilityId) STATE.facilityId = p.facilityId;
    } catch (e) {}
  }

  function savePrefs() {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify({ facilityId: STATE.facilityId })); }
    catch (e) {}
  }

  // ============================================================
  // 9. HELPERS DE DADOS
  // ============================================================
  function cleanName(n)     { return String(n || '').replace(/^>/, '').trim(); }
  function getCycle(r)      { var p = cleanName(r.route_name).split('_'); return p.length > 1 ? p[p.length - 1] : ''; }
  function getGaiola(r)     { return cleanName(r.route_name).split('_')[0] || ''; }
  function getAreaLetter(r) { var g = getGaiola(r); return g ? g.charAt(0).toUpperCase() : ''; }
  function isActive(r)      { return !!r.process; }

  // ✅ NOVO: dispatched não conta tempo
  function isDispatched(r)  { return r.process === 'dispatched'; }

  function getElapsedSec(r) {
    if (!isActive(r) || isDispatched(r) || r.total_elapsed_time == null) return null;
    var extra = STATE.fetchTs ? (Date.now() - STATE.fetchTs) / 1000 : 0;
    return r.total_elapsed_time + extra;
  }

  function getElapsedMin(r) {
    var s = getElapsedSec(r);
    return s != null ? s / 60 : null;
  }

  function getLight(r) {
    if (isDispatched(r)) return 'dispatched';
    var m = getElapsedMin(r);
    if (m == null) return 'waiting';
    if (m >= 30)   return 'skull';
    if (m > 25)    return 'red';
    if (m >= 20)   return 'yellow';
    return 'green';
  }

  function lightColor(l) {
    return {
      green:      T.green,
      yellow:     T.yellow,
      red:        T.red,
      skull:      T.purple,
      waiting:    T.muted,
      dispatched: T.muted
    }[l] || T.muted;
  }

  function statusLabel(r) {
    if (!r.process) return L.statusWait;
    return {
      loading_packages:    L.statusLoad,
      customs_in_progress: L.statusCustoms,
      carrier_counting:    L.statusCount,
      dispatched:          L.statusDisp
    }[r.process] || r.process;
  }

  function statusColor(r) {
    if (!r.process) return T.muted;
    return {
      loading_packages:    '#3b82f6',
      customs_in_progress: '#f59e0b',
      carrier_counting:    '#8b5cf6',
      dispatched:          T.green
    }[r.process] || '#94a3b8';
  }

  function areaLetters(data) {
    var m = {};
    data.forEach(function (r) { m[getAreaLetter(r)] = 1; });
    return Object.keys(m).filter(Boolean).sort();
  }

  // ============================================================
  // 10. TOAST
  // ============================================================
  function toast(msg, err) {
    var old = document.getElementById('__tmc_toast__');
    if (old) old.remove();
    var d = mk('div', {
      id: '__tmc_toast__',
      style: 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);'
        + 'background:' + (err ? T.red : T.green) + ';color:#fff;padding:10px 22px;'
        + 'border-radius:8px;font-size:14px;font-weight:600;z-index:2147483648;'
        + 'box-shadow:0 4px 20px rgba(0,0,0,.4);transition:opacity .3s'
    }, esc(msg));
    document.body.appendChild(d);
    setTimeout(function () {
      d.style.opacity = '0';
      setTimeout(function () { if (d.parentNode) d.remove(); }, 400);
    }, 3000);
  }

  // ============================================================
  // 11. FETCH COM RETRY
  // ============================================================
  function tfetch(url, attempt) {
    attempt = attempt || 0;
    return fetch(url, { credentials: 'include' })
      .then(function (res) {
        if (res.status === 429 && attempt < 3) {
          return new Promise(function (resolve, reject) {
            setTimeout(function () {
              tfetch(url, attempt + 1).then(resolve).catch(reject);
            }, [1000, 2000, 4000][attempt] || 4000);
          });
        }
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      });
  }

  // ============================================================
  // 12. FETCH DISPATCH
  // ============================================================
  function makeGroupId(fac, ciclo, wave) {
    return fac + '_' + todayStr() + '_' + ciclo + '_' + wave;
  }

  function fetchDispatch(fac, ciclo, wave) {
    var url = DISPATCH_EP
      + '?facilityId=' + encodeURIComponent(fac)
      + '&groupId='    + encodeURIComponent(makeGroupId(fac, ciclo, wave))
      + '&siteId=MLB'
      + '&wave='       + encodeURIComponent(wave);
    return tfetch(url)
      .then(function (d) {
        if (Array.isArray(d))               return d;
        if (d && Array.isArray(d.routes))   return d.routes;
        if (d && Array.isArray(d.dispatches)) return d.dispatches;
        return [];
      })
      .catch(function () { return []; });
  }

  function fetchAll() {
    if (STATE.loading) return;
    STATE.loading = true;
    updateLoadingUI(true);

    var fac = STATE.facilityId, ts = Date.now(), all = [];
    var promises = [];

    CICLOS.forEach(function (ciclo) {
      [0, 1].forEach(function (wave) {
        promises.push(
          fetchDispatch(fac, ciclo, wave)
            .then(function (arr) { arr.forEach(function (r) { all.push(r); }); })
        );
      });
    });

    Promise.all(promises)
      .then(function () {
        var seen = {}, dedup = [];
        all.forEach(function (r, i) {
          var k = r.route_id != null ? String(r.route_id) : ('_' + i);
          if (!seen[k]) { seen[k] = 1; dedup.push(r); }
        });
        STATE.data    = dedup;
        STATE.fetchTs = ts;
        STATE.loading = false;
        updateLoadingUI(false);
        resetCD();
        render();
        toast(L.fetchOk + ' (' + dedup.length + ' rotas)', false);
      })
      .catch(function (e) {
        STATE.loading = false;
        updateLoadingUI(false);
        toast(L.fetchErr, true);
        console.error('[TMC]', e);
      });
  }

  // ============================================================
  // 13. FILTROS + KPIs
  // ============================================================
  function applyFilters(data) {
    return data.filter(function (r) {
      if (STATE.searchText) {
        if (cleanName(r.route_name).toLowerCase().indexOf(STATE.searchText.toLowerCase()) < 0) return false;
      }
      if (STATE.cicloFiltro && getCycle(r) !== STATE.cicloFiltro) return false;
      if (STATE.statusFiltro) {
        if (STATE.statusFiltro === 'waiting' && isActive(r))                     return false;
        if (STATE.statusFiltro !== 'waiting' && r.process !== STATE.statusFiltro) return false;
      }
      if (STATE.gaiolaFiltro && getAreaLetter(r) !== STATE.gaiolaFiltro) return false;
      return true;
    });
  }

  function calcKPIs(data) {
    // ✅ Exclui dispatched dos KPIs de tempo
    var active = data.filter(function (r) { return !isDispatched(r); });
    var total = data.length, green = 0, yellow = 0, red = 0, skull = 0, sum = 0, cnt = 0;
    active.forEach(function (r) {
      var l = getLight(r);
      if (l === 'green')       green++;
      else if (l === 'yellow') yellow++;
      else if (l === 'red')    red++;
      else if (l === 'skull')  skull++;
      var s = getElapsedSec(r);
      if (s != null) { sum += s; cnt++; }
    });
    return { total: total, green: green, yellow: yellow, red: red, skull: skull, avg: cnt ? sum / cnt : 0 };
  }

  // ============================================================
  // 14. TIMERS DOS CARDS
  // ============================================================
  function stopTimers() {
    Object.keys(APP.cardTimers).forEach(function (k) { clearInterval(APP.cardTimers[k]); });
    APP.cardTimers = {};
  }

  function startTimer(r) {
    // ✅ Não inicia timer para dispatched
    if (isDispatched(r)) return;
    var key = r.route_id != null ? String(r.route_id) : cleanName(r.route_name);
    if (APP.cardTimers[key]) clearInterval(APP.cardTimers[key]);
    APP.cardTimers[key] = setInterval(function () {
      var te = document.getElementById('__tmc_timer_' + key + '__');
      var be = document.getElementById('__tmc_bar_'   + key + '__');
      var le = document.getElementById('__tmc_lost_'  + key + '__');
      if (!te) { clearInterval(APP.cardTimers[key]); delete APP.cardTimers[key]; return; }
      var sec = getElapsedSec(r);
      var l   = getLight(r);
      var clr = lightColor(l);
      te.textContent = formatMMSS(sec);
      te.style.color = clr;
      if (be) be.style.background = clr;
      if (le) le.style.display = (l === 'skull' || l === 'red') ? 'block' : 'none';
    }, 1000);
  }

  function startTimers(routes) {
    stopTimers();
    routes.forEach(function (r) { if (isActive(r) && !isDispatched(r)) startTimer(r); });
  }

  // ============================================================
  // 15. LOADING UI
  // ============================================================
  function updateLoadingUI(loading) {
    var s   = $('#__tmc_spinner__');     if (s)   s.style.display   = loading ? 'inline-block' : 'none';
    var btn = $('#__tmc_refresh_btn__'); if (btn) btn.disabled = loading;
  }

  // ============================================================
  // 16. AUTO-REFRESH
  // ============================================================
  function resetCD() {
    STATE.countdown = AR_INTERVAL;
    var e = $('#__tmc_countdown__');
    if (e) e.textContent = L.next + ' ' + STATE.countdown + 's';
  }

  function startAR() {
    if (APP.cdTimer) clearInterval(APP.cdTimer);
    APP.cdTimer = setInterval(function () {
      if (!STATE.autoRefresh || STATE.loading) return;
      STATE.countdown--;
      var e = $('#__tmc_countdown__');
      if (e) e.textContent = L.next + ' ' + STATE.countdown + 's';
      if (STATE.countdown <= 0) { resetCD(); fetchAll(); }
    }, 1000);
  }

  // ============================================================
  // 17. MAXIMIZE / RESTORE
  // ============================================================
  function applySize() {
    var panel = APP.panel;
    if (!panel) return;
    var btn = $('#__tmc_maximize__', panel);
    if (STATE.maximized) {
      panel.style.top    = '0';
      panel.style.left   = '0';
      panel.style.right  = '0';
      panel.style.bottom = '0';
      panel.style.width  = '100vw';
      panel.style.maxHeight = '100vh';
      panel.style.height = '100vh';
      panel.style.borderRadius = '0';
      if (btn) btn.textContent = '🗗';
    } else {
      panel.style.top    = '16px';
      panel.style.left   = 'auto';
      panel.style.right  = '16px';
      panel.style.bottom = 'auto';
      panel.style.width  = '720px';
      panel.style.maxHeight = '90vh';
      panel.style.height = '';
      panel.style.borderRadius = '14px';
      if (btn) btn.textContent = '⛶';
    }
  }

  // ============================================================
  // 18. RENDER TEMPO REAL
  // ✅ Dispatched NÃO aparece aqui
  // ============================================================
  function renderRealtime(filtered) {
    var p = $('#__tmc_tab_realtime__');
    if (!p) return;

    // ✅ Remove dispatched da aba Tempo Real
    var sem_disp = filtered.filter(function (r) { return !isDispatched(r); });

    var active  = sem_disp.filter(isActive).sort(function (a, b) {
      return (getElapsedSec(b) || 0) - (getElapsedSec(a) || 0);
    });
    var waiting = sem_disp.filter(function (r) { return !isActive(r); });
    var sorted  = active.concat(waiting);

    if (!sorted.length) {
      p.innerHTML = '<div style="color:' + T.muted + ';text-align:center;padding:40px;font-size:14px">'
        + L.noData + '</div>';
      return;
    }

    // Grid: 3 colunas normal, 4 colunas se maximizado
    var cols = STATE.maximized ? 'repeat(4,1fr)' : 'repeat(3,1fr)';
    var html = '<div style="display:grid;grid-template-columns:' + cols + ';gap:12px;padding:14px">';

    sorted.forEach(function (r) {
      var key       = r.route_id != null ? String(r.route_id) : cleanName(r.route_name);
      var light     = getLight(r);
      var clr       = lightColor(light);
      var sec       = getElapsedSec(r);
      var timerTxt  = isActive(r) ? formatMMSS(sec) : '--:--';
      var timerClr  = isActive(r) ? clr : T.muted;
      var sClr      = statusColor(r);
      var sLbl      = statusLabel(r);
      var showAlert = (light === 'skull' || light === 'red');
      var alertTxt  = light === 'skull' ? L.lostTMC : '⚠️ Acima 25min';
      var alertClr  = light === 'skull' ? T.purple  : T.red;

      html += '<div id="__tmc_card_' + esc(key) + '__" style="'
        + 'background:' + T.card + ';border-radius:10px;'
        + 'border-left:3px solid ' + clr + ';overflow:hidden;'
        + 'box-shadow:0 2px 12px rgba(0,0,0,.4)">'
        + '<div id="__tmc_bar_' + esc(key) + '__" style="height:3px;background:' + clr + '"></div>'
        + '<div style="padding:10px 12px">'
        + '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">'
        + '<div>'
        + '<div style="font-size:14px;font-weight:700;color:' + T.text + '">' + esc(cleanName(r.route_name)) + '</div>'
        + '<div style="font-size:11px;color:' + T.muted + ';margin-top:1px">' + L.dock + ' ' + esc(String(r.dock_number != null ? r.dock_number : '--')) + '</div>'
        + '</div>'
        + '<div id="__tmc_timer_' + esc(key) + '__" style="font-size:22px;font-weight:800;color:' + timerClr + ';font-variant-numeric:tabular-nums;line-height:1">'
        + timerTxt + '</div>'
        + '</div>'
        + '<div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap">'
        + '<span style="font-size:10px;background:#1e293b;color:' + T.gradClr + ';border-radius:4px;padding:2px 7px;font-weight:700">' + esc(getCycle(r)) + '</span>'
        + '<span style="font-size:10px;background:' + sClr + '22;color:' + sClr + ';border-radius:4px;padding:2px 7px;font-weight:600;border:1px solid ' + sClr + '44">' + sLbl + '</span>'
        + '</div>'
        + '<div id="__tmc_lost_' + esc(key) + '__" style="display:' + (showAlert ? 'block' : 'none') + ';margin-top:7px;font-size:11px;font-weight:700;color:' + alertClr + ';animation:tmcPulse 1s ease-in-out infinite">' + alertTxt + '</div>'
        + '</div></div>';
    });

    html += '</div>';
    p.innerHTML = html;
    startTimers(sorted);
  }

  // ============================================================
  // 19. RENDER HISTÓRICO
  // ✅ Dispatched APARECE aqui (registro)
  // ============================================================
  function renderHistorico(filtered) {
    var p = $('#__tmc_tab_history__');
    if (!p) return;

    var sorted = filtered.slice().sort(function (a, b) {
      return (getElapsedSec(b) || 0) - (getElapsedSec(a) || 0);
    });

    if (!sorted.length) {
      p.innerHTML = '<div style="color:' + T.muted + ';text-align:center;padding:40px">' + L.noData + '</div>';
      return;
    }

    var th = 'padding:8px 12px;text-align:left;font-size:11px;color:' + T.muted + ';border-bottom:1px solid ' + T.border + ';white-space:nowrap;font-weight:600';
    var td = 'padding:8px 12px;font-size:13px;border-bottom:1px solid ' + T.border + '33';

    var html = '<div style="overflow:auto">'
      + '<table style="width:100%;border-collapse:collapse">'
      + '<thead><tr style="background:#0a0e1a">'
      + '<th style="' + th + '">' + L.route  + '</th>'
      + '<th style="' + th + '">' + L.dock   + '</th>'
      + '<th style="' + th + '">' + L.cycle  + '</th>'
      + '<th style="' + th + '">' + L.status + '</th>'
      + '<th style="' + th + '">' + L.time   + '</th>'
      + '<th style="' + th + '">🚦</th>'
      + '</tr></thead><tbody>';

    sorted.forEach(function (r) {
      var light = getLight(r);
      var clr   = lightColor(light);
      var sec   = getElapsedSec(r);
      var sClr  = statusColor(r);
      // ✅ Dispatched mostra "Expedido" com ícone ✅ e sem tempo
      var timeStr = isDispatched(r) ? '<span style="color:' + T.green + '">✅ Expedido</span>' : '<span style="color:' + clr + ';font-weight:700;font-variant-numeric:tabular-nums">' + formatMMSS(sec) + '</span>';

      html += '<tr onmouseover="this.style.background=\'#1e293b\'" onmouseout="this.style.background=\'transparent\'">'
        + '<td style="' + td + ';font-weight:600;color:' + T.text + '">' + esc(cleanName(r.route_name)) + '</td>'
        + '<td style="' + td + ';color:' + T.muted + '">' + esc(String(r.dock_number != null ? r.dock_number : '--')) + '</td>'
        + '<td style="' + td + '"><span style="font-size:10px;background:#1e293b;color:' + T.gradClr + ';border-radius:4px;padding:2px 6px;font-weight:700">' + esc(getCycle(r)) + '</span></td>'
        + '<td style="' + td + ';color:' + sClr + ';font-weight:600">' + statusLabel(r) + '</td>'
        + '<td style="' + td + '">' + timeStr + '</td>'
        + '<td style="' + td + '"><span style="display:inline-block;width:11px;height:11px;border-radius:50%;background:' + clr + '"></span></td>'
        + '</tr>';
    });

    html += '</tbody></table></div>';
    p.innerHTML = html;
  }

  // ============================================================
  // 20. RENDER STATS
  // ============================================================
  function renderStats(filtered) {
    var p = $('#__tmc_tab_stats__');
    if (!p) return;

    var kpi    = calcKPIs(filtered);
    var groups = {};
    // ✅ Stats também exclui dispatched do tempo
    filtered.filter(function(r){ return !isDispatched(r); }).forEach(function (r) {
      var c = getCycle(r) || '—';
      if (!groups[c]) groups[c] = [];
      groups[c].push(r);
    });

    var cs   = 'background:' + T.card + ';border-radius:10px;padding:14px;text-align:center';
    var html = '<div style="padding:12px;overflow:auto">';

    html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px">';
    [
      { l: L.totalRoutes, v: kpi.total,           c: T.text    },
      { l: L.inTMC,       v: kpi.green,           c: T.green   },
      { l: L.attention,   v: kpi.yellow,          c: T.yellow  },
      { l: L.critical,    v: kpi.red,             c: T.red     },
      { l: L.lostKPI,     v: kpi.skull,           c: T.purple  },
      { l: L.avgTime,     v: formatMMSS(kpi.avg), c: T.gradClr }
    ].forEach(function (k) {
      html += '<div style="' + cs + '">'
        + '<div style="font-size:26px;font-weight:800;color:' + k.c + '">' + esc(String(k.v)) + '</div>'
        + '<div style="font-size:11px;color:' + T.muted + ';margin-top:4px">' + k.l + '</div>'
        + '</div>';
    });
    html += '</div>';

    var cycleKeys = Object.keys(groups).sort();
    if (cycleKeys.length) {
      html += '<div style="font-size:11px;color:' + T.muted + ';font-weight:700;letter-spacing:.5px;margin-bottom:8px">POR CICLO</div>';
      html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">';
      cycleKeys.forEach(function (c) {
        var arr = groups[c];
        var ck  = calcKPIs(arr);
        var pct = ck.total ? Math.round(ck.green / ck.total * 100) : 0;
        var bc  = pct >= 80 ? T.green : pct >= 50 ? T.yellow : T.red;

        html += '<div style="' + cs + ';text-align:left">'
          + '<div style="font-size:14px;font-weight:700;color:' + T.gradClr + ';margin-bottom:8px">' + esc(c) + '</div>'
          + '<div style="font-size:12px;color:' + T.muted + '">Total: <b style="color:' + T.text + '">' + ck.total + '</b></div>'
          + '<div style="font-size:12px;color:' + T.muted + ';margin-top:2px">' + L.avgTime + ': <b style="color:' + T.gradClr + '">' + formatMMSS(ck.avg) + '</b></div>'
          + '<div style="font-size:12px;color:' + T.muted + ';margin-top:2px">' + L.inTMCpct + ': <b style="color:' + bc + '">' + pct + '%</b></div>'
          + '<div style="margin-top:8px;background:' + T.border + ';border-radius:4px;height:6px;overflow:hidden">'
          + '<div style="height:100%;width:' + pct + '%;background:' + bc + ';border-radius:4px;transition:width .4s"></div>'
          + '</div></div>';
      });
      html += '</div>';
    }

    html += '</div>';
    p.innerHTML = html;
  }

  // ============================================================
  // 21. RENDER PRINCIPAL
  // ============================================================
  function render() {
    var filtered = applyFilters(STATE.data);
    var kpi      = calcKPIs(filtered);

    var kb = $('#__tmc_kpi_bar__');
    if (kb) {
      kb.innerHTML = ''
        + '<span style="color:' + T.muted + '">Total: <b style="color:' + T.text + '">' + kpi.total + '</b></span> '
        + '<span style="color:' + T.green  + '">🟢 ' + kpi.green  + '</span> '
        + '<span style="color:' + T.yellow + '">🟡 ' + kpi.yellow + '</span> '
        + '<span style="color:' + T.red    + '">🔴 ' + kpi.red    + '</span> '
        + '<span style="color:' + T.purple + '">💀 ' + kpi.skull  + '</span>';
    }

    var as = $('#__tmc_area_select__');
    if (as) {
      var cur  = STATE.gaiolaFiltro;
      var opts = '<option value="">' + L.areaAll + '</option>'
        + areaLetters(STATE.data).map(function (l) {
            return '<option value="' + l + '"' + (cur === l ? ' selected' : '') + '>' + l + '</option>';
          }).join('');
      as.innerHTML = opts;
    }

    if      (STATE.tab === 'realtime') renderRealtime(filtered);
    else if (STATE.tab === 'history')  renderHistorico(filtered);
    else if (STATE.tab === 'stats')    renderStats(filtered);
  }

  // ============================================================
  // 22. CSS
  // ============================================================
  function injectStyles() {
    if (document.getElementById(PANEL_ID + '_CSS')) return;
    var css = [
      '@keyframes tmcPulse { 0%,100%{opacity:1} 50%{opacity:.2} }',
      '#' + PANEL_ID + ' * { box-sizing:border-box; font-family:system-ui,-apple-system,sans-serif }',
      '#' + PANEL_ID + ' ::-webkit-scrollbar { width:6px; height:6px }',
      '#' + PANEL_ID + ' ::-webkit-scrollbar-track { background:' + T.bg2 + ' }',
      '#' + PANEL_ID + ' ::-webkit-scrollbar-thumb { background:' + T.border + '; border-radius:3px }',
      '#' + PANEL_ID + ' ::-webkit-scrollbar-thumb:hover { background:#334155 }',
      '#' + PANEL_ID + ' button { cursor:pointer }',
      '#' + PANEL_ID + ' button:hover { filter:brightness(1.2) }',
      '#' + PANEL_ID + ' input, #' + PANEL_ID + ' select { background:' + T.bg + ';color:' + T.text + ';border:1px solid ' + T.border + ';border-radius:6px;padding:5px 8px;font-size:12px;outline:none }',
      '#' + PANEL_ID + ' input:focus, #' + PANEL_ID + ' select:focus { border-color:' + T.gradClr + ' }'
    ].join('\n');
    document.head.appendChild(mk('style', { id: PANEL_ID + '_CSS', type: 'text/css' }, css));
  }

  // ============================================================
  // 23. BUILD HTML
  // ============================================================
  function buildPanelHTML() {
    var inp = 'background:' + T.bg + ';color:' + T.text + ';border:1px solid ' + T.border + ';border-radius:6px;padding:5px 8px;font-size:12px;outline:none';

    var cycleBar = ['', 'AM1', 'PM1', 'SD', 'CHP'].map(function (c) {
      var act = STATE.cicloFiltro === c;
      var lbl = c === '' ? L.all : c;
      return '<button data-cycle="' + c + '" style="border:none;border-radius:6px;padding:5px 13px;font-size:12px;font-weight:700;background:' + (act ? T.gradClr : T.border) + ';color:' + (act ? '#000' : '#94a3b8') + '">' + lbl + '</button>';
    }).join('');

    var statusOpts = [
      ['', L.statusAll],
      ['loading_packages',    L.statusLoad],
      ['customs_in_progress', L.statusCustoms],
      ['carrier_counting',    L.statusCount],
      ['dispatched',          L.statusDisp],
      ['waiting',             L.statusWait]
    ].map(function (o) {
      return '<option value="' + o[0] + '"' + (STATE.statusFiltro === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
    }).join('');

    var baseOpts = BASES.map(function (b) {
      return '<option value="' + b + '"' + (STATE.facilityId === b ? ' selected' : '') + '>' + b + '</option>';
    }).join('');

    function tabBtn(key, lbl) {
      var act = STATE.tab === key;
      return '<button data-tab="' + key + '" style="border:none;padding:8px 16px;font-size:13px;font-weight:700;border-radius:6px 6px 0 0;background:' + (act ? T.gradClr : 'transparent') + ';color:' + (act ? '#000' : '#64748b') + '">' + lbl + '</button>';
    }

    return ''
      // HEADER
      + '<div id="__tmc_header__" style="background:' + T.grad + ';padding:10px 14px;display:flex;justify-content:space-between;align-items:center;border-radius:14px 14px 0 0;cursor:grab;user-select:none;flex-shrink:0">'
      + '<div style="display:flex;align-items:center;gap:10px">'
      + '<span style="font-size:15px;font-weight:800;color:#000">' + L.title + '</span>'
      + '<span style="background:#00000025;color:#000;border-radius:5px;padding:2px 9px;font-size:12px;font-weight:700">' + STATE.facilityId + '</span>'
      + '<span style="font-size:11px;color:#00000070">' + todayBR() + '</span>'
      + '<span id="__tmc_spinner__" style="display:none;width:13px;height:13px;border:2px solid #00000025;border-top-color:#000;border-radius:50%;animation:tmcPulse .6s linear infinite"></span>'
      + '</div>'
      + '<div style="display:flex;gap:4px;align-items:center">'
      // ✅ Botão minimizar
      + '<button id="__tmc_minimize__" title="Minimizar" style="background:transparent;border:none;font-size:16px;color:#000;padding:2px 7px;border-radius:4px">' + L.minimize + '</button>'
      // ✅ Botão maximizar
      + '<button id="__tmc_maximize__" title="Maximizar" style="background:transparent;border:none;font-size:16px;color:#000;padding:2px 7px;border-radius:4px">⛶</button>'
      // Fechar
      + '<button id="__tmc_close__" title="Fechar" style="background:transparent;border:none;font-size:16px;color:#000;padding:2px 7px;border-radius:4px">' + L.close + '</button>'
      + '</div></div>'

      // BODY
      + '<div id="__tmc_body__" style="display:' + (STATE.minimized ? 'none' : 'flex') + ';flex-direction:column;flex:1;overflow:hidden">'

      // CONTROLES
      + '<div style="background:' + T.bg2 + ';padding:10px 12px;border-bottom:1px solid ' + T.border + ';flex-shrink:0">'
      + '<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap">'
      + '<input id="__tmc_search__" type="text" placeholder="' + L.search + '" value="' + esc(STATE.searchText) + '" style="' + inp + ';flex:1;min-width:120px">'
      + '<select id="__tmc_base_select__" style="' + inp + '">' + baseOpts + '</select>'
      + '<button id="__tmc_refresh_btn__" style="background:' + T.border + ';border:none;color:' + T.text + ';border-radius:6px;padding:6px 12px;font-size:14px">' + L.refresh + '</button>'
      + '<label style="display:flex;align-items:center;gap:5px;font-size:12px;color:' + T.muted + ';cursor:pointer"><input id="__tmc_ar_cb__" type="checkbox"' + (STATE.autoRefresh ? ' checked' : '') + '> ' + L.autoRefresh + '</label>'
      + '<span id="__tmc_countdown__" style="font-size:11px;color:' + T.muted + ';white-space:nowrap">' + L.next + ' ' + STATE.countdown + 's</span>'
      + '</div>'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">' + cycleBar + '</div>'
      + '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">'
      + '<select id="__tmc_status_select__" style="' + inp + '">' + statusOpts + '</select>'
      + '<select id="__tmc_area_select__" style="' + inp + '"><option value="">' + L.areaAll + '</option></select>'
      + '<span id="__tmc_kpi_bar__" style="font-size:12px;margin-left:auto;display:flex;gap:10px;align-items:center"></span>'
      + '</div></div>'

      // ABAS
      + '<div style="background:' + T.bg2 + ';padding:0 12px;display:flex;gap:4px;border-bottom:1px solid ' + T.border + ';flex-shrink:0">'
      + tabBtn('realtime', L.tabRealtime)
      + tabBtn('history',  L.tabHistory)
      + tabBtn('stats',    L.tabStats)
      + '</div>'

      // CONTEÚDO
      + '<div style="flex:1;overflow:auto">'
      + '<div id="__tmc_tab_realtime__" style="display:' + (STATE.tab === 'realtime' ? 'block' : 'none') + '"></div>'
      + '<div id="__tmc_tab_history__"  style="display:' + (STATE.tab === 'history'  ? 'block' : 'none') + '"></div>'
      + '<div id="__tmc_tab_stats__"    style="display:' + (STATE.tab === 'stats'    ? 'block' : 'none') + '"></div>'
      + '</div>'
      + '</div>';
  }

  // ============================================================
  // 24. DRAG
  // ============================================================
  function enableDrag(panel) {
    var header = $('#__tmc_header__', panel);
    if (!header) return;
    var dragging = false, ox = 0, oy = 0;
    function md(e) {
      if (e.target.tagName === 'BUTTON' || STATE.maximized) return;
      dragging = true;
      ox = e.clientX - panel.offsetLeft;
      oy = e.clientY - panel.offsetTop;
      header.style.cursor = 'grabbing';
      e.preventDefault();
    }
    function mm(e) {
      if (!dragging) return;
      var x = Math.max(0, Math.min(e.clientX - ox, window.innerWidth  - panel.offsetWidth));
      var y = Math.max(0, Math.min(e.clientY - oy, window.innerHeight - panel.offsetHeight));
      panel.style.left  = x + 'px';
      panel.style.top   = y + 'px';
      panel.style.right = 'auto';
    }
    function mu() { dragging = false; header.style.cursor = 'grab'; }
    header.addEventListener('mousedown', md);
    document.addEventListener('mousemove', mm);
    document.addEventListener('mouseup', mu);
    APP.dragL.push({ el: header,   type: 'mousedown', fn: md });
    APP.dragL.push({ el: document, type: 'mousemove', fn: mm });
    APP.dragL.push({ el: document, type: 'mouseup',   fn: mu });
  }

  // ============================================================
  // 25. EVENTOS
  // ============================================================
  function attachEvents(panel) {
    on($('#__tmc_close__',    panel), 'click', function () { APP.destroy(); });

    // Minimizar
    on($('#__tmc_minimize__', panel), 'click', function () {
      STATE.minimized = !STATE.minimized;
      var b = $('#__tmc_body__', panel);
      if (b) b.style.display = STATE.minimized ? 'none' : 'flex';
    });

    // ✅ Maximizar / Restaurar
    on($('#__tmc_maximize__', panel), 'click', function () {
      STATE.maximized = !STATE.maximized;
      applySize();
      render(); // re-renderiza com grid atualizado
    });

    on($('#__tmc_search__',      panel), 'input',  function (e) { STATE.searchText = e.target.value; render(); });
    on($('#__tmc_base_select__', panel), 'change', function (e) { STATE.facilityId = e.target.value; savePrefs(); fetchAll(); });
    on($('#__tmc_refresh_btn__', panel), 'click',  function ()  { resetCD(); fetchAll(); });
    on($('#__tmc_ar_cb__',       panel), 'change', function (e) { STATE.autoRefresh = e.target.checked; if (STATE.autoRefresh) resetCD(); });

    $$('[data-cycle]', panel).forEach(function (btn) {
      on(btn, 'click', function () {
        STATE.cicloFiltro = btn.getAttribute('data-cycle');
        $$('[data-cycle]', panel).forEach(function (b) {
          var act = b.getAttribute('data-cycle') === STATE.cicloFiltro;
          b.style.background = act ? T.gradClr : T.border;
          b.style.color      = act ? '#000' : '#94a3b8';
        });
        render();
      });
    });

    on($('#__tmc_status_select__', panel), 'change', function (e) { STATE.statusFiltro = e.target.value; render(); });
    on($('#__tmc_area_select__',   panel), 'change', function (e) { STATE.gaiolaFiltro = e.target.value; render(); });

    $$('[data-tab]', panel).forEach(function (btn) {
      on(btn, 'click', function () {
        STATE.tab = btn.getAttribute('data-tab');
        $$('[id^="__tmc_tab_"]', panel).forEach(function (p) { p.style.display = 'none'; });
        var ap = $('#__tmc_tab_' + STATE.tab + '__', panel);
        if (ap) ap.style.display = 'block';
        $$('[data-tab]', panel).forEach(function (b) {
          var act = b.getAttribute('data-tab') === STATE.tab;
          b.style.background = act ? T.gradClr : 'transparent';
          b.style.color      = act ? '#000' : '#64748b';
        });
        render();
      });
    });
  }

  // ============================================================
  // 26. CRIAR PAINEL
  // ============================================================
  function createPanel() {
    injectStyles();
    var panel = mk('div', {
      id: PANEL_ID,
      style: 'position:fixed;top:16px;right:16px;width:720px;max-height:90vh;'
        + 'background:' + T.bg + ';border:1px solid ' + T.border + ';border-radius:14px;'
        + 'box-shadow:' + T.shadow + ';z-index:2147483647;display:flex;flex-direction:column;overflow:hidden;'
        + 'transition:all .2s ease'
    });
    panel.innerHTML = buildPanelHTML();
    document.body.appendChild(panel);
    APP.panel = panel;
    enableDrag(panel);
    attachEvents(panel);
    return panel;
  }

  // ============================================================
  // 27. INIT
  // ============================================================
  function init() {
    loadPrefs();
    createPanel();
    startAR();
    render();
    fetchAll();
  }

  init();

})();