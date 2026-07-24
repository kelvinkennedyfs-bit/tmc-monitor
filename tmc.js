(function () {
  'use strict';

  // ─────────────────────────────────────────────
  //  CONSTANTES
  // ─────────────────────────────────────────────
  const PANEL_ID        = '__TMC_MONITOR_PANEL__';
  const PREFS_KEY       = '__TMC_PREFS__';
  const BASE_URL        = 'https://logistics.adminml.com';
  const AUTO_REFRESH_S  = 60; // segundos entre refreshes automáticos

  const FACILITY_OPTIONS   = ['SRJ1','SRJ3','SRJ5','SRJ7','SRJ8','SRJ10','SES1','SES2'];
  const CYCLES_WITH_WAVES  = ['AM1','AM101','PM1','PM101','SD101'];
  const SIMPLE_CYCLES      = ['SD','CHP'];
  const ALL_CYCLES         = [...CYCLES_WITH_WAVES, ...SIMPLE_CYCLES];
  const TMC_LIMITS         = { green: 30, yellow: 45 };

  // ─────────────────────────────────────────────
  //  I18N
  // ─────────────────────────────────────────────
  const i18n = {
    PT: {
      title:       '⏱ TMC Monitor',
      subtitle:    'Tempo Médio de Carregamento',
      base:        'Base',
      language:    'Idioma',
      refresh:     'Atualizar',
      autoRefresh: 'Auto-refresh',
      loading:     'Carregando...',
      noData:      'Sem dados',
      error:       'Erro',
      wave:        'Wave',
      average:     'Média',
      lastUpdate:  'Última atualização',
      next:        'Próx',
      cycles:      'Ciclos',
      min:         'min',
      close:       'Fechar',
    },
    EN: {
      title:       '⏱ TMC Monitor',
      subtitle:    'Average Loading Time',
      base:        'Base',
      language:    'Language',
      refresh:     'Refresh',
      autoRefresh: 'Auto-refresh',
      loading:     'Loading...',
      noData:      'No data',
      error:       'Error',
      wave:        'Wave',
      average:     'Average',
      lastUpdate:  'Last update',
      next:        'Next',
      cycles:      'Cycles',
      min:         'min',
      close:       'Close',
    },
    ES: {
      title:       '⏱ TMC Monitor',
      subtitle:    'Tiempo Medio de Carga',
      base:        'Base',
      language:    'Idioma',
      refresh:     'Actualizar',
      autoRefresh: 'Auto-refresco',
      loading:     'Cargando...',
      noData:      'Sin datos',
      error:       'Error',
      wave:        'Wave',
      average:     'Promedio',
      lastUpdate:  'Última actualización',
      next:        'Próx',
      cycles:      'Ciclos',
      min:         'min',
      close:       'Cerrar',
    },
  };

  // ─────────────────────────────────────────────
  //  CARREGA / SALVA PREFERÊNCIAS
  // ─────────────────────────────────────────────
  function loadPrefs() {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (_) { return {}; }
  }

  function savePrefs() {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({
        facilityId: state.facilityId,
        lang:       state.lang,
      }));
    } catch (_) {}
  }

  // ─────────────────────────────────────────────
  //  STATE
  // ─────────────────────────────────────────────
  const savedPrefs = loadPrefs();

  const state = {
    facilityId:      savedPrefs.facilityId || 'SRJ3',
    lang:            savedPrefs.lang       || 'PT',
    /**
     * Estrutura de dados por ciclo:
     * {
     *   [cycle]: {
     *     status:  'loading' | 'ok' | 'nodata' | 'error',
     *     waves:   [{ wave: Number, tmc: Number|null }],
     *     avg:     Number|null,   // média em minutos
     *     ts:      String,        // timestamp da última atualização
     *   }
     * }
     */
    data:            {},
    autoRefresh:     true,
    countdown:       AUTO_REFRESH_S,
    timer:           null,   // setInterval do auto-refresh
    countdownTimer:  null,   // setInterval do countdown visual
    loading:         false,
  };

  // Inicializa data com status 'loading' para todos os ciclos
  ALL_CYCLES.forEach(c => {
    state.data[c] = { status: 'loading', waves: [], avg: null, ts: null };
  });

  // ─────────────────────────────────────────────
  //  HELPERS DE DATA / TEMPO
  // ─────────────────────────────────────────────
  function getToday() {
    // Retorna data atual no formato YYYY-MM-DD
    return new Date().toISOString().split('T')[0];
  }

  function getTimestamp() {
    // Retorna hora atual HH:MM:SS para exibir no card
    return new Date().toLocaleTimeString('pt-BR');
  }

  // ─────────────────────────────────────────────
  //  SEMÁFORO
  // ─────────────────────────────────────────────
  /**
   * Retorna a cor hexadecimal do semáforo para um TMC em minutos.
   * @param {number|null} tmc
   * @returns {{ color: string, emoji: string }}
   */
  function getTrafficLight(tmc) {
    if (tmc === null || tmc === undefined) return { color: '#64748b', emoji: '⚪' };
    if (tmc <= TMC_LIMITS.green)  return { color: '#22c55e', emoji: '🟢' };
    if (tmc <= TMC_LIMITS.yellow) return { color: '#eab308', emoji: '🟡' };
    return { color: '#ef4444', emoji: '🔴' };
  }

  // ─────────────────────────────────────────────
  //  API — WAVES-STATUS
  // ─────────────────────────────────────────────
  /**
   * Busca a lista de waves disponíveis para um ciclo/data.
   * @param {string} cycle  — ex: 'AM1'
   * @param {string} date   — ex: '2026-07-24'
   * @returns {Promise<Array<{wave: number}>>}
   */
  async function fetchWaves(cycle, date) {
    const url = `${BASE_URL}/logistics/last-mile/monitoring/api/ops-clock/waves-status`
              + `?cycleId=${encodeURIComponent(cycle)}&date=${encodeURIComponent(date)}`;
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new Error(`waves-status HTTP ${res.status}`);
    const json = await res.json();
    // O endpoint retorna um array de objetos com a propriedade `wave`
    if (!Array.isArray(json) || json.length === 0) return [];
    return json; // [{ wave: 1 }, { wave: 2 }, ...]
  }

  // ─────────────────────────────────────────────
  //  API — DISPATCH
  // ─────────────────────────────────────────────
  /**
   * Busca os dados de dispatch para um ciclo/wave e retorna o TMC em minutos.
   * @param {string} facilityId
   * @param {string} cycle
   * @param {number} wave
   * @returns {Promise<number|null>}  — TMC em minutos ou null se sem dados
   */
  async function fetchDispatch(facilityId, cycle, wave) {
    const url = `${BASE_URL}/logistics/last-mile/monitoring/frm-provider/api/dispatch`
              + `?facilityId=${encodeURIComponent(facilityId)}`
              + `&groupId=${encodeURIComponent(cycle)}`
              + `&siteId=MLB`
              + `&wave=${encodeURIComponent(wave)}`;
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new Error(`dispatch HTTP ${res.status}`);
    const json = await res.json();
    // Converte segundos → minutos, 2 casas decimais
    if (json && typeof json.total_elapsed_time === 'number' && json.total_elapsed_time > 0) {
      return Math.round((json.total_elapsed_time / 60) * 100) / 100;
    }
    return null;
  }

  // ─────────────────────────────────────────────
  //  LÓGICA DE ATUALIZAÇÃO DE UM ÚNICO CICLO
  // ─────────────────────────────────────────────
  /**
   * Atualiza os dados de um ciclo específico no state e re-renderiza o card.
   * @param {string} cycle
   */
  async function refreshCycle(cycle) {
    const today = getToday();
    // Marca o ciclo como loading e re-renderiza
    state.data[cycle] = { status: 'loading', waves: [], avg: null, ts: null };
    renderCard(cycle);

    try {
      let wavesData = []; // [{ wave: Number, tmc: Number|null }]

      if (SIMPLE_CYCLES.includes(cycle)) {
        // ── Ciclo simples (SD, CHP): sem waves, chama dispatch direto com wave=1
        const tmc = await fetchDispatch(state.facilityId, cycle, 1);
        wavesData = [{ wave: 1, tmc }];
      } else {
        // ── Ciclo com waves: busca waves-status primeiro
        const waveList = await fetchWaves(cycle, today);

        if (waveList.length === 0) {
          // Nenhuma wave disponível ainda
          state.data[cycle] = { status: 'nodata', waves: [], avg: null, ts: getTimestamp() };
          renderCard(cycle);
          return;
        }

        // Para cada wave, busca o dispatch
        for (const waveObj of waveList) {
          const waveNum = waveObj.wave;
          let tmc = null;
          try {
            tmc = await fetchDispatch(state.facilityId, cycle, waveNum);
          } catch (_) {
            tmc = null; // wave com erro → tmc null
          }
          wavesData.push({ wave: waveNum, tmc });
        }
      }

      // Calcula a média apenas com waves que têm tmc válido
      const validTmcs = wavesData.map(w => w.tmc).filter(t => t !== null);
      const avg = validTmcs.length > 0
        ? Math.round((validTmcs.reduce((a, b) => a + b, 0) / validTmcs.length) * 100) / 100
        : null;

      state.data[cycle] = {
        status: avg !== null ? 'ok' : 'nodata',
        waves:  wavesData,
        avg,
        ts: getTimestamp(),
      };
    } catch (err) {
      console.warn(`[TMC] Erro no ciclo ${cycle}:`, err.message);
      state.data[cycle] = { status: 'error', waves: [], avg: null, ts: getTimestamp() };
    }

    renderCard(cycle);
  }

  // ─────────────────────────────────────────────
  //  ATUALIZAÇÃO GERAL (todos os ciclos em paralelo)
  // ─────────────────────────────────────────────
  async function refreshAll() {
    if (state.loading) return; // evita chamadas sobrepostas
    state.loading = true;

    // Pausa o countdown durante o fetch
    stopCountdown();
    updateRefreshButton(true);

    // Dispara todas as atualizações em paralelo
    await Promise.allSettled(ALL_CYCLES.map(cycle => refreshCycle(cycle)));

    state.loading = false;
    updateRefreshButton(false);

    // Reinicia o countdown se auto-refresh ativo
    if (state.autoRefresh) {
      state.countdown = AUTO_REFRESH_S;
      startCountdown();
    }
  }

  // ─────────────────────────────────────────────
  //  AUTO-REFRESH — TIMERS
  // ─────────────────────────────────────────────
  function startAutoRefresh() {
    stopAutoRefresh();
    state.timer = setInterval(() => {
      if (!state.loading) refreshAll();
    }, AUTO_REFRESH_S * 1000);
  }

  function stopAutoRefresh() {
    if (state.timer) { clearInterval(state.timer); state.timer = null; }
  }

  function startCountdown() {
    stopCountdown();
    state.countdown = AUTO_REFRESH_S;
    updateCountdownDisplay();
    state.countdownTimer = setInterval(() => {
      state.countdown--;
      if (state.countdown < 0) state.countdown = 0;
      updateCountdownDisplay();
    }, 1000);
  }

  function stopCountdown() {
    if (state.countdownTimer) { clearInterval(state.countdownTimer); state.countdownTimer = null; }
  }

  function updateCountdownDisplay() {
    const el = document.getElementById('__tmc_countdown__');
    if (el) {
      const t = i18n[state.lang];
      el.textContent = state.autoRefresh ? `${t.next}: ${state.countdown}s` : '';
    }
  }

  // ─────────────────────────────────────────────
  //  ATUALIZA ESTADO DO BOTÃO DE REFRESH
  // ─────────────────────────────────────────────
  function updateRefreshButton(loading) {
    const btn = document.getElementById('__tmc_refresh_btn__');
    if (!btn) return;
    btn.disabled = loading;
    btn.style.opacity = loading ? '0.5' : '1';
    btn.style.cursor  = loading ? 'not-allowed' : 'pointer';
    btn.textContent   = loading ? '⏳' : '🔄';
  }

  // ─────────────────────────────────────────────
  //  RENDER — CARD INDIVIDUAL
  // ─────────────────────────────────────────────
  /**
   * Re-renderiza apenas o conteúdo interno de um card de ciclo.
   * @param {string} cycle
   */
  function renderCard(cycle) {
    const cardBody = document.getElementById(`__tmc_card_body_${cycle}__`);
    if (!cardBody) return;
    cardBody.innerHTML = buildCardBodyHTML(cycle);
  }

  /**
   * Gera o HTML do conteúdo interno de um card de ciclo.
   * @param {string} cycle
   * @returns {string}
   */
  function buildCardBodyHTML(cycle) {
    const t   = i18n[state.lang];
    const d   = state.data[cycle];
    const isSimple = SIMPLE_CYCLES.includes(cycle);

    // ── Estado: carregando
    if (d.status === 'loading') {
      return `<div class="tmc-card-status tmc-loading">${t.loading}</div>`;
    }

    // ── Estado: erro
    if (d.status === 'error') {
      return `<div class="tmc-card-status tmc-error">⚠️ ${t.error}</div>`;
    }

    // ── Estado: sem dados
    if (d.status === 'nodata' || d.avg === null) {
      const tsHtml = d.ts ? `<div class="tmc-ts">${t.lastUpdate}: ${d.ts}</div>` : '';
      return `<div class="tmc-card-status tmc-nodata">— ${t.noData}</div>${tsHtml}`;
    }

    // ── Estado: ok — monta badge de média + lista de waves
    const light = getTrafficLight(d.avg);

    // Para ciclos simples (SD, CHP) com 1 wave: mostra só o valor sem seção de média
    let html = '';

    if (isSimple) {
      // Ciclo simples: exibe o valor da wave 1 diretamente
      const w0   = d.waves[0];
      const wTmc = w0 ? w0.tmc : null;
      const wLight = getTrafficLight(wTmc);
      html += `
        <div class="tmc-avg-badge" style="background:${wLight.color}22;border-color:${wLight.color};">
          <span class="tmc-avg-dot" style="background:${wLight.color};"></span>
          <span class="tmc-avg-value" style="color:${wLight.color};">
            ${wTmc !== null ? wTmc + ' ' + t.min : t.noData}
          </span>
        </div>
      `;
    } else {
      // Ciclo com waves: exibe média + lista de waves
      html += `
        <div class="tmc-avg-badge" style="background:${light.color}22;border-color:${light.color};">
          <span class="tmc-avg-dot" style="background:${light.color};"></span>
          <span class="tmc-avg-label">${t.average}:</span>
          <span class="tmc-avg-value" style="color:${light.color};">
            ${d.avg} ${t.min}
          </span>
        </div>
        <div class="tmc-wave-list">
      `;
      for (const wObj of d.waves) {
        const wLight = getTrafficLight(wObj.tmc);
        const wVal   = wObj.tmc !== null ? `${wObj.tmc} ${t.min}` : t.noData;
        html += `
          <div class="tmc-wave-item">
            <span class="tmc-wave-dot" style="background:${wLight.color};"></span>
            <span class="tmc-wave-name">${t.wave} ${wObj.wave}</span>
            <span class="tmc-wave-val" style="color:${wLight.color};">${wVal}</span>
          </div>
        `;
      }
      html += `</div>`;
    }

    // Timestamp
    if (d.ts) {
      html += `<div class="tmc-ts">${t.lastUpdate}: ${d.ts}</div>`;
    }

    return html;
  }

  // ─────────────────────────────────────────────
  //  RENDER — PAINEL COMPLETO
  // ─────────────────────────────────────────────
  function render() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    const t = i18n[state.lang];

    // Atualiza header — badge da base e subtítulo
    const badgeEl = document.getElementById('__tmc_base_badge__');
    if (badgeEl) badgeEl.textContent = state.facilityId;

    const subtitleEl = document.getElementById('__tmc_subtitle__');
    if (subtitleEl) subtitleEl.textContent = t.subtitle;

    const titleEl = document.getElementById('__tmc_title__');
    if (titleEl) titleEl.textContent = t.title;

    // Atualiza labels dos controles
    const baseLabelEl = document.getElementById('__tmc_base_label__');
    if (baseLabelEl) baseLabelEl.textContent = t.base + ':';

    const langLabelEl = document.getElementById('__tmc_lang_label__');
    if (langLabelEl) langLabelEl.textContent = t.language + ':';

    const arEl = document.getElementById('__tmc_ar_label__');
    if (arEl) arEl.textContent = t.autoRefresh;

    const closeBtnEl = document.getElementById('__tmc_close_btn__');
    if (closeBtnEl) closeBtnEl.title = t.close;

    const refreshBtnEl = document.getElementById('__tmc_refresh_btn__');
    if (refreshBtnEl && !state.loading) refreshBtnEl.textContent = '🔄';

    // Re-renderiza todos os cards
    ALL_CYCLES.forEach(cycle => renderCard(cycle));

    // Atualiza countdown
    updateCountdownDisplay();
  }

  // ─────────────────────────────────────────────
  //  CRIAÇÃO DO PAINEL
  // ─────────────────────────────────────────────
  function createPanel() {
    const t       = i18n[state.lang];
    const today   = getToday();

    // ── ESTILOS INJETADOS ─────────────────────
    const styleId = '__tmc_styles__';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        #${PANEL_ID} {
          position: fixed;
          top: 16px;
          right: 16px;
          width: 520px;
          max-height: 90vh;
          background: #0f172a;
          border: 1px solid #334155;
          border-radius: 12px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px #1e293b;
          font-family: 'Segoe UI', system-ui, sans-serif;
          font-size: 13px;
          color: #e2e8f0;
          z-index: 2147483647;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          user-select: none;
        }
        /* ── Header */
        .tmc-header {
          background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
          border-bottom: 1px solid #334155;
          padding: 12px 16px 10px;
          cursor: grab;
          flex-shrink: 0;
        }
        .tmc-header:active { cursor: grabbing; }
        .tmc-header-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .tmc-header-left {
          display: flex;
          align-items: center;
          gap: 10px;
          flex: 1;
        }
        #__tmc_title__ {
          font-size: 15px;
          font-weight: 700;
          color: #f1f5f9;
          white-space: nowrap;
        }
        #__tmc_base_badge__ {
          background: #3b82f6;
          color: #fff;
          font-size: 11px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 999px;
          letter-spacing: 0.5px;
        }
        #__tmc_subtitle__ {
          font-size: 11px;
          color: #94a3b8;
          margin-top: 2px;
        }
        .tmc-date-badge {
          font-size: 11px;
          color: #64748b;
          margin-left: 4px;
        }
        .tmc-close-btn {
          background: none;
          border: none;
          color: #64748b;
          font-size: 18px;
          cursor: pointer;
          line-height: 1;
          padding: 2px 4px;
          border-radius: 4px;
          transition: color 0.15s, background 0.15s;
          flex-shrink: 0;
        }
        .tmc-close-btn:hover { color: #ef4444; background: #1e293b; }
        /* ── Controles */
        .tmc-controls {
          background: #0f172a;
          border-bottom: 1px solid #334155;
          padding: 10px 14px;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }
        .tmc-ctrl-group {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .tmc-ctrl-label {
          font-size: 11px;
          color: #94a3b8;
          white-space: nowrap;
        }
        .tmc-select {
          background: #1e293b;
          border: 1px solid #334155;
          color: #e2e8f0;
          font-size: 12px;
          padding: 4px 8px;
          border-radius: 6px;
          cursor: pointer;
          outline: none;
          transition: border-color 0.15s;
        }
        .tmc-select:focus { border-color: #3b82f6; }
        .tmc-refresh-btn {
          background: #1e40af;
          border: none;
          color: #fff;
          font-size: 15px;
          padding: 5px 10px;
          border-radius: 7px;
          cursor: pointer;
          transition: background 0.15s, transform 0.1s;
          line-height: 1;
        }
        .tmc-refresh-btn:hover { background: #2563eb; transform: scale(1.05); }
        .tmc-ar-toggle {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .tmc-toggle-wrap {
          position: relative;
          width: 34px;
          height: 18px;
          cursor: pointer;
        }
        .tmc-toggle-wrap input {
          opacity: 0;
          width: 0;
          height: 0;
          position: absolute;
        }
        .tmc-toggle-slider {
          position: absolute;
          inset: 0;
          background: #334155;
          border-radius: 999px;
          transition: background 0.2s;
        }
        .tmc-toggle-slider::before {
          content: '';
          position: absolute;
          width: 12px;
          height: 12px;
          background: #fff;
          border-radius: 50%;
          top: 3px;
          left: 3px;
          transition: transform 0.2s;
        }
        .tmc-toggle-wrap input:checked + .tmc-toggle-slider { background: #3b82f6; }
        .tmc-toggle-wrap input:checked + .tmc-toggle-slider::before { transform: translateX(16px); }
        #__tmc_countdown__ {
          font-size: 11px;
          color: #3b82f6;
          font-weight: 600;
          min-width: 60px;
        }
        /* ── Grid de ciclos */
        .tmc-body {
          overflow-y: auto;
          padding: 12px;
          flex: 1;
          scrollbar-width: thin;
          scrollbar-color: #334155 transparent;
        }
        .tmc-body::-webkit-scrollbar { width: 6px; }
        .tmc-body::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }
        .tmc-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        /* ── Card individual */
        .tmc-card {
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 10px;
          padding: 11px 13px 10px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          transition: border-color 0.2s;
        }
        .tmc-card:hover { border-color: #475569; }
        .tmc-card-title {
          font-size: 13px;
          font-weight: 700;
          color: #f1f5f9;
          letter-spacing: 0.4px;
        }
        /* ── Estados do card */
        .tmc-card-status {
          font-size: 12px;
          font-weight: 500;
          padding: 4px 0;
        }
        .tmc-loading { color: #94a3b8; animation: tmc-pulse 1.4s ease-in-out infinite; }
        @keyframes tmc-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .tmc-error   { color: #ef4444; }
        .tmc-nodata  { color: #64748b; }
        /* ── Badge de média */
        .tmc-avg-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border: 1px solid;
          border-radius: 7px;
          padding: 5px 10px;
          margin-top: 2px;
        }
        .tmc-avg-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .tmc-avg-label {
          font-size: 11px;
          color: #94a3b8;
        }
        .tmc-avg-value {
          font-size: 16px;
          font-weight: 800;
          line-height: 1;
        }
        /* ── Lista de waves */
        .tmc-wave-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-top: 4px;
        }
        .tmc-wave-item {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 3px 6px;
          background: #0f172a;
          border-radius: 5px;
        }
        .tmc-wave-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .tmc-wave-name {
          font-size: 11px;
          color: #94a3b8;
          flex: 1;
        }
        .tmc-wave-val {
          font-size: 12px;
          font-weight: 700;
        }
        /* ── Timestamp */
        .tmc-ts {
          font-size: 10px;
          color: #475569;
          margin-top: 4px;
        }
      `;
      document.head.appendChild(style);
    }

    // ── ESTRUTURA HTML DO PAINEL ───────────────
    const panel = document.createElement('div');
    panel.id = PANEL_ID;

    // Cards dos ciclos — grid 2 colunas
    const cardsHTML = ALL_CYCLES.map(cycle => `
      <div class="tmc-card" id="__tmc_card_${cycle}__">
        <div class="tmc-card-title">${cycle}</div>
        <div class="tmc-card-body" id="__tmc_card_body_${cycle}__">
          <div class="tmc-card-status tmc-loading">${t.loading}</div>
        </div>
      </div>
    `).join('');

    panel.innerHTML = `
      <!-- ── HEADER ── -->
      <div class="tmc-header" id="__tmc_header__">
        <div class="tmc-header-top">
          <div class="tmc-header-left">
            <span id="__tmc_title__">${t.title}</span>
            <span id="__tmc_base_badge__">${state.facilityId}</span>
            <span class="tmc-date-badge">${today}</span>
          </div>
          <button class="tmc-close-btn" id="__tmc_close_btn__" title="${t.close}">✕</button>
        </div>
        <div id="__tmc_subtitle__" style="font-size:11px;color:#94a3b8;margin-top:3px;">${t.subtitle}</div>
      </div>

      <!-- ── CONTROLES ── -->
      <div class="tmc-controls">
        <!-- Seletor de base -->
        <div class="tmc-ctrl-group">
          <span class="tmc-ctrl-label" id="__tmc_base_label__">${t.base}:</span>
          <select class="tmc-select" id="__tmc_facility_select__">
            ${FACILITY_OPTIONS.map(f => `<option value="${f}" ${f === state.facilityId ? 'selected' : ''}>${f}</option>`).join('')}
          </select>
        </div>
        <!-- Seletor de idioma -->
        <div class="tmc-ctrl-group">
          <span class="tmc-ctrl-label" id="__tmc_lang_label__">${t.language}:</span>
          <select class="tmc-select" id="__tmc_lang_select__">
            <option value="PT" ${state.lang === 'PT' ? 'selected' : ''}>🇧🇷 Português</option>
            <option value="EN" ${state.lang === 'EN' ? 'selected' : ''}>🇺🇸 English</option>
            <option value="ES" ${state.lang === 'ES' ? 'selected' : ''}>🇪🇸 Español</option>
          </select>
        </div>
        <!-- Botão refresh manual -->
        <button class="tmc-refresh-btn" id="__tmc_refresh_btn__" title="${t.refresh}">🔄</button>
        <!-- Toggle auto-refresh -->
        <div class="tmc-ar-toggle">
          <label class="tmc-toggle-wrap">
            <input type="checkbox" id="__tmc_ar_toggle__" ${state.autoRefresh ? 'checked' : ''}>
            <span class="tmc-toggle-slider"></span>
          </label>
          <span class="tmc-ctrl-label" id="__tmc_ar_label__">${t.autoRefresh}</span>
          <span id="__tmc_countdown__"></span>
        </div>
      </div>

      <!-- ── GRID DE CICLOS ── -->
      <div class="tmc-body">
        <div class="tmc-grid">
          ${cardsHTML}
        </div>
      </div>
    `;

    document.body.appendChild(panel);

    // ── EVENTOS ───────────────────────────────
    // Fechar
    document.getElementById('__tmc_close_btn__').addEventListener('click', () => {
      panel.style.display = 'none';
    });

    // Seletor de base
    document.getElementById('__tmc_facility_select__').addEventListener('change', e => {
      state.facilityId = e.target.value;
      savePrefs();
      render(); // atualiza badge no header
      refreshAll();
    });

    // Seletor de idioma
    document.getElementById('__tmc_lang_select__').addEventListener('change', e => {
      state.lang = e.target.value;
      savePrefs();
      render(); // re-renderiza toda a UI com novo idioma
    });

    // Botão refresh manual
    document.getElementById('__tmc_refresh_btn__').addEventListener('click', () => {
      if (state.autoRefresh) {
        stopCountdown();
        state.countdown = AUTO_REFRESH_S;
      }
      refreshAll();
    });

    // Toggle auto-refresh
    document.getElementById('__tmc_ar_toggle__').addEventListener('change', e => {
      state.autoRefresh = e.target.checked;
      if (state.autoRefresh) {
        startAutoRefresh();
        startCountdown();
      } else {
        stopAutoRefresh();
        stopCountdown();
        updateCountdownDisplay();
      }
    });

    // Drag-and-drop pelo header
    enableDrag(panel, document.getElementById('__tmc_header__'));
  }

  // ─────────────────────────────────────────────
  //  DRAG-AND-DROP
  // ─────────────────────────────────────────────
  /**
   * Habilita arrastar o painel pelo handle.
   * @param {HTMLElement} el     — elemento a ser movido
   * @param {HTMLElement} handle — alça de arrasto
   */
  function enableDrag(el, handle) {
    let isDragging = false;
    let startX, startY, origLeft, origTop;

    handle.addEventListener('mousedown', e => {
      // Ignora clique no botão fechar
      if (e.target.closest('.tmc-close-btn')) return;
      isDragging = true;
      const rect = el.getBoundingClientRect();
      startX   = e.clientX;
      startY   = e.clientY;
      origLeft = rect.left;
      origTop  = rect.top;
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });

    document.addEventListener('mousemove', e => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      let newLeft = origLeft + dx;
      let newTop  = origTop  + dy;

      // Mantém dentro da viewport
      const maxLeft = window.innerWidth  - el.offsetWidth;
      const maxTop  = window.innerHeight - el.offsetHeight;
      newLeft = Math.max(0, Math.min(newLeft, maxLeft));
      newTop  = Math.max(0, Math.min(newTop,  maxTop));

      el.style.right  = 'auto';
      el.style.left   = newLeft + 'px';
      el.style.top    = newTop  + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        document.body.style.userSelect = '';
      }
    });
  }

  // ─────────────────────────────────────────────
  //  INIT
  // ─────────────────────────────────────────────
  function init() {
    // Se o painel já existe, apenas alterna a visibilidade (toggle)
    const existing = document.getElementById(PANEL_ID);
    if (existing) {
      existing.style.display = existing.style.display === 'none' ? 'flex' : 'none';
      return;
    }

    // Cria o painel pela primeira vez
    createPanel();

    // Carrega dados iniciais
    refreshAll();

    // Inicia auto-refresh se habilitado
    if (state.autoRefresh) {
      startAutoRefresh();
      startCountdown();
    }
  }

  // ── Dispara!
  init();

})();