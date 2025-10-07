// ==UserScript==
// @name         WB FBS Остатки
// @namespace    https://github.com/Vatnik12/WB
// @version      1.3.1
// @description  Wb tools
// @author       Vatnik
// @homepageURL  https://github.com/Vatnik12/WB
// @supportURL   https://github.com/Vatnik12/WB/issues
// @updateURL    https://raw.githubusercontent.com/Vatnik12/WB/main/scripts/wb-fbs-ostatki.user.js
// @downloadURL  https://raw.githubusercontent.com/Vatnik12/WB/main/scripts/wb-fbs-ostatki.user.js
// @match        https://seller.wildberries.ru/marketplace-stocks-management*
// @grant        GM_addStyle
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// @run-at       document-idle
// @license      MIT
// ==/UserScript==


(function () {
  'use strict';

  const BRAND = {
    purple:'#7e3bff', purpleD:'#6a2cd6',
    red:'#ff2d55',
    glassLight:'rgba(255,255,255,0.70)',
    glassDark:'rgba(20,22,28,0.72)',
    fabGlass:'rgba(126,59,255,0.35)',
    fabBorder:'rgba(126,59,255,0.65)',
    border:'rgba(0,0,0,0.08)', borderDark:'rgba(255,255,255,0.14)',
    lightText:'#111', darkText:'#f2f4f8', darkMuted:'#c9cfe2', darkRed:'#ff6b6b'
  };
  const LS_POS='wb_fbs_sum_pos', LS_COLLAPSED='wb_fbs_sum_collapsed', LS_THEME='wb_fbs_sum_theme';

  let calcBusy=false, autoRun=false;
  const seenInputs = new Map();

  // ---------- UI ----------
  GM_addStyle(`
    :root { --wb-shadow: 0 18px 45px rgba(0,0,0,.18); --wb-radius: 16px; }
    #wb-fbs-root{ position:fixed; right:20px; bottom:20px; z-index:2147483647; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,Arial,sans-serif; letter-spacing:.1px; transition:left .15s ease, top .15s ease; }
    #wb-fbs-root .wb-fab{ display:inline-flex; align-items:center; gap:10px; padding:10px 14px; border-radius:9999px; background:${BRAND.fabGlass}; border:1px solid ${BRAND.fabBorder}; color:#fff; text-shadow:0 1px 0 rgba(0,0,0,.25); backdrop-filter: blur(12px) saturate(120%); box-shadow: var(--wb-shadow); cursor:grab; user-select:none; transition: transform .18s cubic-bezier(.2,.8,.2,1), box-shadow .2s, opacity .2s; }
    #wb-fbs-root .wb-fab:active{ cursor:grabbing; transform:scale(.98); }
    #wb-fbs-root .wb-fab:hover{ transform:translateY(-1px); box-shadow:0 22px 44px rgba(126,59,255,.28); }
    #wb-fbs-root .wb-fab .wb-title{ font-weight:800; font-size:13px; }
    #wb-fbs-root .wb-fab .wb-mini-badge{ background:#fff; color:${BRAND.purpleD}; border:0; padding:2px 8px; border-radius:10px; font-weight:800; font-size:12px; }
    #wb-fbs-root .wb-panel{ position:absolute; right:0; bottom:58px; width:460px; background:${BRAND.glassLight}; border:1px solid ${BRAND.border}; border-radius:var(--wb-radius); box-shadow:var(--wb-shadow); backdrop-filter: blur(14px) saturate(140%); transform: translateY(10px) scale(.98); opacity:0; visibility:hidden; transition: transform .22s, opacity .22s, visibility .22s; }
    #wb-fbs-root .wb-panel.show{ transform: translateY(0) scale(1); opacity:1; visibility:visible; }
    #wb-fbs-root .wb-header{ display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-bottom:1px solid ${BRAND.border}; cursor:grab; }
    #wb-fbs-root .wb-header:active{ cursor:grabbing; }
    #wb-fbs-root .wb-header-title{ display:flex; align-items:center; gap:10px; font-weight:800; font-size:14px; color:${BRAND.lightText}; }
    #wb-fbs-root .wb-dot{ width:10px; height:10px; border-radius:50%; background: linear-gradient(135deg, ${BRAND.purple}, ${BRAND.purpleD}); box-shadow: 0 0 0 3px rgba(126,59,255,.18); }
    #wb-fbs-root .wb-right{ display:flex; gap:8px; align-items:center; }
    #wb-fbs-root .wb-theme{ position:relative; display:inline-grid; grid-auto-flow:column; gap:2px; background:rgba(0,0,0,.06); padding:4px; border-radius:999px; }
    #wb-fbs-root .wb-theme .opt{ position:relative; z-index:2; min-width:42px; display:inline-flex; align-items:center; justify-content:center; padding:6px 8px; border-radius:999px; border:none; background:transparent; cursor:pointer; font-size:14px; font-weight:800; color:#333; }
    #wb-fbs-root .wb-theme .selector{ position:absolute; z-index:1; top:4px; bottom:4px; width:calc(50% - 4px); left:4px; border-radius:999px; background:#fff; box-shadow:0 2px 8px rgba(0,0,0,.12); transition:left .22s; }
    #wb-fbs-root .wb-close{ background:transparent; border:none; cursor:pointer; color:#8a8fa3; width:28px; height:28px; border-radius:8px; display:flex; align-items:center; justify-content:center; transition:.15s; }
    #wb-fbs-root .wb-close:hover{ background:rgba(0,0,0,.06); color:#333; }
    #wb-fbs-root .wb-body{ padding:12px 16px 16px; }
    #wb-fbs-root .wb-actions{ display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-bottom:8px; }
    #wb-fbs-root .wb-btn{ display:inline-flex; align-items:center; justify-content:center; gap:8px; border:none; border-radius:10px; padding:11px 12px; cursor:pointer; font-weight:800; font-size:13px; transition:transform .12s, box-shadow .2s, filter .2s; }
    #wb-fbs-root .wb-btn.primary{ background:linear-gradient(135deg, ${BRAND.purple}, ${BRAND.purpleD}); color:#fff; }
    #wb-fbs-root .wb-btn.primary:hover{ transform:translateY(-1px); box-shadow:0 10px 24px rgba(126,59,255,.28); }
    #wb-fbs-root .wb-btn.ghost{ background:#eef0f6; color:#1f2330; }
    #wb-fbs-root .wb-btn.ghost:hover{ background:#e7e9f2; }
    #wb-fbs-root .wb-btn.full{ grid-column:1 / -1; }
    #wb-fbs-root .wb-card{ background:rgba(255,255,255,0.60); border:1px solid #e3e6ef; border-radius:12px; padding:12px; color:${BRAND.lightText}; font-size:14px; backdrop-filter: blur(10px) saturate(130%); display:none; }
    #wb-fbs-root .wb-card.show{ display:block; }
    #wb-fbs-root .wb-row{ display:flex; align-items:center; justify-content:space-between; padding:8px 0; border-bottom:1px dashed rgba(0,0,0,.15); }
    #wb-fbs-root .wb-row:last-child{ border-bottom:none; }
    #wb-fbs-root .wb-val{ font-weight:800; font-size:16px; color:${BRAND.red}; }
    #wb-fbs-root .wb-help{ display:flex; justify-content:flex-end; margin-bottom:10px; }
    #wb-fbs-root .wb-help .q{ width:24px; height:24px; border-radius:50%; background:rgba(255,255,255,.85); color:#222; font-weight:900; display:inline-flex; align-items:center; justify-content:center; position:relative; box-shadow:0 2px 8px rgba(0,0,0,.12); user-select:none; }
    #wb-fbs-root .wb-help .q::after{ content:'?'; font-size:14px; line-height:1; }
    #wb-fbs-root .wb-help .q:hover .popup{ opacity:1; transform:translateY(0); pointer-events:auto; }
    #wb-fbs-root .wb-help .popup{ position:absolute; right:0; top:calc(100% + 10px); width:360px; max-width:min(360px, 82vw); background:rgba(20,22,28,.92); color:#f5f6fb; padding:14px 16px; border-radius:12px; z-index:2147483647; opacity:0; transform:translateY(6px); transition:opacity .2s, transform .2s; pointer-events:none; backdrop-filter: blur(12px) saturate(140%); box-shadow:0 16px 40px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.06); }
    #wb-fbs-root .wb-help .popup::before{ content:''; position:absolute; right:10px; top:-8px; width:12px; height:12px; background:inherit; transform:rotate(45deg); filter:drop-shadow(0 -2px 2px rgba(0,0,0,.12)); }
    #wb-fbs-root .wb-faq-title{ font-weight:700; font-size:13px; margin-bottom:8px; color:#fff; }
    #wb-fbs-root .wb-faq-ul{ margin:0; padding:0; list-style:none; }
    #wb-fbs-root .wb-faq-ul .dot{ margin-top:6px; width:6px; height:6px; border-radius:50%; background:#c5d0ff; flex:0 0 6px; }
    #wb-fbs-root .wb-toast{ position:absolute; left:50%; transform:translateX(-50%) translateY(6px); bottom:10px; background:rgba(17,20,28,.96); color:#fff; padding:10px 12px; border-radius:10px; font-size:13px; font-weight:700; box-shadow:var(--wb-shadow); display:flex; gap:8px; align-items:center; opacity:0; transition:opacity .2s, transform .2s; }
    #wb-fbs-root .wb-toast.show{ opacity:1; transform:translateX(-50%) translateY(0); }
    #wb-fbs-root .wb-toast .ico{ width:16px; height:16px; display:inline-flex; align-items:center; justify-content:center; }
    #wb-fbs-root[data-theme="dark"] .wb-panel{ background:${BRAND.glassDark}; border-color:${BRAND.borderDark}; }
    #wb-fbs-root[data-theme="dark"] .wb-header-title{ color:${BRAND.darkText}; }
    #wb-fbs-root[data-theme="dark"] .wb-theme{ background:rgba(255,255,255,.08); }
    #wb-fbs-root[data-theme="dark"] .wb-theme .opt{ color:${BRAND.darkText}; }
    #wb-fbs-root[data-theme="dark"] .wb-theme .selector{ background:#1f2330; }
    #wb-fbs-root[data-theme="dark"] .wb-btn.ghost{ background:#2a2f3b; color:${BRAND.darkText}; }
    #wb-fbs-root[data-theme="dark"] .wb-btn.ghost:hover{ background:#323947; }
    #wb-fbs-root[data-theme="dark"] .wb-card{ background:rgba(20,22,28,0.60); border-color:${BRAND.borderDark}; color:${BRAND.darkText}; }
    #wb-fbs-root[data-theme="dark"] .wb-row{ border-bottom:1px dashed rgba(255,255,255,.18); }
    #wb-fbs-root[data-theme="dark"] .wb-val{ color:${BRAND.darkRed}; }
  `);

  const html = `
    <div id="wb-fbs-root" data-theme="light">
      <button class="wb-fab" id="wb-fab" title="Открыть сумматор FBS">
        <span class="wb-logo" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 4v16M4 12h16" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>
        </span>
        <span class="wb-title">FBS Остатки</span>
        <span class="wb-mini-badge" id="wb-mini-badge">—</span>
      </button>

      <div class="wb-panel" id="wb-panel">
        <div class="wb-header" id="wb-header">
          <div class="wb-header-title"><span class="wb-dot"></span> Сумма по «Количество, шт.»</div>
          <div class="wb-right">
            <div class="wb-theme"><div class="selector" id="theme-selector"></div>
              <button class="opt" data-mode="light" id="theme-light">☀️</button>
              <button class="opt" data-mode="dark"  id="theme-dark">🌙</button>
            </div>
            <button class="wb-close" id="wb-close" title="Свернуть">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            </button>
          </div>
        </div>

        <div class="wb-body">
          <div class="wb-actions">
            <button class="wb-btn primary" id="btn-calc">Посчитать</button>
            <button class="wb-btn primary" id="btn-auto">Авто-сбор</button>
            <button class="wb-btn ghost"   id="btn-stop">Стоп</button>
            <button class="wb-btn ghost"   id="btn-reset">Сброс</button>
            <button class="wb-btn ghost full" id="btn-copy">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 9h10v10H9zM5 5h10v10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              Копировать
            </button>
          </div>

          <div class="wb-help">
            <span class="q">
              <div class="popup">
                <div class="wb-faq-title">Как пользоваться</div>
                <ul class="wb-faq-ul">
                  <li><span class="dot"></span><span><b>Посчитать</b> — прибавляет видимые строки (не дублирует уже учтённые).</span></li>
                  <li><span class="dot"></span><span><b>Авто-сбор</b> — крутит реальный скролл таблицы и собирает всё до конца списка. <b>Стоп</b> — прерывание.</span></li>
                  <li><span class="dot"></span><span><b>Сброс</b> — обнуляет итог и кэш увиденных строк.</span></li>
                </ul>
              </div>
            </span>
          </div>

          <div class="wb-card" id="result">
            <div class="wb-row"><strong>Остатки FBS, шт</strong><span class="wb-val" id="v-total">0</span></div>
          </div>
        </div>

        <div class="wb-toast" id="toast"><span class="ico">✅</span><span id="toast-text">Готово</span></div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', html);

  // init
  restorePosition();
  setTheme(loadTheme() || 'light');
  setCollapsed((localStorage.getItem(LS_COLLAPSED) ?? '1') === '1');

  $('#wb-fab').on('click', () => togglePanel(true));
  $('#wb-close').on('click', () => togglePanel(false));
  $('#theme-light').on('click', () => setTheme('light'));
  $('#theme-dark').on('click', () => setTheme('dark'));
  makeDraggable($('#wb-fbs-root'), $('#wb-header'));
  makeDraggable($('#wb-fbs-root'), $('#wb-fab'));

  $('#btn-calc').on('click', accumulateVisiblePage);
  $('#btn-auto').on('click', startAutoCollect);
  $('#btn-stop').on('click', stopAutoCollect);
  $('#btn-reset').on('click', () => { setShown(0); seenInputs.clear(); toast('Сброшено'); });
  $('#btn-copy').on('click', () => {
    const txt = `Остатки FBS, шт: ${$('#v-total').text().trim() || '0'}`;
    navigator.clipboard.writeText(txt).then(()=>toast('Скопировано')).catch(()=>toast('Не удалось скопировать'));
  });

  // ---------- core ----------
  function parseIntSafe(v){ const n = parseInt(String(v).replace(/\s/g,''),10); return isNaN(n) ? 0 : n; }
  function formatInt(n){ return (n||0).toString().replace(/\B(?=(\d{3})+(?!\d))/g,' '); }
  function setShown(total){ $('#v-total').text(formatInt(total)); $('#wb-mini-badge').text(total ? formatInt(total) : '—'); }
  function getShown(){ return parseIntSafe($('#v-total').text()); }

  function getAllQuantityInputs(){
    // Колонка «Количество, шт.» — инпуты data-testid="input", name^="amount-"
    return Array.from(document.querySelectorAll('input[data-testid="input"][name^="amount-"]'));
  }

  // собираем только новые инпуты (по id/name)
  function collectNewFromDOM(){
    let add = 0, newlySeen = 0;
    for (const inp of getAllQuantityInputs()){
      const key = inp.id || inp.name || inp.getAttribute('data-testid')+'-'+Math.random();
      const val = parseIntSafe(inp.value || inp.getAttribute('value') || 0);
      if (!seenInputs.has(key)){
        seenInputs.set(key, val);
        add += val;
        newlySeen++;
      }
    }
    return { add, newlySeen, totalSeen: seenInputs.size };
  }

  async function accumulateVisiblePage(){
    if (calcBusy || autoRun) return;
    calcBusy = true;
    const before = getShown();
    const { add, newlySeen } = collectNewFromDOM();
    setShown(before + add);
    $('#result').addClass('show');
    toast(newlySeen ? `Добавлено: ${formatInt(add)} (новых: ${newlySeen})` : 'Новых строк нет');
    calcBusy = false;
  }

  // ---------- scroll container detection (фикс)
  function getComputedOverflowY(el){
    try { return window.getComputedStyle(el).overflowY; } catch { return ''; }
  }
  function isScrollable(el){
    if (!el) return false;
    const overflowY = getComputedOverflowY(el);
    const canScroll = el.scrollHeight - el.clientHeight > 8;
    return (overflowY === 'auto' || overflowY === 'scroll' || canScroll) && el.clientHeight > 0;
  }
  function closestScrollableFrom(el){
    let cur = el;
    while (cur && cur !== document.body){
      if (isScrollable(cur)) return cur;
      cur = cur.parentElement;
    }
    return null;
  }
  function findScrollContainer(){
    // 1) стартуем с Table-wrapper — как на твоём скрине
    const tw = document.querySelector('[data-testid="Table-wrapper"]');
    const fromTW = tw && (closestScrollableFrom(tw) || tw.parentElement);
    if (fromTW && isScrollable(fromTW)) return fromTW;

    // 2) явные классы/обёртки таблицы
    const candidates = [
      document.querySelector('div[class*="Table-wrapper"][class*="table"]'),
      document.querySelector('div[class*="Table-wrapper"]'),
      document.querySelector('[data-testid="Remain-of-goods-table-view"]'),
    ].filter(Boolean);
    for (const c of candidates){
      const s = closestScrollableFrom(c);
      if (s) return s;
    }

    // 3) запасной вариант — сама страница
    return document.scrollingElement || document.documentElement || document.body;
  }

  // ---- авто-сбор: телепорт в самый низ + адаптивные паузы и "тычок" вверх ----
    async function startAutoCollect() {
        if (autoRun) return;
        autoRun = true;
        $('#btn-auto').prop('disabled', true).text('Собираю…');

        const sc = findScrollContainer();           // ваша функция поиска скролл-контейнера
        const BASE_WAIT = 2300;                     // базовая пауза
        const EXTRA_WAIT_BIG = 3000;                // доп. ожидание при больших объёмах
        const NUDGE_DELAY = 500;                    // пауза после «тычка» вверх
        const STABLE_LIMIT = 2;                     // сколько циклов без изменений считаем концом

        let stableRounds = 0;
        let lastSeenCount = seenInputs.size;        // множество id/DOM-узлов которые уже учтены
        let lastScrollH = sc.scrollHeight;

        while (autoRun) {
            // 0) текущее знание о сумме
            let totalNow = getShown();                // ваша функция чтения показанной суммы (число)

            // 1) если очень большие объёмы — делаем «тычок»: вверх на 30% вьюпорта
            if (totalNow >= 1_500_000) {
                sc.scrollTop = Math.max(0, sc.scrollTop - Math.round(sc.clientHeight * 0.3));
                try { sc.dispatchEvent(new Event('scroll', { bubbles: true })); } catch {}
                await sleep(NUDGE_DELAY);
            }

            // 2) прыгнуть в самый низ
            sc.scrollTop = sc.scrollHeight;
            try { sc.dispatchEvent(new Event('scroll', { bubbles: true })); } catch {}
            try { sc.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: sc.clientHeight })); } catch {}

            // 3) ждать подгрузку (адаптивно)
            let waitMs = BASE_WAIT;
            totalNow = getShown();                    // пересчитаем после прыжка
            if (totalNow >= 1_000_000) waitMs += EXTRA_WAIT_BIG;
            await sleep(waitMs);

            // 4) собрать, что появилось
            const beforeCount = seenInputs.size;
            const beforeShown = getShown();
            const added = collectNewFromDOM();        // ваша функция: возвращает { add: <число добавленных к сумме> }
            if (added.add) {
                setShown(beforeShown + added.add);      // обновить UI
                $('#result').addClass('show');
            }

            // 5) критерии остановки
            const nowCount = seenInputs.size;
            const nowScrollH = sc.scrollHeight;

            if (nowCount === beforeCount && nowScrollH === lastScrollH) {
                stableRounds += 1;
            } else {
                stableRounds = 0;
            }

            lastSeenCount = nowCount;
            lastScrollH = nowScrollH;

            if (stableRounds >= STABLE_LIMIT) break;
        }

        autoRun = false;
        $('#btn-auto').prop('disabled', false).text('Авто-сбор');
        toast('Готово');
    }

    function stopAutoCollect() {
        if (!autoRun) { toast('Авто-сбор не запущен'); return; }
        autoRun = false;
        $('#btn-auto').prop('disabled', false).text('Авто-сбор');
        toast('Остановлено');
    }


  // ---------- theme / panel / drag ----------
  function setTheme(mode){
    $('#wb-fbs-root').attr('data-theme', mode);
    localStorage.setItem(LS_THEME, mode);
    $('#theme-selector').css('left', mode === 'light' ? '4px' : 'calc(50% + 2px)');
  }
  function loadTheme(){ return localStorage.getItem(LS_THEME); }
  function togglePanel(open){
    const $panel = $('#wb-panel');
    const $fab   = $('#wb-fab');
    if (open) { $panel.addClass('show'); localStorage.setItem(LS_COLLAPSED,'0'); }
    else      { $panel.removeClass('show'); localStorage.setItem(LS_COLLAPSED,'1'); }
    $fab.css('opacity', open ? 0.9 : 1);
  }
  function setCollapsed(collapsed){ togglePanel(!collapsed ? true : false); }

  function makeDraggable($root, $handle){
    let drag=false, sx=0, sy=0, bl=0, bt=0;
    $handle.on('mousedown touchstart', (e)=>{
      const ev = e.type==='touchstart' ? e.originalEvent.touches[0] : e;
      drag=true; sx=ev.clientX; sy=ev.clientY; const r=$root[0].getBoundingClientRect(); bl=r.left; bt=r.top; e.preventDefault();
    });
    $(window).on('mousemove touchmove', (e)=>{
      if(!drag) return; const ev = e.type==='touchmove' ? e.originalEvent.touches[0] : e;
      const dx=ev.clientX-sx, dy=ev.clientY-sy; const L=Math.min(Math.max(10, bl+dx), window.innerWidth-10); const T=Math.min(Math.max(10, bt+dy), window.innerHeight-10);
      $root.css({left:L+'px', top:T+'px', right:'auto', bottom:'auto'});
    });
    $(window).on('mouseup touchend', ()=>{ if(!drag) return; drag=false; persistPos(); });
  }
  function persistPos(){
    const rect=$('#wb-fbs-root')[0].getBoundingClientRect();
    localStorage.setItem(LS_POS, JSON.stringify({left:rect.left, top:rect.top}));
  }
  function restorePosition(){
    const raw=localStorage.getItem(LS_POS); if(!raw) return;
    try{
      const pos=JSON.parse(raw);
      if(typeof pos.left==='number' && typeof pos.top==='number'){
        $('#wb-fbs-root').css({left:pos.left+'px', top:pos.top+'px', right:'auto', bottom:'auto'});
      }
    }catch{}
  }

  function toast(msg){
    $('#toast-text').text(msg);
    $('#toast').addClass('show');
    setTimeout(()=> $('#toast').removeClass('show'), 1600);
  }
  function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }
})();
