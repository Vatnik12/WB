// ==UserScript==
// @name         WB Остатки
// @namespace    https://github.com/Vatnik12/WB
// @version      3.6.1
// @description  WB tools
// @author       Vatnik
// @homepageURL  https://github.com/Vatnik12/WB
// @supportURL   https://github.com/Vatnik12/WB/issues
// @updateURL    https://raw.githubusercontent.com/Vatnik12/WB/main/scripts/wb-remains.user.js
// @downloadURL  https://raw.githubusercontent.com/Vatnik12/WB/main/scripts/wb-remains.user.js
// @match        https://seller.wildberries.ru/analytics-reports/warehouse-remains
// @grant        GM_addStyle
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// @run-at       document-idle
// @license      MIT
// ==/UserScript==


(function () {
  'use strict';

  const SELECTORS = { tableRows: 'tbody tr' };
  const COLUMNS   = { IN_TRANSIT: 2, IN_RETURNS: 3, IN_WAREHOUSES: 4 };
  const LS_POS = 'wb_remains_panel_pos';
  const LS_COLLAPSED = 'wb_remains_panel_collapsed';
  const LS_THEME = 'wb_remains_theme'; // 'light' | 'dark'

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

  let calcBusy = false;

  waitForTable().then(init).catch(()=>console.log('WB Остатки: таблица не найдена.'));

  function waitForTable(){
    return new Promise((resolve,reject)=>{
      let t=0, max=40;
      const iv=setInterval(()=>{
        t++;
        if ($(SELECTORS.tableRows).length) { clearInterval(iv); resolve(); }
        if (t>=max) { clearInterval(iv); reject(); }
      }, 500);
    });
  }

  function init(){
    if ($('#wb-remains-root').length) return;

    GM_addStyle(`
      :root { --wb-shadow: 0 18px 45px rgba(0,0,0,.18); --wb-radius: 16px; }
      #wb-remains-root{
        position:fixed; right:20px; bottom:20px; z-index:2147483647;
        font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,Arial,sans-serif;
        letter-spacing:.1px; transition:left .15s ease, top .15s ease;
      }

      /* Пилюля */
      #wb-remains-root .wb-fab{
        display:inline-flex; align-items:center; gap:10px;
        padding:10px 14px; border-radius:9999px;
        background:${BRAND.fabGlass}; border:1px solid ${BRAND.fabBorder};
        color:#fff; text-shadow:0 1px 0 rgba(0,0,0,.25);
        backdrop-filter: blur(12px) saturate(120%);
        box-shadow: var(--wb-shadow);
        cursor:grab; user-select:none;
        transition: transform .18s cubic-bezier(.2,.8,.2,1), box-shadow .2s, opacity .2s;
      }
      #wb-remains-root .wb-fab:active{ cursor:grabbing; transform:scale(.98); }
      #wb-remains-root .wb-fab:hover{ transform:translateY(-1px); box-shadow:0 22px 44px rgba(126,59,255,.28); }
      #wb-remains-root .wb-fab .wb-title{ font-weight:800; font-size:13px; }
      #wb-remains-root .wb-fab .wb-mini-badge{
        background:#fff; color:${BRAND.purpleD}; border:0; padding:2px 8px; border-radius:10px;
        font-weight:800; font-size:12px;
      }

      /* Панель — стекло */
      #wb-remains-root .wb-panel{
        position:absolute; right:0; bottom:58px; width:430px;
        background:${BRAND.glassLight}; border:1px solid ${BRAND.border};
        border-radius:var(--wb-radius); box-shadow:var(--wb-shadow);
        backdrop-filter: blur(14px) saturate(140%);
        transform: translateY(10px) scale(.98);
        opacity:0; visibility:hidden;
        transition: transform .22s cubic-bezier(.2,.8,.2,1), opacity .22s, visibility .22s;
        overflow: visible;
      }
      #wb-remains-root .wb-panel.show{ transform: translateY(0) scale(1); opacity:1; visibility:visible; }

      #wb-remains-root .wb-header{
        display:flex; align-items:center; justify-content:space-between;
        padding:12px 16px; border-bottom:1px solid ${BRAND.border}; cursor:grab;
      }
      #wb-remains-root .wb-header:active{ cursor:grabbing; }
      #wb-remains-root .wb-header-title{
        display:flex; align-items:center; gap:10px; font-weight:800; font-size:14px; color:${BRAND.lightText};
      }
      #wb-remains-root .wb-dot{
        width:10px; height:10px; border-radius:50%;
        background: linear-gradient(135deg, ${BRAND.purple}, ${BRAND.purpleD});
        box-shadow: 0 0 0 3px rgba(126,59,255,.18);
      }
      #wb-remains-root .wb-right{ display:flex; gap:8px; align-items:center; }

      /* Селектор темы */
      #wb-remains-root .wb-theme{
        position:relative; display:inline-grid; grid-auto-flow:column; gap:2px;
        background:rgba(0,0,0,.06); padding:4px; border-radius:999px;
      }
      #wb-remains-root .wb-theme .opt{
        position:relative; z-index:2; min-width:42px;
        display:inline-flex; align-items:center; justify-content:center;
        padding:6px 8px; border-radius:999px; border:none; background:transparent;
        cursor:pointer; font-size:14px; font-weight:800; color:#333;
      }
      #wb-remains-root .wb-theme .selector{
        position:absolute; z-index:1; top:4px; bottom:4px; width:calc(50% - 4px);
        left:4px; border-radius:999px; background:#fff; box-shadow:0 2px 8px rgba(0,0,0,.12);
        transition:left .22s cubic-bezier(.2,.8,.2,1);
      }

      #wb-remains-root .wb-close{
        background:transparent; border:none; cursor:pointer; color:#8a8fa3;
        width:28px; height:28px; border-radius:8px; display:flex; align-items:center; justify-content:center;
        transition:background .15s ease, color .15s ease;
      }
      #wb-remains-root .wb-close:hover{ background:rgba(0,0,0,.06); color:#333; }

      #wb-remains-root .wb-body{ padding:12px 16px 16px; }

      /* Кнопки */
      #wb-remains-root .wb-actions{ display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-bottom:8px; }
      #wb-remains-root .wb-btn{
        display:inline-flex; align-items:center; justify-content:center; gap:8px;
        border:none; border-radius:10px; padding:11px 12px; cursor:pointer;
        font-weight:800; font-size:13px; transition:transform .12s ease, box-shadow .2s ease, filter .2s;
      }
      #wb-remains-root .wb-btn.primary{ background:linear-gradient(135deg, ${BRAND.purple}, ${BRAND.purpleD}); color:#fff; }
      #wb-remains-root .wb-btn.primary:hover{ transform:translateY(-1px); box-shadow:0 10px 24px rgba(126,59,255,.28); }
      #wb-remains-root .wb-btn.ghost{ background:#eef0f6; color:#1f2330; }
      #wb-remains-root .wb-btn.ghost:hover{ background:#e7e9f2; }
      #wb-remains-root .wb-btn.full{ grid-column:1 / -1; }

      /* ==== FAQ: чистый стеклянный поповер ==== */
      #wb-remains-root .wb-help{ display:flex; justify-content:flex-end; margin-bottom:10px; }
      #wb-remains-root .wb-help .q{
        width:24px; height:24px; border-radius:50%;
        background:rgba(255,255,255,.85); color:#222; font-weight:900;
        display:inline-flex; align-items:center; justify-content:center;
        position:relative; box-shadow:0 2px 8px rgba(0,0,0,.12);
        user-select:none;
      }
      #wb-remains-root[data-theme="dark"] .wb-help .q{ background:rgba(42,47,59,.95); color:${BRAND.darkText}; }
      #wb-remains-root .wb-help .q::after{ content:'?'; font-size:14px; line-height:1; }
      #wb-remains-root .wb-help .q:hover .popup{ opacity:1; transform:translateY(0); pointer-events:auto; }

      #wb-remains-root .wb-help .popup{
        position:absolute; right:0; top:calc(100% + 10px);
        width:340px; max-width:min(340px, 82vw);
        background:rgba(20,22,28,.92); color:#f5f6fb;
        padding:14px 16px; border-radius:12px; z-index:2147483647;
        opacity:0; transform:translateY(6px); transition:opacity .2s, transform .2s; pointer-events:none;
        backdrop-filter: blur(12px) saturate(140%);
        box-shadow:0 16px 40px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.06);
        text-align:left; line-height:1.5; word-break:break-word;
      }
      #wb-remains-root .wb-help .popup::before{
        content:''; position:absolute; right:10px; top:-8px; width:12px; height:12px;
        background:inherit; transform:rotate(45deg);
        filter:drop-shadow(0 -2px 2px rgba(0,0,0,.12));
      }
      #wb-remains-root .wb-faq-title{ font-weight:700; font-size:13px; margin-bottom:8px; letter-spacing:.1px; color:#fff; }
      #wb-remains-root .wb-faq-ul{ margin:0; padding:0; list-style:none; }
      #wb-remains-root .wb-faq-ul li{ display:flex; gap:10px; align-items:flex-start; margin:6px 0; color:#e8ebf7; font-size:13px; }
      #wb-remains-root .wb-faq-ul li .dot{ margin-top:6px; width:6px; height:6px; border-radius:50%; background:#c5d0ff; flex:0 0 6px; }
      #wb-remains-root .wb-kbd, #wb-remains-root .wb-chip{
        display:inline-block; padding:2px 8px; border-radius:8px; font-size:12px; line-height:1.2;
        border:1px solid rgba(255,255,255,.22); background:rgba(255,255,255,.10); color:#fff; font-weight:700;
      }
      #wb-remains-root[data-theme="light"] .wb-help .popup{ background:rgba(255,255,255,.97); color:#222; }
      #wb-remains-root[data-theme="light"] .wb-faq-ul li{ color:#2b2f3a; }
      #wb-remains-root[data-theme="light"] .wb-kbd, #wb-remains-root[data-theme="light"] .wb-chip{
        background:rgba(0,0,0,.06); border-color:rgba(0,0,0,.12); color:#111;
      }

      /* Прогресс */
      #wb-remains-root .wb-progress-wrap{ display:none; margin:6px 0 10px; }
      #wb-remains-root .wb-progress-text{ font-size:12px; color:#6d7285; margin-bottom:6px; }
      #wb-remains-root .wb-progress{
        position:relative; height:8px; border-radius:999px; overflow:hidden;
        background:linear-gradient(180deg, rgba(0,0,0,.06), rgba(0,0,0,.12));
      }
      #wb-remains-root .wb-progress .bar{
        position:absolute; left:0; top:0; bottom:0; width:0%;
        background:linear-gradient(90deg, ${BRAND.purple}, ${BRAND.purpleD});
        animation: wbbar 1.6s ease-in-out infinite;
      }
      @keyframes wbbar{
        0%{ width:8%; transform:translateX(0); }
        50%{ width:70%; transform:translateX(20%); }
        100%{ width:8%; transform:translateX(100%); }
      }

      /* Результаты (скрыты до расчёта) */
      #wb-remains-root .wb-card{
        background:rgba(255,255,255,0.60); border:1px solid #e3e6ef; border-radius:12px; padding:12px;
        color:${BRAND.lightText}; font-size:14px; backdrop-filter: blur(10px) saturate(130%);
        display:none;
      }
      #wb-remains-root .wb-card.show{ display:block; }
      #wb-remains-root .wb-section{
        display:flex; align-items:center; justify-content:space-between; padding:8px 0; border-bottom:1px dashed rgba(0,0,0,.15);
      }
      #wb-remains-root .wb-section:last-child{ border-bottom:none; }
      #wb-remains-root .wb-section strong{ color:${BRAND.lightText}; font-weight:700; }
      #wb-remains-root .wb-total{ font-weight:800; font-size:16px; color:${BRAND.red}; }

      /* Toast */
      #wb-remains-root .wb-toast{
        position:absolute; left:50%; transform:translateX(-50%) translateY(6px);
        bottom:10px; background:rgba(17,20,28,.96); color:#fff;
        padding:10px 12px; border-radius:10px; font-size:13px; font-weight:700;
        box-shadow:var(--wb-shadow); display:flex; gap:8px; align-items:center;
        opacity:0; transition:opacity .2s, transform .2s;
      }
      #wb-remains-root .wb-toast.show{ opacity:1; transform:translateX(-50%) translateY(0); }
      #wb-remains-root .wb-toast .ico{ width:16px; height:16px; display:inline-flex; align-items:center; justify-content:center; }

      /* DARK THEME */
      #wb-remains-root[data-theme="dark"] .wb-panel{ background:${BRAND.glassDark}; border-color:${BRAND.borderDark}; }
      #wb-remains-root[data-theme="dark"] .wb-header-title{ color:${BRAND.darkText}; }
      #wb-remains-root[data-theme="dark"] .wb-theme{ background:rgba(255,255,255,.08); }
      #wb-remains-root[data-theme="dark"] .wb-theme .opt{ color:${BRAND.darkText}; }
      #wb-remains-root[data-theme="dark"] .wb-theme .selector{ background:#1f2330; }
      #wb-remains-root[data-theme="dark"] .wb-btn.ghost{ background:#2a2f3b; color:${BRAND.darkText}; }
      #wb-remains-root[data-theme="dark"] .wb-btn.ghost:hover{ background:#323947; }
      #wb-remains-root[data-theme="dark"] .wb-progress{ background:linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.14)); }
      #wb-remains-root[data-theme="dark"] .wb-progress-text{ color:${BRAND.darkMuted}; }
      #wb-remains-root[data-theme="dark"] .wb-card{ background:rgba(20,22,28,0.60); border-color:${BRAND.borderDark}; color:${BRAND.darkText}; }
      #wb-remains-root[data-theme="dark"] .wb-section{ border-bottom:1px dashed rgba(255,255,255,.18); }
      #wb-remains-root[data-theme="dark"] .wb-section strong{ color:${BRAND.darkText}; }
      #wb-remains-root[data-theme="dark"] .wb-total{ color:${BRAND.darkRed}; }
    `);

    const html = `
      <div id="wb-remains-root" data-theme="light">
        <!-- Пилюля -->
        <button class="wb-fab" id="wb-fab" title="Открыть калькулятор">
          <span class="wb-logo" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 4v16M4 12h16" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>
          </span>
          <span class="wb-title">Остатки WB</span>
          <span class="wb-mini-badge" id="wb-mini-badge">—</span>
        </button>

        <!-- Панель -->
        <div class="wb-panel" id="wb-panel">
          <div class="wb-header" id="wb-header">
            <div class="wb-header-title"><span class="wb-dot"></span> Калькулятор остатков</div>
            <div class="wb-right">
              <div class="wb-theme" id="wb-theme">
                <div class="selector" id="wb-theme-selector"></div>
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
              <button class="wb-btn primary" id="wb-calc">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 4v16M4 12h16" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>
                Посчитать
              </button>
              <button class="wb-btn ghost" id="wb-reset">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 13a8 8 0 1 0 2-5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                Сброс
              </button>
              <button class="wb-btn ghost full" id="wb-copy">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 9h10v10H9zM5 5h10v10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                Копировать
              </button>
            </div>

            <!-- FAQ -->
            <div class="wb-help">
              <span class="q">
                <div class="popup">
                  <div class="wb-faq-title">Как пользоваться</div>
                  <ul class="wb-faq-ul">
                    <li><span class="dot"></span><span>Внизу таблицы выбери <span class="wb-chip">Показать записей: 100</span>.</span></li>
                    <li><span class="dot"></span><span>Если страниц несколько — на каждой жми <span class="wb-kbd">Посчитать</span>. Суммы <u>накапливаются</u>.</span></li>
                    <li><span class="dot"></span><span><span class="wb-kbd">Сброс</span> обнуляет суммы и скрывает результаты.</span></li>
                    <li><span class="dot"></span><span><span class="wb-kbd">Копировать</span> копирует в буфер: ЛК, дату и итог <em>Всего на складах</em>.</span></li>
                  </ul>
                </div>
              </span>
            </div>

            <!-- Прогресс -->
            <div class="wb-progress-wrap" id="wb-progress-wrap">
              <div class="wb-progress-text" id="wb-progress-text">Считаю изо всех сил…</div>
              <div class="wb-progress"><div class="bar" id="wb-progress-bar"></div></div>
            </div>

            <!-- Результаты (изначально скрыты) -->
            <div class="wb-card" id="wb-result">
              <div class="wb-section"><strong>В пути до получателей</strong><span class="wb-total" id="r-a">0</span></div>
              <div class="wb-section"><strong>В пути возвраты на склад WB</strong><span class="wb-total" id="r-b">0</span></div>
              <div class="wb-section"><strong>Всего находится на складах</strong><span class="wb-total" id="r-c">0</span></div>
            </div>
          </div>

          <div class="wb-toast" id="wb-toast"><span class="ico">✅</span><span id="wb-toast-text">Готово</span></div>
        </div>
      </div>
    `;

    $('body').append(html);

    // state
    restorePosition();
    setTheme(loadTheme() || 'light');
    const storedCollapsed = localStorage.getItem(LS_COLLAPSED);
    setCollapsed(storedCollapsed ? storedCollapsed === '1' : true);

    // handlers
    $('#wb-fab').on('click', () => togglePanel(true));
    $('#wb-close').on('click', () => togglePanel(false));
    $('#wb-calc').on('click', runCalculation);
    $('#wb-reset').on('click', resetShownTotals);
    $('#wb-copy').on('click', copyOneLine);
    $('#theme-light').on('click', ()=> setTheme('light'));
    $('#theme-dark').on('click',  ()=> setTheme('dark'));

    // draggable
    makeDraggable($('#wb-remains-root'), $('#wb-header'));
    makeDraggable($('#wb-remains-root'), $('#wb-fab'));

    updateThemeSelector();
  }

  // ===== темы =====
  function setTheme(mode){
    $('#wb-remains-root').attr('data-theme', mode);
    localStorage.setItem(LS_THEME, mode);
    updateThemeSelector();
  }
  function loadTheme(){ return localStorage.getItem(LS_THEME); }
  function updateThemeSelector(){
    const mode = $('#wb-remains-root').attr('data-theme') || 'light';
    $('#wb-theme-selector').css('left', mode === 'light' ? '4px' : 'calc(50% + 2px)');
  }

  // ===== панель =====
  function togglePanel(open){
    const $panel = $('#wb-panel');
    const $fab   = $('#wb-fab');
    if (open) { $panel.addClass('show'); localStorage.setItem(LS_COLLAPSED,'0'); }
    else      { $panel.removeClass('show'); localStorage.setItem(LS_COLLAPSED,'1'); }
    $fab.css('opacity', open ? 0.9 : 1);
  }
  function setCollapsed(collapsed){ togglePanel(!collapsed ? true : false); }

  // ===== прогресс/подсчет =====
  async function runCalculation(){
    if (calcBusy) return;
    calcBusy = true;
    showProgress(true, 'Считаю изо всех сил…');
    await sleep(200);

    // текущее, показанное в карточке
    const curA = parseNum($('#r-a').text());
    const curB = parseNum($('#r-b').text());
    const curC = parseNum($('#r-c').text());

    // считаем текущую страницу
    const page = calculatePage(); // {a,b,c}

    // накапливаем
    const sumA = curA + page.a;
    const sumB = curB + page.b;
    const sumC = curC + page.c;

    setShown(sumA, sumB, sumC);
    $('#wb-result').addClass('show');
    showProgress(false);
    toast('Добавлено к итогу');
    calcBusy = false;
  }

  function showProgress(on, text=''){
    const $wrap = $('#wb-progress-wrap');
    const $txt  = $('#wb-progress-text');
    if (on){ $txt.text(text); $wrap.show(); }
    else  { $wrap.hide(); }
  }

  // ===== расчёт =====
  function formatNumber(n){ return (n||0).toString().replace(/\B(?=(\d{3})+(?!\d))/g,' '); }
  function parseNum(str){ return parseInt((str||'').toString().replace(/\s/g,''),10) || 0; }
  function calculatePage(){
    let a=0,b=0,c=0;
    $(SELECTORS.tableRows).each(function(){
      const $tds=$(this).find('td');
      const v1=$tds.eq(COLUMNS.IN_TRANSIT).text().trim().replace(/\s/g,'');
      const v2=$tds.eq(COLUMNS.IN_RETURNS).text().trim().replace(/\s/g,'');
      const v3=$tds.eq(COLUMNS.IN_WAREHOUSES).text().trim().replace(/\s/g,'');
      a+=parseInt(v1,10)||0;
      b+=parseInt(v2,10)||0;
      c+=parseInt(v3,10)||0;
    });
    return { a,b,c };
  }

  // ===== отображение =====
  function setShown(a,b,c){
    $('#r-a').text(formatNumber(a));
    $('#r-b').text(formatNumber(b));
    $('#r-c').text(formatNumber(c));
    $('#wb-mini-badge').text(formatNumber(c));
  }

  // ===== Сброс — скрыть карточку и обнулить =====
  function resetShownTotals(){
    setShown(0,0,0);
    $('#wb-result').removeClass('show');
    toast('Сброшено');
  }

  // ===== копирование: ЛК + дата + только «Всего на складах» =====
  function getAccountName(){
    const btn = document.querySelector('button[data-testid="desktop-profile-select-button-chips-component"][data-name="Chips"]');
    if (!btn) return '';
    const textDiv = btn.querySelector('div');
    const raw = (textDiv ? textDiv.textContent : btn.textContent) || '';
    return raw.trim().replace(/\s+/g, ' ');
  }
  function getUpdatedAt(){
    const el = document.querySelector('span[data-name="Text"]');
    if (el){
      const m = el.textContent.trim().match(/Данные обновлены\s+(.+)/i);
      if (m && m[1]) return m[1].trim(); // "01.10.2025 в 19:10"
    }
    return new Date().toLocaleString('ru-RU');
  }
  function copyOneLine(){
    const acc  = getAccountName() || '—';
    const when = getUpdatedAt();
    const total = ($('#r-c').text().trim() || '0');
    const text = `Лк - ${acc}\nДата: ${when}\nОстатки на складах WB: ${total}`;
    navigator.clipboard.writeText(text)
      .then(()=>toast('Скопировано'))
      .catch(()=>toast('Не удалось скопировать'));
  }

  // ===== drag & persist =====
  function makeDraggable($root, $handle){
    let drag=false, sx=0, sy=0, bl=0, bt=0;
    $handle.on('mousedown touchstart', (e)=>{
      const ev = e.type==='touchstart' ? e.originalEvent.touches[0] : e;
      drag=true; sx=ev.clientX; sy=ev.clientY;
      const r=$root[0].getBoundingClientRect(); bl=r.left; bt=r.top;
      e.preventDefault();
    });
    $(window).on('mousemove touchmove', (e)=>{
      if(!drag) return;
      const ev = e.type==='touchmove' ? e.originalEvent.touches[0] : e;
      const dx=ev.clientX-sx, dy=ev.clientY-sy;
      const L=Math.min(Math.max(10, bl+dx), window.innerWidth-10);
      const T=Math.min(Math.max(10, bt+dy), window.innerHeight-10);
      $root.css({left:L+'px', top:T+'px', right:'auto', bottom:'auto'});
    });
    $(window).on('mouseup touchend', ()=>{
      if(!drag) return; drag=false; persistPos();
    });
  }
  function persistPos(){
    const rect=$('#wb-remains-root')[0].getBoundingClientRect();
    localStorage.setItem(LS_POS, JSON.stringify({left:rect.left, top:rect.top}));
  }
  function restorePosition(){
    const raw=localStorage.getItem(LS_POS); if(!raw) return;
    try{
      const pos=JSON.parse(raw);
      if(typeof pos.left==='number' && typeof pos.top==='number'){
        $('#wb-remains-root').css({left:pos.left+'px', top:pos.top+'px', right:'auto', bottom:'auto'});
      }
    }catch{}
  }

  // utils
  function toast(msg){
    const $t = $('#wb-toast');
    $('#wb-toast-text').text(msg);
    $t.addClass('show');
    setTimeout(()=> $t.removeClass('show'), 1600);
  }
  function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }
})();
