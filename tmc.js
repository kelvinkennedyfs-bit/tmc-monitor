(function () {
  'use strict';

  // ─── CONSTANTES ───────────────────────────────────────────────────────────────
  const PANEL_ID = '__TMC_PANEL__';
  const PREFS_KEY = '__TMC_PREFS__';
  const BASE_URL = 'https://logistics.adminml.com';
  const AUTO_REFRESH_S = 60;

  const FACILITY_OPTIONS = ['SRJ1', 'SRJ3', 'SRJ5', 'SRJ7', 'SRJ8', 'SRJ10', 'SES1', 'SES2'];
  const CYCLES_WITH_WAVES = ['AM1', 'AM101', 'PM1', 'PM101', 'SD101'];
  const SIMPLE_CYCLES = ['SD', 'CHP'];
  const ALL_CYCLES = [...CYCLES_WITH_WAVES, ...SIMPLE_CYCLES];

  // Semáforo em minutos
  const TMC = { green: 20, yellow: 25, lost: 30 };

  // ─── INTERNACIONALIZAÇÃO ──────────────────────────────────────────────────────
  const i18n = {
    PT: {
      title: '⏱ TMC',
      search: '🔍 Buscar rota...',
      base: 'Base',
      refresh: '🔄',
      autoRefresh: 'Auto',
      next: 'Próx',
      all: 'TODOS',
      tabRealtime: '⏱ Tempo Real',
      tabHistory: '📋 Histórico',
      tabStats: '📊 TMC Stats',
      total: 'Total',
      dock: 'Doca',
      status: 'Status',
      statusAll: 'Todos os status',
      areaAll: 'Todas as áreas',
      loading: 'Carregando dados...',
      noData: 'Nenhuma rota encontrada.',
      statusLoading: 'Carregando',
      statusCustoms: 'Em aduana',
      statusDispatched: 'Expedido',
      statusFinished: 'Finalizado',
      lostTMC: '💀 PERDEU TMC',
      colRoute: 'Rota',
      colDock: 'Doca',
      colCycle: 'Ciclo',
      colStatus: 'Status',
      colTime: 'Tempo',
      colLight: 'Semáforo',
      statsTotal: 'Total de Rotas',
      statsGreen: 'Dentro do TMC',
      statsYellow: 'Em Atenção',
      statsRed: 'Crítico',
      statsLost: 'Perderam TMC',
      statsAvg: 'Tempo Médio',
      cycleBreakdown: 'Desempenho por Ciclo',
      withinTMC: '% no TMC',
      avgTime: 'Média',
      routes: 'rotas',
      minimize: '—',
      close: '✕',
      fetching: 'Buscando...',
    },
    EN: {
      title: '⏱ TMC',
      search: '🔍 Search route...',
      base: 'Base',
      refresh: '🔄',
      autoRefresh: 'Auto',
      next: 'Next',
      all: 'ALL',
      tabRealtime: '⏱ Real Time',
      tabHistory: '📋 History',
      tabStats: '📊 TMC Stats',
      total: 'Total',
      dock: 'Dock',
      status: 'Status',
      statusAll: 'All statuses',
      areaAll: 'All areas',
      loading: 'Loading data...',
      noData: 'No routes found.',
      statusLoading: 'Loading',
      statusCustoms: 'In customs',
      statusDispatched: 'Dispatched',
      statusFinished: 'Finished',
      lostTMC: '💀 LOST TMC',
      colRoute: 'Route',
      colDock: 'Dock',
      colCycle: 'Cycle',
      colStatus: 'Status',
      colTime: 'Time',
      colLight: 'Light',
      statsTotal: 'Total Routes',
      statsGreen: 'Within TMC',
      statsYellow: 'Attention',
      statsRed: 'Critical',
      statsLost: 'Lost TMC',
      statsAvg: 'Avg Time',
      cycleBreakdown: 'Performance by Cycle',
      withinTMC: '% in TMC',
      avgTime: 'Avg',
      routes: 'routes',
      minimize: '—',
      close: '✕',
      fetching: 'Fetching...',
    },
    ES: {
      title: '⏱ TMC',
      search: '🔍 Buscar ruta...',
      base: 'Base',
      refresh: '🔄',
      autoRefresh: 'Auto',
      next: 'Próx',
      all: 'TODOS',
      tabRealtime: '⏱ Tiempo Real',
      tabHistory: '📋 Historial',
      tabStats: '📊 TMC Stats',
      total: 'Total',
      dock: 'Muelle',
      status: 'Estado',
      statusAll: 'Todos los estados',
      areaAll: 'Todas las áreas',
      loading: 'Cargando datos...',
      noData: 'No se encontraron rutas.',
      statusLoading: 'Cargando',
      statusCustoms: 'En aduana',
      statusDispatched: 'Despachado',
      statusFinished: 'Finalizado',
      lostTMC: '💀 PERDIÓ TMC',
      colRoute: 'Ruta',
      colDock: 'Muelle',
      colCycle: 'Ciclo',
      colStatus: 'Estado',
      colTime: 'Tiempo',
      colLight: 'Semáforo',
      statsTotal: 'Total de Rutas',
      statsGreen: 'Dentro del TMC',
      statsYellow: 'Atención',
      statsRed: 'Crítico',
      statsLost: 'Perdieron TMC',
      statsAvg: 'Tiempo Medio',
      cycleBreakdown: 'Rendimiento por Ciclo',
      withinTMC: '% en TMC',
      avgTime: 'Media',
      routes: 'rutas',
      minimize: '—',
      close: '✕',
      fetching: 'Buscando...',
    },
  };

  // ─── ESTADO GLOBAL ────────────────────────────────────────────────────────────
  const state = {
    facilityId: 'SRJ3',
    lang: 'PT',
    cicloFiltro: '',
    statusFiltro: '',
    gaiolaFiltro: '',
    searchText: '',
    tab: 'realtime',
    data: [],
    fetchTimestamp: null,
    autoRefresh: true,
    countdown: AUTO_REFRESH_S,
    loading: false,
    minimized: false,
    timers: {},        // { route_id: intervalId } — timers dos cards
    countdownTimer: null,
    autoRefreshTimer: null,
  };

  // ─── PREFERÊNCIAS ─────────────────────────────────────────────────────────────
  function loadPrefs() {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (p.facilityId) state.facilityId = p.facilityId;
        if (p.lang) state.lang = p.lang;
      }
    } catch (e) { /* ignora */ }
  }

  function savePrefs() {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({
        facilityId: state.facilityId,
        lang: state.lang,
      }));
    } catch (e) { /* ignora */ }
  }

  // ─── HELPERS ──────────────────────────────────────────────────────────────────

  /** Extrai o ciclo do route_name. Ex: "G11_AM1" → "AM1" */
  function getCycle(routeName) {
    if (!routeName) return '';
    const parts = routeName.split('_');
    return parts[parts.length - 1] || '';
  }

  /** Extrai a gaiola do route_name. Ex: "G11_AM1" → "G11" */
  function getGaiola(routeName) {
    if (!routeName) return '';
    const idx = routeName.lastIndexOf('_');
    return idx > -1 ? routeName.substring(0, idx) : routeName;
  }

  /** Retorna a letra inicial da área. Ex: "G11" → "G" */
  function getAreaLetter(routeName) {
    const g = getGaiola(routeName);
    return g ? g.charAt(0).toUpperCase() : '?';
  }

  /** Traduz o status do processo */
  function getStatusLabel(process) {
    const t = i18n[state.lang];
    const map = {
      loading: t.statusLoading,
      in_customs: t.statusCustoms,
      dispatched: t.statusDispatched,
      finished: t.statusFinished,
    };
    return map[process] || process;
  }

  /**
   * Calcula minutos decorridos atuais para um item.
   * total_elapsed_time (segundos snapshoted) + delta desde fetchTimestamp
   */
  function getElapsedMin(item) {
    const delta = state.fetchTimestamp
      ? (Date.now() - state.fetchTimestamp) / 1000
      : 0;
    const totalSec = (item.total_elapsed_time || 0) + delta;
    return totalSec / 60;
  }

  /** Retorna objeto com info do semáforo */
  function getTrafficLight(minutes) {
    if (minutes >= TMC.lost) {
      return { color: '#7c3aed', label: 'lost', emoji: '💀' };
    } else if (minutes > TMC.yellow) {
      return { color: '#ef4444', label: 'red', emoji: '🔴' };
    } else if (minutes >= TMC.green) {
      return { color: '#eab308', label: 'yellow', emoji: '🟡' };
    } else {
      return { color: '#22c55e', label: 'green', emoji: '🟢' };
    }
  }

  /** Formata segundos para MM:SS */
  function formatMMSS(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = Math.floor(totalSeconds % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  /** Retorna data atual no formato YYYY-MM-DD */
  function getTodayDate() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  /** Retorna data atual formatada para exibição */
  function getDisplayDate() {
    return new Date().toLocaleDateString(
      state.lang === 'PT' ? 'pt-BR' : state.lang === 'ES' ? 'es-ES' : 'en-US',
      { weekday: 'short', day: '2-digit', month: '2-digit' }
    );
  }

  // ─── FETCH ────────────────────────────────────────────────────────────────────

  /** Busca waves disponíveis para um ciclo */
  async function fetchWaves(ciclo) {
    const date = getTodayDate();
    const url = `${BASE_URL}/logistics/last-mile/monitoring/api/ops-clock/waves-status?cycleId=${ciclo}&date=${date}`;
    try {
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) return [1]; // fallback wave 1
      const json = await res.json();
      // Espera array de objetos com campo wave ou waveId
      if (Array.isArray(json) && json.length > 0) {
        // Tenta extrair número da wave
        const waves = json
          .map(w => w.wave || w.waveId || w.wave_id || 1)
          .filter((v, i, a) => a.indexOf(v) === i); // unique
        return waves.length > 0 ? waves : [1];
      }
      return [1];
    } catch (e) {
      return [1];
    }
  }

  /** Busca dispatch de uma wave específica */
  async function fetchDispatch(facilityId, ciclo, wave) {
    const url = `${BASE_URL}/logistics/last-mile/monitoring/frm-provider/api/dispatch?facilityId=${facilityId}&groupId=${ciclo}&siteId=MLB&wave=${wave}`;
    try {
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) return [];
      const json = await res.json();
      if (Array.isArray(json)) {
        // Enriquecer cada item com metadados do ciclo/wave
        return json.map(item => ({
          ...item,
          _cycle: ciclo,
          _wave: wave,
          _fetchedAt: Date.now(),
        }));
      }
      return [];
    } catch (e) {
      return [];
    }
  }

  /** Busca TODOS os ciclos e waves, retorna array flat */
  async function fetchAll() {
    if (state.loading) return;
    state.loading = true;
    updateLoadingUI(true);

    const allItems = [];
    const today = getTodayDate();

    try {
      // Ciclos com waves: busca waves-status primeiro
      for (const ciclo of CYCLES_WITH_WAVES) {
        const waves = await fetchWaves(ciclo);
        for (const wave of waves) {
          const items = await fetchDispatch(state.facilityId, ciclo, wave);
          allItems.push(...items);
        }
      }

      // Ciclos simples: dispatch direto com wave=1
      for (const ciclo of SIMPLE_CYCLES) {
        const items = await fetchDispatch(state.facilityId, ciclo, 1);
        allItems.push(...items);
      }

      // Deduplica por route_id (pega o mais recente)
      const seen = new Map();
      for (const item of allItems) {
        const key = item.route_id || item.route_name;
        if (!seen.has(key)) {
          seen.set(key, item);
        } else {
          // Mantém o com maior total_elapsed_time
          if ((item.total_elapsed_time || 0) > (seen.get(key).total_elapsed_time || 0)) {
            seen.set(key, item);
          }
        }
      }

      state.data = Array.from(seen.values());
      state.fetchTimestamp = Date.now();
    } catch (e) {
      console.error('[TMC Monitor] Erro no fetch:', e);
    } finally {
      state.loading = false;
      updateLoadingUI(false);
      render();
      resetCountdown();
    }
  }

  // ─── FILTROS ──────────────────────────────────────────────────────────────────

  /** Aplica todos os filtros ao state.data */
  function applyFilters() {
    let items = [...state.data];

    // Filtro por ciclo
    if (state.cicloFiltro) {
      const cf = state.cicloFiltro.toUpperCase();
      items = items.filter(item => {
        const cycle = getCycle(item.route_name).toUpperCase();
        if (cf === 'AM') return cycle === 'AM1' || cycle === 'AM101';
        if (cf === 'PM') return cycle === 'PM1' || cycle === 'PM101';
        if (cf === 'SD') return cycle === 'SD' || cycle === 'SD101';
        if (cf === 'CHP') return cycle === 'CHP';
        return true;
      });
    }

    // Filtro por status
    if (state.statusFiltro) {
      items = items.filter(item => item.process === state.statusFiltro);
    }

    // Filtro por área/gaiola (letra inicial)
    if (state.gaiolaFiltro) {
      items = items.filter(item =>
        getAreaLetter(item.route_name) === state.gaiolaFiltro
      );
    }

    // Filtro por texto (route_name)
    if (state.searchText) {
      const q = state.searchText.toLowerCase();
      items = items.filter(item =>
        (item.route_name || '').toLowerCase().includes(q)
      );
    }

    // Ordena por tempo decrescente (mais tempo primeiro)
    items.sort((a, b) => {
      const minA = getElapsedMin(a);
      const minB = getElapsedMin(b);
      return minB - minA;
    });

    return items;
  }

  /** Retorna lista de áreas únicas presentes nos dados */
  function getUniqueAreas() {
    const areas = new Set();
    state.data.forEach(item => areas.add(getAreaLetter(item.route_name)));
    return Array.from(areas).sort();
  }

  /** Calcula KPIs sobre os dados filtrados */
  function calcKPIs(items) {
    let green = 0, yellow = 0, red = 0, lost = 0;
    items.forEach(item => {
      const min = getElapsedMin(item);
      const tl = getTrafficLight(min);
      if (tl.label === 'green') green++;
      else if (tl.label === 'yellow') yellow++;
      else if (tl.label === 'red') red++;
      else if (tl.label === 'lost') lost++;
    });
    return { total: items.length, green, yellow, red, lost };
  }

  // ─── TIMERS DOS CARDS ─────────────────────────────────────────────────────────

  /** Para todos os timers de cards */
  function stopAllTimers() {
    Object.values(state.timers).forEach(id => clearInterval(id));
    state.timers = {};
  }

  /** Inicia timer para um card específico (atualiza apenas o elemento do timer) */
  function startCardTimer(item) {
    const key = item.route_id || item.route_name;
    // Para timer anterior se existir
    if (state.timers[key]) {
      clearInterval(state.timers[key]);
    }

    const timerEl = document.getElementById(`tmc-timer-${key}`);
    const cardEl = document.getElementById(`tmc-card-${key}`);
    if (!timerEl) return;

    const intervalId = setInterval(() => {
      const timerElNow = document.getElementById(`tmc-timer-${key}`);
      const cardElNow = document.getElementById(`tmc-card-${key}`);
      if (!timerElNow) {
        clearInterval(state.timers[key]);
        delete state.timers[key];
        return;
      }

      const min = getElapsedMin(item);
      const tl = getTrafficLight(min);
      const delta = state.fetchTimestamp
        ? (Date.now() - state.fetchTimestamp) / 1000
        : 0;
      const totalSec = (item.total_elapsed_time || 0) + delta;

      // Atualiza texto e cor do timer
      timerElNow.textContent = formatMMSS(totalSec);
      timerElNow.style.color = tl.color;

      // Atualiza barra do topo e borda do card
      if (cardElNow) {
        const topBar = cardElNow.querySelector('.tmc-card-topbar');
        if (topBar) topBar.style.background = tl.color;
        cardElNow.style.borderLeft = `3px solid ${tl.color}`;

        // Atualiza badge TMC perdido
        const lostBadge = cardElNow.querySelector('.tmc-lost-badge');
        if (min >= TMC.lost) {
          if (!lostBadge) {
            const badge = document.createElement('div');
            badge.className = 'tmc-lost-badge';
            badge.style.cssText = `
              position:absolute; top:8px; left:50%; transform:translateX(-50%);
              background:#7c3aed; color:#fff; font-size:0.65rem; font-weight:700;
              padding:2px 8px; border-radius:20px;
              animation:tmcPulse 1s infinite alternate;
            `;
            badge.textContent = i18n[state.lang].lostTMC;
            cardElNow.style.position = 'relative';
            cardElNow.appendChild(badge);
          }
        } else {
          if (lostBadge) lostBadge.remove();
        }
      }
    }, 1000);

    state.timers[key] = intervalId;
  }

  /** Inicia timers para todos os cards visíveis */
  function startAllCardTimers(items) {
    stopAllTimers();
    items.forEach(item => startCardTimer(item));
  }

  // ─── COUNTDOWN DO AUTO-REFRESH ─────────────────────────────────────────────

  function resetCountdown() {
    state.countdown = AUTO_REFRESH_S;
    updateCountdownUI();
  }

  function updateCountdownUI() {
    const el = document.getElementById('tmc-countdown');
    if (el) {
      const t = i18n[state.lang];
      el.textContent = `${t.next}: ${state.countdown}s`;
    }
  }

  function startAutoRefreshLoop() {
    // Para loops anteriores
    if (state.countdownTimer) clearInterval(state.countdownTimer);
    if (state.autoRefreshTimer) clearInterval(state.autoRefreshTimer);

    state.countdownTimer = setInterval(() => {
      if (state.loading) return; // pausa durante fetch
      if (!state.autoRefresh) return;
      if (state.countdown > 0) {
        state.countdown--;
        updateCountdownUI();
      } else {
        resetCountdown();
        fetchAll();
      }
    }, 1000);
  }

  // ─── UI LOADING ───────────────────────────────────────────────────────────────

  function updateLoadingUI(isLoading) {
    const btn = document.getElementById('tmc-refresh-btn');
    if (btn) {
      btn.disabled = isLoading;
      btn.style.opacity = isLoading ? '0.5' : '1';
    }
    const statusEl = document.getElementById('tmc-status-text');
    if (statusEl) {
      statusEl.textContent = isLoading ? i18n[state.lang].fetching : '';
    }
  }

  // ─── INJEÇÃO DE CSS ───────────────────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById('tmc-styles')) return;
    const style = document.createElement('style');
    style.id = 'tmc-styles';
    style.textContent = `
      @keyframes tmcPulse {
        0% { opacity: 1; box-shadow: 0 0 6px #7c3aed; }
        100% { opacity: 0.6; box-shadow: 0 0 14px #7c3aed; }
      }
      @keyframes tmcFadeIn {
        from { opacity: 0; transform: translateY(-8px); }
        to { opacity: 1; transform: translateY(0); }
      }
      #${PANEL_ID} * {
        box-sizing: border-box;
        font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
      }
      #${PANEL_ID} ::-webkit-scrollbar {
        width: 5px;
      }
      #${PANEL_ID} ::-webkit-scrollbar-track {
        background: #0d1117;
      }
      #${PANEL_ID} ::-webkit-scrollbar-thumb {
        background: #334155;
        border-radius: 3px;
      }
      #${PANEL_ID} select,
      #${PANEL_ID} input {
        outline: none;
        border: 1px solid #1e293b;
        border-radius: 6px;
        background: #1e293b;
        color: #e2e8f0;
        font-size: 0.78rem;
        padding: 5px 8px;
        transition: border-color 0.2s;
      }
      #${PANEL_ID} select:focus,
      #${PANEL_ID} input:focus {
        border-color: #f2b705;
      }
      .tmc-card-item {
        animation: tmcFadeIn 0.3s ease;
        transition: box-shadow 0.2s, border-color 0.2s;
      }
      .tmc-card-item:hover {
        box-shadow: 0 0 0 2px rgba(242,183,5,0.4), 0 8px 24px rgba(0,0,0,0.5) !important;
      }
      .tmc-tab-btn {
        transition: all 0.2s;
        cursor: pointer;
        border: none;
      }
      .tmc-tab-btn:hover {
        color: #f2b705 !important;
      }
      .tmc-cycle-btn {
        transition: all 0.15s;
        cursor: pointer;
        border: none;
      }
      .tmc-cycle-btn:hover {
        border-color: #f2b705 !important;
        color: #f2b705 !important;
      }
      .tmc-ctrl-btn {
        cursor: pointer;
        border: 1px solid #1e293b;
        border-radius: 6px;
        background: #1e293b;
        color: #e2e8f0;
        font-size: 0.78rem;
        padding: 5px 10px;
        transition: background 0.2s;
      }
      .tmc-ctrl-btn:hover {
        background: #334155;
      }
      .tmc-ctrl-btn:disabled {
        cursor: not-allowed;
      }
      .tmc-toggle-active {
        background: rgba(242,183,5,0.15) !important;
        border-color: #f2b705 !important;
        color: #f2b705 !important;
      }
      .tmc-history-row:hover td {
        filter: brightness(1.2);
      }
      .tmc-progress-bar-inner {
        transition: width 0.5s ease;
      }
    `;
    document.head.appendChild(style);
  }

  // ─── RENDER PRINCIPAL ─────────────────────────────────────────────────────────

  function render() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;

    const t = i18n[state.lang];
    const filtered = applyFilters();
    const kpis = calcKPIs(filtered);
    const areas = getUniqueAreas();

    // Atualiza corpo do painel
    const body = document.getElementById('tmc-body');
    if (!body) return;

    if (state.minimized) {
      body.style.display = 'none';
      return;
    }
    body.style.display = 'flex';
    body.style.flexDirection = 'column';

    // Atualiza KPIs inline
    const kpiEl = document.getElementById('tmc-kpi-inline');
    if (kpiEl) {
      kpiEl.innerHTML = `
        <span style="color:#94a3b8">${t.total}: <strong style="color:#e2e8f0">${kpis.total}</strong></span>
        <span style="color:#22c55e">🟢 ${kpis.green}</span>
        <span style="color:#eab308">🟡 ${kpis.yellow}</span>
        <span style="color:#ef4444">🔴 ${kpis.red}</span>
        <span style="color:#7c3aed">💀 ${kpis.lost}</span>
      `;
    }

    // Atualiza select de área dinamicamente
    const areaSelect = document.getElementById('tmc-area-select');
    if (areaSelect) {
      const currentVal = areaSelect.value;
      areaSelect.innerHTML = `<option value="">${t.areaAll}</option>` +
        areas.map(a => `<option value="${a}"${currentVal === a ? ' selected' : ''}>${a}</option>`).join('');
      if (state.gaiolaFiltro) areaSelect.value = state.gaiolaFiltro;
    }

    // Renderiza conteúdo da aba ativa
    const tabContent = document.getElementById('tmc-tab-content');
    if (!tabContent) return;

    if (state.tab === 'realtime') {
      renderRealtime(tabContent, filtered, t);
      // Inicia timers dos cards renderizados
      requestAnimationFrame(() => startAllCardTimers(filtered));
    } else if (state.tab === 'history') {
      stopAllTimers();
      renderHistorico(tabContent, filtered, t);
    } else if (state.tab === 'stats') {
      stopAllTimers();
      renderStats(tabContent, t);
    }

    // Atualiza botões de abas
    ['realtime', 'history', 'stats'].forEach(tab => {
      const btn = document.getElementById(`tmc-tab-${tab}`);
      if (btn) {
        if (tab === state.tab) {
          btn.style.background = '#f2b705';
          btn.style.color = '#000';
        } else {
          btn.style.background = 'transparent';
          btn.style.color = '#64748b';
        }
      }
    });

    // Atualiza botões de ciclo
    const ciclos = ['', 'CHP', 'AM', 'PM', 'SD'];
    const labels = [t.all, 'CHP', 'AM', 'PM', 'SD'];
    ciclos.forEach((c, i) => {
      const btn = document.getElementById(`tmc-cycle-${c || 'all'}`);
      if (btn) {
        if (c === state.cicloFiltro) {
          btn.style.background = '#f2b705';
          btn.style.color = '#000';
          btn.style.borderColor = '#f2b705';
        } else {
          btn.style.background = 'rgba(255,255,255,0.05)';
          btn.style.color = '#64748b';
          btn.style.borderColor = '#1e293b';
        }
      }
    });

    // Auto-refresh toggle visual
    const arBtn = document.getElementById('tmc-ar-toggle');
    if (arBtn) {
      if (state.autoRefresh) {
        arBtn.classList.add('tmc-toggle-active');
      } else {
        arBtn.classList.remove('tmc-toggle-active');
      }
    }
  }

  // ─── RENDER TEMPO REAL ────────────────────────────────────────────────────────

  function renderRealtime(container, items, t) {
    if (state.loading) {
      container.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;height:200px;color:#64748b;gap:12px;">
          <span style="font-size:1.5rem;animation:tmcPulse 1s infinite alternate">⏳</span>
          <span>${t.loading}</span>
        </div>
      `;
      return;
    }

    if (items.length === 0) {
      container.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;height:200px;color:#64748b;">
          ${t.noData}
        </div>
      `;
      return;
    }

    const cardsHTML = items.map(item => renderCard(item, t)).join('');
    container.innerHTML = `
      <div style="
        display:grid;
        grid-template-columns:repeat(3,1fr);
        gap:12px;
        padding:16px;
        overflow-y:auto;
        max-height:calc(90vh - 280px);
      ">
        ${cardsHTML}
      </div>
    `;
  }

  /** Renderiza HTML de um card */
  function renderCard(item, t) {
    const key = item.route_id || item.route_name;
    const min = getElapsedMin(item);
    const tl = getTrafficLight(min);
    const cycle = getCycle(item.route_name);
    const gaiola = getGaiola(item.route_name);
    const statusLabel = getStatusLabel(item.process);
    const delta = state.fetchTimestamp ? (Date.now() - state.fetchTimestamp) / 1000 : 0;
    const totalSec = (item.total_elapsed_time || 0) + delta;
    const isLost = min >= TMC.lost;

    // Cor do badge de status
    const statusColors = {
      loading: { bg: 'rgba(34,197,94,0.15)', text: '#22c55e', border: '#22c55e' },
      in_customs: { bg: 'rgba(234,179,8,0.15)', text: '#eab308', border: '#eab308' },
      dispatched: { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa', border: '#3b82f6' },
      finished: { bg: 'rgba(100,116,139,0.15)', text: '#94a3b8', border: '#64748b' },
    };
    const sc = statusColors[item.process] || { bg: 'rgba(255,255,255,0.05)', text: '#e2e8f0', border: '#475569' };

    return `
      <div
        id="tmc-card-${key}"
        class="tmc-card-item"
        style="
          background:#0f172a;
          border-radius:12px;
          border-left:3px solid ${tl.color};
          overflow:hidden;
          position:relative;
          box-shadow:0 4px 12px rgba(0,0,0,0.4);
        "
      >
        <!-- Barra colorida no topo -->
        <div class="tmc-card-topbar" style="height:4px;background:${tl.color};"></div>

        <div style="padding:12px;">
          <!-- Linha 1: route_name + timer -->
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
            <div>
              <div style="font-size:1.05rem;font-weight:700;color:#f1f5f9;line-height:1.2;">${item.route_name || '—'}</div>
              <div style="font-size:0.72rem;color:#64748b;margin-top:2px;">${t.dock} ${item.dock_number || '—'}</div>
            </div>
            <div
              id="tmc-timer-${key}"
              style="
                font-size:1.8rem;
                font-weight:800;
                color:${tl.color};
                font-variant-numeric:tabular-nums;
                letter-spacing:-1px;
                line-height:1;
              "
            >${formatMMSS(totalSec)}</div>
          </div>

          <!-- Linha 2: badges ciclo + status -->
          <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
            <span style="
              background:rgba(242,183,5,0.15);
              color:#f2b705;
              border:1px solid rgba(242,183,5,0.3);
              border-radius:20px;
              font-size:0.65rem;
              font-weight:700;
              padding:2px 8px;
              letter-spacing:0.5px;
            ">${cycle}</span>
            <span style="
              background:${sc.bg};
              color:${sc.text};
              border:1px solid ${sc.border}40;
              border-radius:20px;
              font-size:0.65rem;
              font-weight:600;
              padding:2px 8px;
            ">${statusLabel}</span>
            <span style="
              background:rgba(255,255,255,0.04);
              color:#475569;
              border-radius:20px;
              font-size:0.62rem;
              padding:2px 6px;
            ">${gaiola}</span>
          </div>

          ${isLost ? `
          <div class="tmc-lost-badge" style="
            margin-top:8px;
            background:#7c3aed;
            color:#fff;
            font-size:0.65rem;
            font-weight:700;
            padding:3px 10px;
            border-radius:20px;
            text-align:center;
            animation:tmcPulse 1s infinite alternate;
            display:inline-block;
          ">${t.lostTMC}</div>` : ''}
        </div>
      </div>
    `;
  }

  // ─── RENDER HISTÓRICO ─────────────────────────────────────────────────────────

  function renderHistorico(container, items, t) {
    if (state.loading) {
      container.innerHTML = `<div style="text-align:center;padding:40px;color:#64748b;">${t.loading}</div>`;
      return;
    }
    if (items.length === 0) {
      container.innerHTML = `<div style="text-align:center;padding:40px;color:#64748b;">${t.noData}</div>`;
      return;
    }

    const rows = items.map(item => {
      const min = getElapsedMin(item);
      const tl = getTrafficLight(min);
      const cycle = getCycle(item.route_name);
      const delta = state.fetchTimestamp ? (Date.now() - state.fetchTimestamp) / 1000 : 0;
      const totalSec = (item.total_elapsed_time || 0) + delta;

      return `
        <tr class="tmc-history-row" style="border-bottom:1px solid #1e293b;">
          <td style="padding:10px 12px;font-weight:600;color:#f1f5f9;">${item.route_name || '—'}</td>
          <td style="padding:10px 12px;color:#94a3b8;">${item.dock_number || '—'}</td>
          <td style="padding:10px 12px;">
            <span style="
              background:rgba(242,183,5,0.15);color:#f2b705;
              border:1px solid rgba(242,183,5,0.3);
              border-radius:20px;font-size:0.65rem;font-weight:700;
              padding:2px 8px;
            ">${cycle}</span>
          </td>
          <td style="padding:10px 12px;color:#94a3b8;">${getStatusLabel(item.process)}</td>
          <td style="padding:10px 12px;font-weight:700;color:${tl.color};font-variant-numeric:tabular-nums;">
            ${formatMMSS(totalSec)}
          </td>
          <td style="padding:10px 12px;text-align:center;font-size:1.1rem;">${tl.emoji}</td>
        </tr>
      `;
    }).join('');

    container.innerHTML = `
      <div style="overflow:auto;max-height:calc(90vh - 280px);">
        <table style="width:100%;border-collapse:collapse;font-size:0.82rem;">
          <thead>
            <tr style="background:#0f172a;position:sticky;top:0;z-index:1;">
              <th style="padding:10px 12px;text-align:left;color:#64748b;font-weight:600;border-bottom:1px solid #1e293b;">${t.colRoute}</th>
              <th style="padding:10px 12px;text-align:left;color:#64748b;font-weight:600;border-bottom:1px solid #1e293b;">${t.colDock}</th>
              <th style="padding:10px 12px;text-align:left;color:#64748b;font-weight:600;border-bottom:1px solid #1e293b;">${t.colCycle}</th>
              <th style="padding:10px 12px;text-align:left;color:#64748b;font-weight:600;border-bottom:1px solid #1e293b;">${t.colStatus}</th>
              <th style="padding:10px 12px;text-align:left;color:#64748b;font-weight:600;border-bottom:1px solid #1e293b;">${t.colTime}</th>
              <th style="padding:10px 12px;text-align:center;color:#64748b;font-weight:600;border-bottom:1px solid #1e293b;">${t.colLight}</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  // ─── RENDER STATS ─────────────────────────────────────────────────────────────

  function renderStats(container, t) {
    const allItems = state.data;
    const kpis = calcKPIs(allItems);

    // Tempo médio geral
    let totalMin = 0;
    allItems.forEach(item => { totalMin += getElapsedMin(item); });
    const avgMin = allItems.length > 0 ? totalMin / allItems.length : 0;
    const avgSec = avgMin * 60;

    // Stats por ciclo
    const cycleStats = {};
    ALL_CYCLES.forEach(c => {
      cycleStats[c] = { total: 0, green: 0, yellow: 0, red: 0, lost: 0, sumSec: 0 };
    });

    allItems.forEach(item => {
      const cycle = getCycle(item.route_name);
      const min = getElapsedMin(item);
      const tl = getTrafficLight(min);
      const delta = state.fetchTimestamp ? (Date.now() - state.fetchTimestamp) / 1000 : 0;
      const sec = (item.total_elapsed_time || 0) + delta;

      if (cycleStats[cycle]) {
        cycleStats[cycle].total++;
        cycleStats[cycle].sumSec += sec;
        if (tl.label === 'green') cycleStats[cycle].green++;
        else if (tl.label === 'yellow') cycleStats[cycle].yellow++;
        else if (tl.label === 'red') cycleStats[cycle].red++;
        else if (tl.label === 'lost') cycleStats[cycle].lost++;
      }
    });

    // KPI cards
    const kpiCardsData = [
      { label: t.statsTotal, value: kpis.total, color: '#60a5fa', icon: '📦' },
      { label: t.statsGreen, value: kpis.green, color: '#22c55e', icon: '🟢' },
      { label: t.statsYellow, value: kpis.yellow, color: '#eab308', icon: '🟡' },
      { label: t.statsRed, value: kpis.red, color: '#ef4444', icon: '🔴' },
      { label: t.statsLost, value: kpis.lost, color: '#7c3aed', icon: '💀' },
    ];

    const kpiCardsHTML = kpiCardsData.map(k => `
      <div style="
        background:#0f172a;
        border-radius:12px;
        padding:16px;
        border:1px solid #1e293b;
        text-align:center;
      ">
        <div style="font-size:1.6rem;margin-bottom:4px;">${k.icon}</div>
        <div style="font-size:1.8rem;font-weight:800;color:${k.color};">${k.value}</div>
        <div style="font-size:0.72rem;color:#64748b;margin-top:4px;">${k.label}</div>
      </div>
    `).join('');

    // Card de tempo médio
    const avgCard = `
      <div style="
        background:#0f172a;
        border-radius:12px;
        padding:16px;
        border:1px solid #1e293b;
        text-align:center;
        grid-column: span 5;
      ">
        <div style="font-size:0.75rem;color:#64748b;margin-bottom:4px;">${t.statsAvg}</div>
        <div style="font-size:2rem;font-weight:800;color:${getTrafficLight(avgMin).color};">
          ${formatMMSS(avgSec)}
        </div>
      </div>
    `;

    // Cards por ciclo
    const cycleCardsHTML = ALL_CYCLES.map(cycle => {
      const cs = cycleStats[cycle];
      if (!cs || cs.total === 0) return '';
      const avgCycleSec = cs.total > 0 ? cs.sumSec / cs.total : 0;
      const avgCycleMin = avgCycleSec / 60;
      const pctGreen = cs.total > 0 ? Math.round((cs.green / cs.total) * 100) : 0;
      const tlCycle = getTrafficLight(avgCycleMin);

      return `
        <div style="
          background:#0f172a;
          border-radius:12px;
          padding:16px;
          border:1px solid #1e293b;
          border-left:3px solid ${tlCycle.color};
        ">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <span style="font-size:0.95rem;font-weight:700;color:#f1f5f9;">${cycle}</span>
            <span style="
              background:rgba(242,183,5,0.1);color:#f2b705;
              border-radius:20px;font-size:0.68rem;font-weight:700;
              padding:2px 8px;
            ">${cs.total} ${t.routes}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:0.75rem;color:#64748b;margin-bottom:8px;">
            <span>${t.withinTMC}: <strong style="color:#22c55e">${pctGreen}%</strong></span>
            <span>${t.avgTime}: <strong style="color:${tlCycle.color}">${formatMMSS(avgCycleSec)}</strong></span>
          </div>
          <!-- Barra de progresso -->
          <div style="height:6px;background:#1e293b;border-radius:3px;overflow:hidden;">
            <div class="tmc-progress-bar-inner" style="
              height:100%;
              width:${pctGreen}%;
              background:linear-gradient(90deg,#22c55e,#16a34a);
              border-radius:3px;
            "></div>
          </div>
          <div style="display:flex;gap:8px;margin-top:8px;font-size:0.68rem;">
            <span style="color:#22c55e">🟢${cs.green}</span>
            <span style="color:#eab308">🟡${cs.yellow}</span>
            <span style="color:#ef4444">🔴${cs.red}</span>
            <span style="color:#7c3aed">💀${cs.lost}</span>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div style="overflow-y:auto;max-height:calc(90vh - 280px);padding:16px;">
        <!-- KPI Cards -->
        <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:10px;">
          ${kpiCardsHTML}
        </div>
        <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:20px;">
          ${avgCard}
        </div>

        <!-- Breakdown por ciclo -->
        <div style="font-size:0.8rem;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">
          ${t.cycleBreakdown}
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">
          ${cycleCardsHTML || `<div style="color:#64748b;grid-column:span 3;text-align:center;padding:20px;">${t.noData}</div>`}
        </div>
      </div>
    `;
  }

  // ─── CRIAÇÃO DO PAINEL ────────────────────────────────────────────────────────

  function createPanel() {
    injectStyles();

    const t = i18n[state.lang];
    const panel = document.createElement('div');
    panel.id = PANEL_ID;

    panel.style.cssText = `
      position: fixed;
      top: 16px;
      right: 16px;
      width: 680px;
      max-height: 90vh;
      background: #0d1117;
      border-radius: 16px;
      box-shadow: 0 25px 80px rgba(0,0,0,0.7);
      z-index: 2147483647;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      border: 1px solid #1e293b;
      font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
    `;

    panel.innerHTML = buildPanelHTML(t);
    document.body.appendChild(panel);

    attachEventListeners(panel);
    enableDrag(panel);
    fetchAll();
    startAutoRefreshLoop();
  }

  function buildPanelHTML(t) {
    const areas = getUniqueAreas();

    return `
      <!-- ── HEADER / TOPBAR ── -->
      <div
        id="tmc-header"
        style="
          background: linear-gradient(135deg, #f2b705 0%, #e6a800 100%);
          padding: 10px 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: grab;
          user-select: none;
          flex-shrink: 0;
        "
      >
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:1.05rem;font-weight:800;color:#000;">${t.title}</span>
          <span style="
            background:rgba(0,0,0,0.15);
            color:#000;
            border-radius:6px;
            font-size:0.7rem;
            font-weight:800;
            padding:2px 8px;
            letter-spacing:1px;
          " id="tmc-badge-base">${state.facilityId}</span>
          <span style="font-size:0.68rem;color:rgba(0,0,0,0.6);" id="tmc-header-date">${getDisplayDate()}</span>
        </div>
        <div style="display:flex;gap:6px;align-items:center;">
          <span id="tmc-status-text" style="font-size:0.68rem;color:rgba(0,0,0,0.6);"></span>
          <button
            id="tmc-minimize-btn"
            style="
              background:rgba(0,0,0,0.15);border:none;border-radius:6px;
              width:26px;height:26px;cursor:pointer;font-size:0.9rem;
              color:#000;display:flex;align-items:center;justify-content:center;
            "
            title="Minimizar"
          >${t.minimize}</button>
          <button
            id="tmc-close-btn"
            style="
              background:rgba(0,0,0,0.15);border:none;border-radius:6px;
              width:26px;height:26px;cursor:pointer;font-size:0.9rem;
              color:#000;display:flex;align-items:center;justify-content:center;
            "
            title="Fechar"
          >${t.close}</button>
        </div>
      </div>

      <!-- ── BODY (colapsa ao minimizar) ── -->
      <div id="tmc-body" style="display:flex;flex-direction:column;flex:1;overflow:hidden;min-height:0;">

        <!-- ── CONTROLES ── -->
        <div style="background:#0f172a;padding:10px 14px;border-bottom:1px solid #1e293b;flex-shrink:0;">

          <!-- Linha 1: busca, base, idioma, refresh, auto-refresh -->
          <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap;">
            <input
              id="tmc-search"
              type="text"
              placeholder="${t.search}"
              value="${state.searchText}"
              style="flex:1;min-width:140px;"
            />
            <select id="tmc-base-select" style="width:90px;">
              ${FACILITY_OPTIONS.map(f => `<option value="${f}"${f === state.facilityId ? ' selected' : ''}>${f}</option>`).join('')}
            </select>
            <select id="tmc-lang-select" style="width:80px;">
              <option value="PT"${state.lang === 'PT' ? ' selected' : ''}>🇧🇷 PT</option>
              <option value="EN"${state.lang === 'EN' ? ' selected' : ''}>🇺🇸 EN</option>
              <option value="ES"${state.lang === 'ES' ? ' selected' : ''}>🇪🇸 ES</option>
            </select>
            <button id="tmc-refresh-btn" class="tmc-ctrl-btn" title="Refresh">${t.refresh}</button>
            <button id="tmc-ar-toggle" class="tmc-ctrl-btn ${state.autoRefresh ? 'tmc-toggle-active' : ''}" title="Auto-refresh">
              ${t.autoRefresh}
            </button>
            <span id="tmc-countdown" style="font-size:0.7rem;color:#475569;white-space:nowrap;">
              ${t.next}: ${state.countdown}s
            </span>
          </div>

          <!-- Linha 2: botões de ciclo -->
          <div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap;">
            <button id="tmc-cycle-all" class="tmc-cycle-btn" style="
              background:${state.cicloFiltro === '' ? '#f2b705' : 'rgba(255,255,255,0.05)'};
              color:${state.cicloFiltro === '' ? '#000' : '#64748b'};
              border:1px solid ${state.cicloFiltro === '' ? '#f2b705' : '#1e293b'};
              border-radius:6px;padding:4px 12px;font-size:0.75rem;font-weight:700;
            ">${t.all}</button>
            ${['CHP', 'AM', 'PM', 'SD'].map(c => `
              <button id="tmc-cycle-${c}" class="tmc-cycle-btn" style="
                background:${state.cicloFiltro === c ? '#f2b705' : 'rgba(255,255,255,0.05)'};
                color:${state.cicloFiltro === c ? '#000' : '#64748b'};
                border:1px solid ${state.cicloFiltro === c ? '#f2b705' : '#1e293b'};
                border-radius:6px;padding:4px 12px;font-size:0.75rem;font-weight:700;
              ">${c}</button>
            `).join('')}
          </div>

          <!-- Linha 3: filtros adicionais + KPIs -->
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <select id="tmc-status-select" style="width:130px;">
              <option value="">${t.statusAll}</option>
              <option value="loading"${state.statusFiltro === 'loading' ? ' selected' : ''}>${t.statusLoading}</option>
              <option value="in_customs"${state.statusFiltro === 'in_customs' ? ' selected' : ''}>${t.statusCustoms}</option>
              <option value="dispatched"${state.statusFiltro === 'dispatched' ? ' selected' : ''}>${t.statusDispatched}</option>
              <option value="finished"${state.statusFiltro === 'finished' ? ' selected' : ''}>${t.statusFinished}</option>
            </select>
            <select id="tmc-area-select" style="width:120px;">
              <option value="">${t.areaAll}</option>
              ${areas.map(a => `<option value="${a}"${state.gaiolaFiltro === a ? ' selected' : ''}>${a}</option>`).join('')}
            </select>
            <div id="tmc-kpi-inline" style="display:flex;gap:10px;font-size:0.75rem;font-weight:600;flex:1;justify-content:flex-end;flex-wrap:wrap;">
              <!-- preenchido pelo render() -->
            </div>
          </div>
        </div>

        <!-- ── ABAS ── -->
        <div style="
          background:#0d1117;
          display:flex;
          gap:4px;
          padding:8px 14px 0;
          border-bottom:1px solid #1e293b;
          flex-shrink:0;
        ">
          <button id="tmc-tab-realtime" class="tmc-tab-btn" style="
            background:${state.tab === 'realtime' ? '#f2b705' : 'transparent'};
            color:${state.tab === 'realtime' ? '#000' : '#64748b'};
            border-radius:8px 8px 0 0;padding:7px 14px;font-size:0.78rem;font-weight:600;
          ">${t.tabRealtime}</button>
          <button id="tmc-tab-history" class="tmc-tab-btn" style="
            background:${state.tab === 'history' ? '#f2b705' : 'transparent'};
            color:${state.tab === 'history' ? '#000' : '#64748b'};
            border-radius:8px 8px 0 0;padding:7px 14px;font-size:0.78rem;font-weight:600;
          ">${t.tabHistory}</button>
          <button id="tmc-tab-stats" class="tmc-tab-btn" style="
            background:${state.tab === 'stats' ? '#f2b705' : 'transparent'};
            color:${state.tab === 'stats' ? '#000' : '#64748b'};
            border-radius:8px 8px 0 0;padding:7px 14px;font-size:0.78rem;font-weight:600;
          ">${t.tabStats}</button>
        </div>

        <!-- ── CONTEÚDO DA ABA ── -->
        <div id="tmc-tab-content" style="flex:1;overflow:hidden;background:#0d1117;min-height:0;">
          <div style="display:flex;align-items:center;justify-content:center;height:200px;color:#64748b;">
            ${t.loading}
          </div>
        </div>

      </div><!-- /tmc-body -->
    `;
  }

  // ─── EVENT LISTENERS ──────────────────────────────────────────────────────────

  function attachEventListeners(panel) {
    // Fechar
    panel.querySelector('#tmc-close-btn').addEventListener('click', () => {
      stopAllTimers();
      if (state.countdownTimer) clearInterval(state.countdownTimer);
      if (state.autoRefreshTimer) clearInterval(state.autoRefreshTimer);
      panel.remove();
      document.getElementById('tmc-styles') && document.getElementById('tmc-styles').remove();
    });

    // Minimizar
    panel.querySelector('#tmc-minimize-btn').addEventListener('click', () => {
      state.minimized = !state.minimized;
      const body = panel.querySelector('#tmc-body');
      if (state.minimized) {
        body.style.display = 'none';
        panel.style.maxHeight = '48px';
        stopAllTimers();
      } else {
        body.style.display = 'flex';
        panel.style.maxHeight = '90vh';
        render();
      }
    });

    // Refresh manual
    panel.querySelector('#tmc-refresh-btn').addEventListener('click', () => {
      if (!state.loading) {
        resetCountdown();
        fetchAll();
      }
    });

    // Toggle auto-refresh
    panel.querySelector('#tmc-ar-toggle').addEventListener('click', () => {
      state.autoRefresh = !state.autoRefresh;
      render();
    });

    // Busca
    panel.querySelector('#tmc-search').addEventListener('input', (e) => {
      state.searchText = e.target.value;
      render();
    });

    // Select base
    panel.querySelector('#tmc-base-select').addEventListener('change', (e) => {
      state.facilityId = e.target.value;
      // Atualiza badge
      const badge = panel.querySelector('#tmc-badge-base');
      if (badge) badge.textContent = state.facilityId;
      savePrefs();
      fetchAll();
    });

    // Select idioma
    panel.querySelector('#tmc-lang-select').addEventListener('change', (e) => {
      state.lang = e.target.value;
      savePrefs();
      // Re-cria o conteúdo do painel mantendo posição
      const rect = panel.getBoundingClientRect();
      panel.innerHTML = buildPanelHTML(i18n[state.lang]);
      panel.style.top = rect.top + 'px';
      panel.style.right = (window.innerWidth - rect.right) + 'px';
      attachEventListeners(panel);
      enableDrag(panel);
      render();
    });

    // Select status
    panel.querySelector('#tmc-status-select').addEventListener('change', (e) => {
      state.statusFiltro = e.target.value;
      render();
    });

    // Select área
    panel.querySelector('#tmc-area-select').addEventListener('change', (e) => {
      state.gaiolaFiltro = e.target.value;
      render();
    });

    // Botões de ciclo
    panel.querySelector('#tmc-cycle-all').addEventListener('click', () => {
      state.cicloFiltro = '';
      render();
    });
    ['CHP', 'AM', 'PM', 'SD'].forEach(c => {
      const btn = panel.querySelector(`#tmc-cycle-${c}`);
      if (btn) btn.addEventListener('click', () => {
        state.cicloFiltro = state.cicloFiltro === c ? '' : c;
        render();
      });
    });

    // Botões de aba
    panel.querySelector('#tmc-tab-realtime').addEventListener('click', () => {
      state.tab = 'realtime';
      render();
    });
    panel.querySelector('#tmc-tab-history').addEventListener('click', () => {
      state.tab = 'history';
      render();
    });
    panel.querySelector('#tmc-tab-stats').addEventListener('click', () => {
      state.tab = 'stats';
      render();
    });
  }

  // ─── DRAG AND DROP ────────────────────────────────────────────────────────────

  function enableDrag(panel) {
    const header = panel.querySelector('#tmc-header');
    if (!header) return;

    let isDragging = false;
    let startX, startY, startLeft, startTop;

    header.addEventListener('mousedown', (e) => {
      // Ignora cliques nos botões
      if (e.target.tagName === 'BUTTON') return;
      isDragging = true;
      header.style.cursor = 'grabbing';

      const rect = panel.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      startLeft = rect.left;
      startTop = rect.top;

      // Remove right, usa left/top absolutos
      panel.style.right = 'auto';
      panel.style.left = startLeft + 'px';
      panel.style.top = startTop + 'px';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      let newLeft = startLeft + dx;
      let newTop = startTop + dy;

      // Mantém dentro da viewport
      newLeft = Math.max(0, Math.min(window.innerWidth - panel.offsetWidth, newLeft));
      newTop = Math.max(0, Math.min(window.innerHeight - 48, newTop));

      panel.style.left = newLeft + 'px';
      panel.style.top = newTop + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        header.style.cursor = 'grab';
      }
    });
  }

  // ─── INIT ─────────────────────────────────────────────────────────────────────

  function init() {
    loadPrefs();

    // Toggle: se painel já existe, mostra/esconde
    const existing = document.getElementById(PANEL_ID);
    if (existing) {
      if (existing.style.display === 'none') {
        existing.style.display = 'flex';
      } else {
        existing.style.display = 'none';
      }
      return;
    }

    createPanel();
  }

  // ─── BOOTSTRAP ────────────────────────────────────────────────────────────────
  init();

})();