(function () {
  // ============================================================
  // 1. SINGLETON CHECK — toggle show/hide se já existir
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
  var BASE_URL    = 'https://logistics.adminml.com';
  var WAVES_EP    = BASE_URL + '/logistics/last-mile/monitoring/api/ops-clock/waves-status?cycleId={ciclo}&date={date}';
  var DISPATCH_EP = BASE_URL + '/logistics/last-mile/monitoring/frm-provider/api/dispatch?facilityId={base}&groupId={ciclo}&siteId=MLB&wave={n}';
  var BASES       = ['SRJ1','SRJ3','SRJ5','SRJ7','SRJ8','SRJ10','SES1','SES2'];
  var CYCLES_WAVE   = ['AM1','AM101','PM1','PM101','SD101'];
  var CYCLES_SIMPLE = ['SD','CHP'];
  var ALL_CYCLES    = ['AM1','AM101','PM1','PM101','SD','SD101','CHP'];
  var AR_INTERVAL   = 60;

  // ============================================================
  // 3. TEMA
  // ============================================================
  var T = {
    bg:      '#0d1117',
    bg2:     '#0f172a',
    border:  '#1e293b',
    grad:    'linear-gradient(135deg, #f2b705, #e6a800)',
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
  // 4. I18N
  // ============================================================
  var I18N = {
    PT: {
      title:'⏱ TMC Monitor',search:'Buscar rota...',base:'Base',lang:'Idioma',
      refresh:'🔄',autoRefresh:'Auto-refresh',next:'Próx:',all:'TODOS',
      tabRealtime:'⏱ Tempo Real',tabHistory:'📋 Histórico',tabStats:'📊 TMC Stats',
      statusAll:'Todos os Status',statusLoad:'Carregando',statusCustoms:'Em aduana',
      statusCount:'Contagem',statusDisp:'Expedido',statusWait:'Aguardando',
      areaAll:'Todas as Áreas',dock:'Doca',cycle:'Ciclo',status:'Status',
      time:'Tempo',light:'Semáforo',route:'Rota',lostTMC:'💀 PERDEU TMC',
      totalRoutes:'Total Rotas',inTMC:'Dentro TMC',attention:'Atenção',
      critical:'Crítico',lostTMCKPI:'Perderam TMC',avgTime:'Tempo Médio',
      inTMCpct:'% Dentro TMC',fetchOk:'✅ Dados atualizados!',
      fetchErr:'❌ Erro ao buscar dados',loading:'Carregando...',
      noData:'Nenhuma rota encontrada.',minimize:'_',close:'✕'
    },
    EN: {
      title:'⏱ TMC Monitor',search:'Search route...',base:'Base',lang:'Language',
      refresh:'🔄',autoRefresh:'Auto-refresh',next:'Next:',all:'ALL',
      tabRealtime:'⏱ Real Time',tabHistory:'📋 History',tabStats:'📊 TMC Stats',
      statusAll:'All Statuses',statusLoad:'Loading',statusCustoms:'Customs',
      statusCount:'Counting',statusDisp:'Dispatched',statusWait:'Waiting',
      areaAll:'All Areas',dock:'Dock',cycle:'Cycle',status:'Status',
      time:'Time',light:'Light',route:'Route',lostTMC:'💀 LOST TMC',
      totalRoutes:'Total Routes',inTMC:'Within TMC',attention:'Attention',
      critical:'Critical',lostTMCKPI:'Lost TMC',avgTime:'Avg Time',
      inTMCpct:'% Within TMC',fetchOk:'✅ Data updated!',
      fetchErr:'❌ Error fetching data',loading:'Loading...',
      noData:'No routes found.',minimize:'_',close:'✕'
    },
    ES: {
      title:'⏱ Monitor TMC',search:'Buscar ruta...',base:'Base',lang:'Idioma',
      refresh:'🔄',autoRefresh:'Auto-refresh',next:'Próx:',all:'TODOS',
      tabRealtime:'⏱ Tiempo Real',tabHistory:'📋 Historial',tabStats:'📊 Stats TMC',
      statusAll:'Todos los estados',statusLoad:'Cargando',statusCustoms:'En aduana',
      statusCount:'Conteo',statusDisp:'Despachado',statusWait:'Esperando',
      areaAll:'Todas las Áreas',dock:'Muelle',cycle:'Ciclo',status:'Estado',
      time:'Tiempo',light:'Semáforo',route:'Ruta',lostTMC:'💀 PERDIÓ TMC',
      totalRoutes:'Total Rutas',inTMC:'Dentro TMC',attention:'Atención',
      critical:'Crítico',lostTMCKPI:'Perdieron TMC',avgTime:'Tiempo Medio',
      inTMCpct:'% Dentro TMC',fetchOk:'✅ ¡Datos actualizados!',
      fetchErr:'❌ Error al obtener datos',loading:'Cargando...',
      noData:'Ninguna ruta encontrada.',minimize:'_',close:'✕'
    }
  };

  // ============================================================
  // 5. APP GLOBAL
  // ============================================================
  var APP = {
    cardTimers:{},arTimer:null,cdTimer:null,
    dragListeners:[],domListeners:[],panel:null,
    destroy:function(){
      Object.keys(APP.cardTimers).forEach(function(k){clearInterval(APP.cardTimers[k]);});
      APP.cardTimers={};
      if(APP.arTimer)clearInterval(APP.arTimer);
      if(APP.cdTimer)clearInterval(APP.cdTimer);
      APP.dragListeners.forEach(function(l){l.el.removeEventListener(l.type,l.fn);});
      APP.domListeners.forEach(function(l){l.el.removeEventListener(l.type,l.fn);});
      APP.dragListeners=[];APP.domListeners=[];
      var p=document.getElementById(PANEL_ID);if(p)p.remove();
      var s=document.getElementById(PANEL_ID+'_CSS');if(s)s.remove();
    }
  };

  // ============================================================
  // 6. STATE
  // ============================================================
  var STATE = {
    facilityId:'SRJ3',lang:'PT',cicloFiltro:'',statusFiltro:'',
    gaiolaFiltro:'',searchText:'',tab:'realtime',data:[],
    fetchTimestamp:null,autoRefresh:true,countdown:AR_INTERVAL,
    loading:false,minimized:false
  };

  // ============================================================
  // 7. HELPERS
  // ============================================================
  function t(k){return(I18N[STATE.lang]||I18N.PT)[k]||k;}
  function pad(n){return String(Math.floor(n)).padStart(2,'0');}
  function formatMMSS(s){
    if(s==null||isNaN(s))return'--:--';
    s=Math.max(0,Math.floor(s));
    return pad(Math.floor(s/60))+':'+pad(s%60);
  }
  function esc(str){
    return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function mk(tag,attrs,html){
    var el=document.createElement(tag);
    Object.keys(attrs||{}).forEach(function(k){
      if(k==='style')el.style.cssText=attrs[k];
      else el.setAttribute(k,attrs[k]);
    });
    if(html!=null)el.innerHTML=html;
    return el;
  }
  function $(sel,ctx){return(ctx||document).querySelector(sel);}
  function $$(sel,ctx){return Array.from((ctx||document).querySelectorAll(sel));}
  function on(el,type,fn){
    if(!el)return;
    el.addEventListener(type,fn);
    APP.domListeners.push({el:el,type:type,fn:fn});
  }
  function todayStr(){
    var d=new Date();
    return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
  }
  function todayBR(){
    var d=new Date();
    return pad(d.getDate())+'/'+pad(d.getMonth()+1)+'/'+d.getFullYear();
  }

  // ============================================================
  // 8. PREFS
  // ============================================================
  function loadPrefs(){
    try{var p=JSON.parse(localStorage.getItem(PREFS_KEY)||'{}');
      if(p.facilityId)STATE.facilityId=p.facilityId;
      if(p.lang)STATE.lang=p.lang;
    }catch(e){}
  }
  function savePrefs(){
    try{localStorage.setItem(PREFS_KEY,JSON.stringify({facilityId:STATE.facilityId,lang:STATE.lang}));}catch(e){}
  }

  // ============================================================
  // 9. HELPERS DE DADOS
  // ============================================================
  function cleanName(n){return String(n||'').replace(/^>/,'').trim();}
  function getCycle(r){var c=cleanName(r.route_name).split('_');return c.length>1?c[c.length-1]:'';}
  function getGaiola(r){return cleanName(r.route_name).split('_')[0]||'';}
  function getAreaLetter(r){var g=getGaiola(r);return g?g.charAt(0).toUpperCase():'';}
  function isActive(r){return!!r.process;}
  function getElapsedSec(r){
    if(!isActive(r)||r.total_elapsed_time==null)return null;
    var extra=STATE.fetchTimestamp?(Date.now()-STATE.fetchTimestamp)/1000:0;
    return r.total_elapsed_time+extra;
  }
  function getElapsedMin(r){var s=getElapsedSec(r);return s!=null?s/60:null;}
  function getLight(r){
    var m=getElapsedMin(r);
    if(m==null)return'waiting';
    if(m>=30)return'skull';
    if(m>25)return'red';
    if(m>=20)return'yellow';
    return'green';
  }
  function lightColor(l){
    return{green:T.green,yellow:T.yellow,red:T.red,skull:T.purple,waiting:T.muted}[l]||T.muted;
  }
  function statusLabel(r){
    if(!r.process)return t('statusWait');
    return{loading_packages:t('statusLoad'),customs_in_progress:t('statusCustoms'),
      carrier_counting:t('statusCount'),dispatched:t('statusDisp')}[r.process]||r.process;
  }
  function statusColor(r){
    if(!r.process)return T.muted;
    return{loading_packages:'#3b82f6',customs_in_progress:'#f59e0b',
      carrier_counting:'#8b5cf6',dispatched:T.green}[r.process]||'#94a3b8';
  }
  function areaLetters(data){
    var m={};data.forEach(function(r){m[getAreaLetter(r)]=1;});
    return Object.keys(m).filter(Boolean).sort();
  }

  // ============================================================
  // 10. TOAST
  // ============================================================
  function toast(msg,err){
    var d=mk('div',{style:'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);'
      +'background:'+(err?T.red:T.green)+';color:#fff;padding:10px 22px;border-radius:8px;'
      +'font-size:14px;font-weight:600;z-index:2147483648;box-shadow:0 4px 20px rgba(0,0,0,.4);'
      +'transition:opacity .3s'},msg);
    document.body.appendChild(d);
    setTimeout(function(){d.style.opacity='0';setTimeout(function(){d.remove();},400);},2800);
  }

  // ============================================================
  // 11. throttledFetch + batchPromises
  // ============================================================
  function tfetch(url,attempt){
    attempt=attempt||0;
    return fetch(url,{credentials:'include'}).then(function(res){
      if(res.status===429&&attempt<3){
        return new Promise(function(resolve,reject){
          setTimeout(function(){tfetch(url,attempt+1).then(resolve).catch(reject);},[1000,2000,4000][attempt]||4000);
        });
      }
      if(!res.ok)throw new Error('HTTP '+res.status);
      return res.json();
    });
  }
  function batch(items,conc,fn){
    var results=[],idx=0;
    function next(){
      if(idx>=items.length)return Promise.resolve();
      var i=idx++;
      return fn(items[i]).then(function(r){results[i]=r;return next();}).catch(function(){results[i]=[];return next();});
    }
    var workers=[];
    for(var w=0;w<Math.min(conc,items.length);w++)workers.push(next());
    return Promise.all(workers).then(function(){return results;});
  }

  // ============================================================
  // 12. fetchWaves + fetchDispatch + fetchAll
  // ============================================================
  function fetchWaves(ciclo){
    return tfetch(WAVES_EP.replace('{ciclo}',ciclo).replace('{date}',todayStr()))
      .then(function(d){
        if(Array.isArray(d))return d.map(function(w){return w.wave||w;});
        if(d&&Array.isArray(d.waves))return d.waves;
        return[1];
      }).catch(function(){return[1];});
  }
  function fetchDispatch(fac,ciclo,wave){
    return tfetch(DISPATCH_EP.replace('{base}',fac).replace('{ciclo}',ciclo).replace('{n}',wave))
      .then(function(d){return Array.isArray(d)?d:(d&&Array.isArray(d.routes)?d.routes:[]);})
      .catch(function(){return[];});
  }
  function fetchAll(){
    if(STATE.loading)return;
    STATE.loading=true;
    updateLoadingUI(true);
    var fac=STATE.facilityId,ts=Date.now(),all=[];
    var wPromises=CYCLES_WAVE.map(function(ciclo){
      return fetchWaves(ciclo).then(function(waves){
        return batch(waves,3,function(w){return fetchDispatch(fac,ciclo,w);})
          .then(function(res){res.forEach(function(a){if(Array.isArray(a))a.forEach(function(r){all.push(r);});});});
      });
    });
    var sPromises=CYCLES_SIMPLE.map(function(ciclo){
      return fetchDispatch(fac,ciclo,1).then(function(a){if(Array.isArray(a))a.forEach(function(r){all.push(r);});});
    });
    Promise.all(wPromises.concat(sPromises)).then(function(){
      var seen={},dedup=[];
      all.forEach(function(r,i){var k=r.route_id!=null?String(r.route_id):('_'+i);if(!seen[k]){seen[k]=1;dedup.push(r);}});
      STATE.data=dedup;STATE.fetchTimestamp=ts;
      STATE.loading=false;updateLoadingUI(false);
      render();toast(t('fetchOk'),false);
    }).catch(function(e){
      STATE.loading=false;updateLoadingUI(false);
      toast(t('fetchErr'),true);console.error('[TMC]',e);
    });
  }

  // ============================================================
  // 13. applyFilters + calcKPIs
  // ============================================================
  function applyFilters(data){
    return data.filter(function(r){
      if(STATE.searchText&&cleanName(r.route_name).toLowerCase().indexOf(STATE.searchText.toLowerCase())<0)return false;
      if(STATE.cicloFiltro){
        var m={AM:['AM1','AM101'],PM:['PM1','PM101'],SD:['SD','SD101'],CHP:['CHP']};
        var allowed=m[STATE.cicloFiltro]||[];
        if(allowed.length&&allowed.indexOf(getCycle(r))<0)return false;
      }
      if(STATE.statusFiltro){
        if(STATE.statusFiltro==='waiting'&&isActive(r))return false;
        if(STATE.statusFiltro!=='waiting'&&r.process!==STATE.statusFiltro)return false;
      }
      if(STATE.gaiolaFiltro&&getAreaLetter(r)!==STATE.gaiolaFiltro)return false;
      return true;
    });
  }
  function calcKPIs(data){
    var total=data.length,green=0,yellow=0,red=0,skull=0,sum=0,cnt=0;
    data.forEach(function(r){
      var l=getLight(r);
      if(l==='green')green++;else if(l==='yellow')yellow++;else if(l==='red')red++;else if(l==='skull')skull++;
      var s=getElapsedSec(r);if(s!=null){sum+=s;cnt++;}
    });
    return{total:total,green:green,yellow:yellow,red:red,skull:skull,avg:cnt?sum/cnt:0};
  }

  // ============================================================
  // 14. TIMERS DOS CARDS
  // ============================================================
  function stopTimers(){Object.keys(APP.cardTimers).forEach(function(k){clearInterval(APP.cardTimers[k]);});APP.cardTimers={};}
  function startTimer(r){
    var key=r.route_id!=null?String(r.route_id):cleanName(r.route_name);
    var el=document.getElementById('__tmc_timer_'+key+'__');
    if(!el)return;
    if(APP.cardTimers[key])clearInterval(APP.cardTimers[key]);
    APP.cardTimers[key]=setInterval(function(){
      var e=document.getElementById('__tmc_timer_'+key+'__');
      if(!e){clearInterval(APP.cardTimers[key]);delete APP.cardTimers[key];return;}
      var sec=getElapsedSec(r);
      e.textContent=formatMMSS(sec);
      e.style.color=lightColor(getLight(r));
    },1000);
  }
  function startTimers(routes){stopTimers();routes.forEach(function(r){if(isActive(r))startTimer(r);});}

  // ============================================================
  // 15. updateLoadingUI
  // ============================================================
  function updateLoadingUI(loading){
    var s=$('#__tmc_spinner__');if(s)s.style.display=loading?'inline-block':'none';
  }

  // ============================================================
  // 16. AUTO-REFRESH COUNTDOWN
  // ============================================================
  function resetCD(){STATE.countdown=AR_INTERVAL;var e=$('#__tmc_countdown__');if(e)e.textContent=t('next')+' '+STATE.countdown+'s';}
  function startAR(){
    if(APP.cdTimer)clearInterval(APP.cdTimer);
    APP.cdTimer=setInterval(function(){
      if(!STATE.autoRefresh||STATE.loading)return;
      STATE.countdown--;
      var e=$('#__tmc_countdown__');if(e)e.textContent=t('next')+' '+STATE.countdown+'s';
      if(STATE.countdown<=0){resetCD();fetchAll();}
    },1000);
  }

  // ============================================================
  // 17. RENDER DAS ABAS
  // ============================================================
  function renderRealtime(filtered){
    var p=$('#__tmc_tab_realtime__');if(!p)return;
    var active=filtered.filter(isActive).sort(function(a,b){return(getElapsedSec(b)||0)-(getElapsedSec(a)||0);});
    var waiting=filtered.filter(function(r){return!isActive(r);});
    var sorted=active.concat(waiting);
    if(!sorted.length){p.innerHTML='<p style="color:'+T.muted+';text-align:center;padding:32px">'+t('noData')+'</p>';return;}
    var html='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:12px">';
    sorted.forEach(function(r){
      var key=r.route_id!=null?String(r.route_id):cleanName(r.route_name);
      var light=getLight(r),clr=lightColor(light);
      var sec=getElapsedSec(r),timerTxt=isActive(r)?formatMMSS(sec):'--:--';
      var timerClr=isActive(r)?clr:T.muted;
      var sClr=statusColor(r);
      var skullHTML=(light==='skull')?'<div class="__tmc_skull__" style="margin-top:6px;font-size:11px;font-weight:700;color:'+T.purple+'">'+t('lostTMC')+'</div>':'';
      html+='<div style="background:'+T.card+';border-radius:10px;border-left:3px solid '+clr+';overflow:hidden">'
        +'<div style="height:4px;background:'+clr+'"></div>'
        +'<div style="padding:10px 12px">'
        +'<div style="display:flex;justify-content:space-between;align-items:flex-start">'
        +'<span style="font-size:15px;font-weight:700;color:'+T.text+'">'+esc(cleanName(r.route_name))+'</span>'
        +'<span id="__tmc_timer_'+esc(key)+'__" style="font-size:16px;font-weight:700;color:'+timerClr+';font-variant-numeric:tabular-nums">'+timerTxt+'</span>'
        +'</div>'
        +'<div style="display:flex;gap:6px;align-items:center;margin-top:6px;flex-wrap:wrap">'
        +'<span style="font-size:11px;color:'+T.muted+'">'+t('dock')+' '+(r.dock_number!=null?r.dock_number:'--')+'</span>'
        +'<span style="font-size:11px;background:#1e293b;color:'+T.gradClr+';border-radius:4px;padding:1px 6px">'+esc(getCycle(r))+'</span>'
        +'<span style="font-size:11px;background:'+sClr+'22;color:'+sClr+';border-radius:4px;padding:1px 6px;border:1px solid '+sClr+'44">'+statusLabel(r)+'</span>'
        +'</div>'+skullHTML+'</div></div>';
    });
    html+='</div>';
    p.innerHTML=html;
    startTimers(sorted);
  }

  function renderHistorico(filtered){
    var p=$('#__tmc_tab_history__');if(!p)return;
    var sorted=filtered.slice().sort(function(a,b){return(getElapsedSec(b)||0)-(getElapsedSec(a)||0);});
    if(!sorted.length){p.innerHTML='<p style="color:'+T.muted+';text-align:center;padding:32px">'+t('noData')+'</p>';return;}
    var th='padding:8px 12px;text-align:left;font-size:12px;color:'+T.muted+';border-bottom:1px solid '+T.border+';white-space:nowrap';
    var td='padding:8px 12px;font-size:13px;color:'+T.text+';border-bottom:1px solid '+T.border+'22';
    var html='<div style="overflow:auto"><table style="width:100%;border-collapse:collapse">'
      +'<thead><tr>'
      +'<th style="'+th+'">'+t('route')+'</th>'
      +'<th style="'+th+'">'+t('dock')+'</th>'
      +'<th style="'+th+'">'+t('cycle')+'</th>'
      +'<th style="'+th+'">'+t('status')+'</th>'
      +'<th style="'+th+'">'+t('time')+'</th>'
      +'<th style="'+th+'">'+t('light')+'</th>'
      +'</tr></thead><tbody>';
    sorted.forEach(function(r){
      var light=getLight(r),clr=lightColor(light);
      html+='<tr>'
        +'<td style="'+td+';font-weight:600">'+esc(cleanName(r.route_name))+'</td>'
        +'<td style="'+td+'">'+(r.dock_number!=null?r.dock_number:'--')+'</td>'
        +'<td style="'+td+'">'+esc(getCycle(r))+'</td>'
        +'<td style="'+td+'">'+statusLabel(r)+'</td>'
        +'<td style="'+td+';color:'+clr+';font-weight:700;font-variant-numeric:tabular-nums">'+formatMMSS(getElapsedSec(r))+'</td>'
        +'<td style="'+td+'"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:'+clr+'"></span></td>'
        +'</tr>';
    });
    html+='</tbody></table></div>';
    p.innerHTML=html;
  }

  function renderStats(filtered){
    var p=$('#__tmc_tab_stats__');if(!p)return;
    var kpi=calcKPIs(filtered);
    var groups={};
    filtered.forEach(function(r){var c=getCycle(r)||'—';if(!groups[c])groups[c]=[];groups[c].push(r);});
    var cs='background:'+T.card+';border-radius:10px;padding:16px;text-align:center';
    var html='<div style="padding:12px;overflow:auto">';
    // KPI globais
    html+='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">';
    [{l:t('totalRoutes'),v:kpi.total,c:T.text},{l:t('inTMC'),v:kpi.green,c:T.green},
     {l:t('attention'),v:kpi.yellow,c:T.yellow},{l:t('critical'),v:kpi.red,c:T.red},
     {l:t('lostTMCKPI'),v:kpi.skull,c:T.purple},{l:t('avgTime'),v:formatMMSS(kpi.avg),c:T.gradClr}
    ].forEach(function(k){
      html+='<div style="'+cs+'"><div style="font-size:28px;font-weight:700;color:'+k.c+'">'+k.v+'</div>'
        +'<div style="font-size:12px;color:'+T.muted+';margin-top:4px">'+k.l+'</div></div>';
    });
    html+='</div>';
    // Por ciclo
    html+='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">';
    Object.keys(groups).sort().forEach(function(c){
      var arr=groups[c],ck=calcKPIs(arr);
      var pct=ck.total?Math.round(ck.green/ck.total*100):0;
      var bc=pct>=80?T.green:pct>=50?T.yellow:T.red;
      html+='<div style="'+cs+';text-align:left">'
        +'<div style="font-size:15px;font-weight:700;color:'+T.gradClr+';margin-bottom:8px">'+esc(c)+'</div>'
        +'<div style="font-size:12px;color:'+T.muted+'">Total: <b style="color:'+T.text+'">'+ck.total+'</b></div>'
        +'<div style="font-size:12px;color:'+T.muted+';margin-top:2px">'+t('avgTime')+': <b style="color:'+T.gradClr+'">'+formatMMSS(ck.avg)+'</b></div>'
        +'<div style="font-size:12px;color:'+T.muted+';margin-top:2px">'+t('inTMCpct')+': <b style="color:'+bc+'">'+pct+'%</b></div>'
        +'<div style="margin-top:8px;background:'+T.border+';border-radius:4px;height:6px;overflow:hidden">'
        +'<div style="height:100%;width:'+pct+'%;background:'+bc+';border-radius:4px;transition:width .4s"></div></div>'
        +'</div>';
    });
    html+='</div></div>';
    p.innerHTML=html;
  }

  // ============================================================
  // 18. RENDER PRINCIPAL
  // ============================================================
  function render(){
    var filtered=applyFilters(STATE.data);
    var kpi=calcKPIs(filtered);
    var kb=$('#__tmc_kpi_bar__');
    if(kb)kb.innerHTML='<span style="color:'+T.muted+'">Total: <b style="color:'+T.text+'">'+kpi.total+'</b></span> '
      +'<span style="color:'+T.green+'">🟢'+kpi.green+'</span> '
      +'<span style="color:'+T.yellow+'">🟡'+kpi.yellow+'</span> '
      +'<span style="color:'+T.red+'">🔴'+kpi.red+'</span> '
      +'<span style="color:'+T.purple+'">💀'+kpi.skull+'</span>';
    // Área select dinâmico
    var as=$('#__tmc_area_select__');
    if(as){
      var cur=STATE.gaiolaFiltro;
      var opts='<option value="">'+t('areaAll')+'</option>'
        +areaLetters(STATE.data).map(function(l){return'<option value="'+l+'"'+(cur===l?' selected':'')+'>'+l+'</option>';}).join('');
      as.innerHTML=opts;
    }
    if(STATE.tab==='realtime')renderRealtime(filtered);
    else if(STATE.tab==='history')renderHistorico(filtered);
    else if(STATE.tab==='stats')renderStats(filtered);
  }

  // ============================================================
  // 19. injectStyles
  // ============================================================
  function injectStyles(){
    if(document.getElementById(PANEL_ID+'_CSS'))return;
    var css=[
      '@keyframes tmcPulse{0%,100%{opacity:1}50%{opacity:.25}}',
      '.__tmc_skull__{animation:tmcPulse 1s ease-in-out infinite}',
      '#'+PANEL_ID+' *{box-sizing:border-box;font-family:system-ui,-apple-system,sans-serif}',
      '#'+PANEL_ID+' ::-webkit-scrollbar{width:6px;height:6px}',
      '#'+PANEL_ID+' ::-webkit-scrollbar-track{background:'+T.bg2+'}',
      '#'+PANEL_ID+' ::-webkit-scrollbar-thumb{background:'+T.border+';border-radius:3px}',
      '#'+PANEL_ID+' select,#'+PANEL_ID+' input{background:'+T.bg+';color:'+T.text+';border:1px solid '+T.border+';border-radius:6px;padding:5px 8px;font-size:12px;outline:none}',
      '#'+PANEL_ID+' select:focus,#'+PANEL_ID+' input:focus{border-color:'+T.gradClr+'}'
    ].join('\n');
    var s=mk('style',{id:PANEL_ID+'_CSS',type:'text/css'},css);
    document.head.appendChild(s);
  }

  // ============================================================
  // 20. buildPanelHTML
  // ============================================================
  function buildPanelHTML(){
    var baseOpts=BASES.map(function(b){return'<option value="'+b+'"'+(STATE.facilityId===b?' selected':'')+'>'+b+'</option>';}).join('');
    var langOpts=['PT','EN','ES'].map(function(l){return'<option value="'+l+'"'+(STATE.lang===l?' selected':'')+'>'+l+'</option>';}).join('');
    var cycleBar=['','CHP','AM','PM','SD'].map(function(c){
      var act=STATE.cicloFiltro===c;
      var lbl=c===''?t('all'):c;
      return'<button data-cycle="'+c+'" style="border:none;border-radius:6px;padding:5px 12px;font-size:12px;font-weight:600;cursor:pointer;background:'+(act?T.gradClr:T.border)+';color:'+(act?'#000':'#94a3b8')+'">'+lbl+'</button>';
    }).join('');
    var statusOpts=[['',t('statusAll')],['loading_packages',t('statusLoad')],['customs_in_progress',t('statusCustoms')],
      ['carrier_counting',t('statusCount')],['dispatched',t('statusDisp')],['waiting',t('statusWait')]]
      .map(function(o){return'<option value="'+o[0]+'"'+(STATE.statusFiltro===o[0]?' selected':'')+'>'+o[1]+'</option>';}).join('');
    var letters=areaLetters(STATE.data);
    var areaOpts='<option value="">'+t('areaAll')+'</option>'+letters.map(function(l){return'<option value="'+l+'"'+(STATE.gaiolaFiltro===l?' selected':'')+'>'+l+'</option>';}).join('');
    function tabBtn(key,lbl){
      var act=STATE.tab===key;
      return'<button data-tab="'+key+'" style="border:none;padding:8px 16px;font-size:13px;font-weight:600;cursor:pointer;border-radius:6px 6px 0 0;background:'+(act?T.gradClr:'transparent')+';color:'+(act?'#000':'#64748b')+'">'+lbl+'</button>';
    }
    var inputStyle='background:'+T.bg+';color:'+T.text+';border:1px solid '+T.border+';border-radius:6px;padding:5px 8px;font-size:12px;outline:none';
    return''
      // HEADER
      +'<div id="__tmc_header__" style="background:'+T.grad+';color:#000;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;border-radius:14px 14px 0 0;cursor:grab;user-select:none">'
      +'<div style="display:flex;align-items:center;gap:10px">'
      +'<span style="font-size:15px;font-weight:700">'+t('title')+'</span>'
      +'<span style="background:#00000020;color:#000;border-radius:4px;padding:2px 8px;font-size:12px;font-weight:700">'+STATE.facilityId+'</span>'
      +'<span style="font-size:12px;opacity:.7">'+todayBR()+'</span>'
      +'<span id="__tmc_spinner__" style="display:none;width:12px;height:12px;border:2px solid #00000030;border-top-color:#000;border-radius:50%;animation:tmcPulse .5s linear infinite"></span>'
      +'</div>'
      +'<div style="display:flex;gap:6px">'
      +'<button id="__tmc_minimize__" style="background:transparent;border:none;font-size:16px;cursor:pointer;color:#000;padding:2px 6px">'+t('minimize')+'</button>'
      +'<button id="__tmc_close__" style="background:transparent;border:none;font-size:16px;cursor:pointer;color:#000;padding:2px 6px">'+t('close')+'</button>'
      +'</div></div>'
      // BODY
      +'<div id="__tmc_body__" style="display:'+(STATE.minimized?'none':'flex')+';flex-direction:column;flex:1;overflow:hidden">'
      // CONTROLES
      +'<div style="background:'+T.bg2+';padding:10px 12px;border-bottom:1px solid '+T.border+'">'
      // Linha 1
      +'<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap">'
      +'<input id="__tmc_search__" type="text" placeholder="'+t('search')+'" value="'+esc(STATE.searchText)+'" style="'+inputStyle+';flex:1;min-width:120px">'
      +'<select id="__tmc_base_select__" style="'+inputStyle+'">'+baseOpts+'</select>'
      +'<select id="__tmc_lang_select__" style="'+inputStyle+'">'+langOpts+'</select>'
      +'<button id="__tmc_refresh_btn__" style="background:'+T.border+';border:none;color:'+T.text+';border-radius:6px;padding:5px 10px;font-size:14px;cursor:pointer">'+t('refresh')+'</button>'
      +'<label style="display:flex;align-items:center;gap:5px;font-size:12px;color:'+T.muted+';cursor:pointer"><input id="__tmc_ar_cb__" type="checkbox"'+(STATE.autoRefresh?' checked':'')+'> '+t('autoRefresh')+'</label>'
      +'<span id="__tmc_countdown__" style="font-size:12px;color:'+T.muted+'">'+t('next')+' '+STATE.countdown+'s</span>'
      +'</div>'
      // Linha 2
      +'<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">'+cycleBar+'</div>'
      // Linha 3
      +'<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">'
      +'<select id="__tmc_status_select__" style="'+inputStyle+'">'+statusOpts+'</select>'
      +'<select id="__tmc_area_select__" style="'+inputStyle+'">'+areaOpts+'</select>'
      +'<span id="__tmc_kpi_bar__" style="font-size:12px;margin-left:auto"></span>'
      +'</div></div>'
      // ABAS
      +'<div style="background:'+T.bg2+';padding:0 12px;display:flex;gap:4px;border-bottom:1px solid '+T.border+'">'
      +tabBtn('realtime',t('tabRealtime'))+tabBtn('history',t('tabHistory'))+tabBtn('stats',t('tabStats'))
      +'</div>'
      // CONTEÚDO
      +'<div style="flex:1;overflow:auto">'
      +'<div id="__tmc_tab_realtime__" style="display:'+(STATE.tab==='realtime'?'block':'none')+'"></div>'
      +'<div id="__tmc_tab_history__" style="display:'+(STATE.tab==='history'?'block':'none')+'"></div>'
      +'<div id="__tmc_tab_stats__" style="display:'+(STATE.tab==='stats'?'block':'none')+'"></div>'
      +'</div>'
      +'</div>'; // fecha body
  }

  // ============================================================
  // 21. enableDrag
  // ============================================================
  function enableDrag(panel){
    var header=$('#__tmc_header__',panel);if(!header)return;
    var dragging=false,ox=0,oy=0;
    function md(e){
      if(e.target.tagName==='BUTTON')return;
      dragging=true;ox=e.clientX-panel.offsetLeft;oy=e.clientY-panel.offsetTop;
      header.style.cursor='grabbing';e.preventDefault();
    }
    function mm(e){
      if(!dragging)return;
      var x=Math.max(0,Math.min(e.clientX-ox,window.innerWidth-panel.offsetWidth));
      var y=Math.max(0,Math.min(e.clientY-oy,window.innerHeight-panel.offsetHeight));
      panel.style.left=x+'px';panel.style.top=y+'px';panel.style.right='auto';
    }
    function mu(){dragging=false;header.style.cursor='grab';}
    header.addEventListener('mousedown',md);
    document.addEventListener('mousemove',mm);
    document.addEventListener('mouseup',mu);
    APP.dragListeners.push({el:header,type:'mousedown',fn:md});
    APP.dragListeners.push({el:document,type:'mousemove',fn:mm});
    APP.dragListeners.push({el:document,type:'mouseup',fn:mu});
  }

  // ============================================================
  // 22. attachEventListeners
  // ============================================================
  function attachEvents(panel){
    on($('#__tmc_close__',panel),'click',function(){APP.destroy();});
    on($('#__tmc_minimize__',panel),'click',function(){
      STATE.minimized=!STATE.minimized;
      var b=$('#__tmc_body__',panel);if(b)b.style.display=STATE.minimized?'none':'flex';
    });
    on($('#__tmc_search__',panel),'input',function(e){STATE.searchText=e.target.value;render();});
    on($('#__tmc_base_select__',panel),'change',function(e){STATE.facilityId=e.target.value;savePrefs();fetchAll();});
    on($('#__tmc_lang_select__',panel),'change',function(e){STATE.lang=e.target.value;savePrefs();rebuildPanel();});
    on($('#__tmc_refresh_btn__',panel),'click',function(){resetCD();fetchAll();});
    on($('#__tmc_ar_cb__',panel),'change',function(e){STATE.autoRefresh=e.target.checked;if(STATE.autoRefresh)resetCD();});
    $$('[data-cycle]',panel).forEach(function(btn){
      on(btn,'click',function(){
        STATE.cicloFiltro=btn.getAttribute('data-cycle');
        $$('[data-cycle]',panel).forEach(function(b){
          var act=b.getAttribute('data-cycle')===STATE.cicloFiltro;
          b.style.background=act?T.gradClr:T.border;b.style.color=act?'#000':'#94a3b8';
        });
        render();
      });
    });
    on($('#__tmc_status_select__',panel),'change',function(e){STATE.statusFiltro=e.target.value;render();});
    on($('#__tmc_area_select__',panel),'change',function(e){STATE.gaiolaFiltro=e.target.value;render();});
    $$('[data-tab]',panel).forEach(function(btn){
      on(btn,'click',function(){
        STATE.tab=btn.getAttribute('data-tab');
        $$('[id^="__tmc_tab_"]',panel).forEach(function(p){p.style.display='none';});
        var ap=$('#__tmc_tab_'+STATE.tab+'__',panel);if(ap)ap.style.display='block';
        $$('[data-tab]',panel).forEach(function(b){
          var act=b.getAttribute('data-tab')===STATE.tab;
          b.style.background=act?T.gradClr:'transparent';b.style.color=act?'#000':'#64748b';
        });
        render();
      });
    });
  }

  // ============================================================
  // 23. rebuildPanel
  // ============================================================
  function rebuildPanel(){
    stopTimers();
    var panel=document.getElementById(PANEL_ID);if(!panel)return;
    APP.domListeners.forEach(function(l){l.el.removeEventListener(l.type,l.fn);});
    APP.domListeners=[];
    panel.innerHTML=buildPanelHTML();
    attachEvents(panel);
    render();
  }

  // ============================================================
  // 24. createPanel
  // ============================================================
  function createPanel(){
    injectStyles();
    var panel=mk('div',{
      id:PANEL_ID,
      style:'position:fixed;top:16px;right:16px;width:700px;max-height:90vh;'
        +'background:'+T.bg+';border:1px solid '+T.border+';border-radius:14px;'
        +'box-shadow:'+T.shadow+';z-index:2147483647;display:flex;flex-direction:column;overflow:hidden'
    });
    panel.innerHTML=buildPanelHTML();
    document.body.appendChild(panel);
    APP.panel=panel;
    enableDrag(panel);
    attachEvents(panel);
    return panel;
  }

  // ============================================================
  // 25. INIT
  // ============================================================
  function init(){
    loadPrefs();
    createPanel();
    startAR();
    render();
    fetchAll();
  }

  init();

})();