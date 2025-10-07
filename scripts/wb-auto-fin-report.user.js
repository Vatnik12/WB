// ==UserScript==
// @name         WB Авто-Фин отчёт
// @namespace    https://github.com/Vatnik12/WB
// @version      2.0.1
// @description  WB tools
// @author       Vatnik
// @homepageURL  https://github.com/Vatnik12/WB
// @supportURL   https://github.com/Vatnik12/WB/issues
// @updateURL    https://raw.githubusercontent.com/Vatnik12/WB/main/scripts/wb-auto-fin-report.user.js
// @downloadURL  https://raw.githubusercontent.com/Vatnik12/WB/main/scripts/wb-auto-fin-report.user.js
// @match        https://seller.wildberries.ru/suppliers-mutual-settlements/reports-implementations/reports-*
// @grant        GM_setClipboard
// @grant        GM_addStyle
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

(function () {
  'use strict';

  // ------------ CONSTS / THEME ------------
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
  const LS_POS = 'wb_fin_panel_pos';
  const LS_COLLAPSED = 'wb_fin_panel_collapsed';
  const LS_THEME = 'wb_fin_theme';

  // ------------ STYLES ------------
  GM_addStyle(`
    :root { --wb-shadow: 0 18px 45px rgba(0,0,0,.18); --wb-radius: 16px; }
    #wb-fin-root{
      position:fixed; right:20px; bottom:20px; z-index:2147483647;
      font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,Arial,sans-serif;
      letter-spacing:.1px; transition:left .15s ease, top .15s ease;
    }

    /* FAB pill */
    #wb-fin-root .wb-fab{
      display:inline-flex; align-items:center; gap:10px;
      padding:10px 14px; border-radius:9999px;
      background:${BRAND.fabGlass}; border:1px solid ${BRAND.fabBorder};
      color:#fff; text-shadow:0 1px 0 rgba(0,0,0,.25);
      backdrop-filter: blur(12px) saturate(120%);
      box-shadow: var(--wb-shadow);
      cursor:grab; user-select:none;
      transition: transform .18s cubic-bezier(.2,.8,.2,1), box-shadow .2s, opacity .2s;
    }
    #wb-fin-root .wb-fab:active{ cursor:grabbing; transform:scale(.98); }
    #wb-fin-root .wb-fab:hover{ transform:translateY(-1px); box-shadow:0 22px 44px rgba(126,59,255,.28); }
    #wb-fin-root .wb-fab .wb-title{ font-weight:800; font-size:13px; }
    #wb-fin-root .wb-fab .wb-mini-badge{
      background:#fff; color:${BRAND.purpleD}; border:0; padding:2px 8px; border-radius:10px;
      font-weight:800; font-size:12px;
    }

    /* Panel */
    #wb-fin-root .wb-panel{
      position:absolute; right:0; bottom:58px; width:460px;
      background:${BRAND.glassLight}; border:1px solid ${BRAND.border};
      border-radius:var(--wb-radius); box-shadow:var(--wb-shadow);
      backdrop-filter: blur(14px) saturate(140%);
      transform: translateY(10px) scale(.98);
      opacity:0; visibility:hidden;
      transition: transform .22s cubic-bezier(.2,.8,.2,1), opacity .22s, visibility .22s;
      overflow: visible;
    }
    #wb-fin-root .wb-panel.show{ transform: translateY(0) scale(1); opacity:1; visibility:visible; }

    #wb-fin-root .wb-header{
      display:flex; align-items:center; justify-content:space-between;
      padding:12px 16px; border-bottom:1px solid ${BRAND.border}; cursor:grab;
    }
    #wb-fin-root .wb-header:active{ cursor:grabbing; }
    #wb-fin-root .wb-header-title{
      display:flex; align-items:center; gap:10px; font-weight:800; font-size:14px; color:${BRAND.lightText};
    }
    #wb-fin-root .wb-dot{
      width:10px; height:10px; border-radius:50%;
      background: linear-gradient(135deg, ${BRAND.purple}, ${BRAND.purpleD});
      box-shadow: 0 0 0 3px rgba(126,59,255,.18);
    }
    #wb-fin-root .wb-right{ display:flex; gap:8px; align-items:center; }

    /* Theme selector */
    #wb-fin-root .wb-theme{
      position:relative; display:inline-grid; grid-auto-flow:column; gap:2px;
      background:rgba(0,0,0,.06); padding:4px; border-radius:999px;
    }
    #wb-fin-root .wb-theme .opt{
      position:relative; z-index:2; min-width:42px;
      display:inline-flex; align-items:center; justify-content:center;
      padding:6px 8px; border-radius:999px; border:none; background:transparent;
      cursor:pointer; font-size:14px; font-weight:800; color:#333;
    }
    #wb-fin-root .wb-theme .selector{
      position:absolute; z-index:1; top:4px; bottom:4px; width:calc(50% - 4px);
      left:4px; border-radius:999px; background:#fff; box-shadow:0 2px 8px rgba(0,0,0,.12);
      transition:left .22s cubic-bezier(.2,.8,.2,1);
    }

    #wb-fin-root .wb-close{
      background:transparent; border:none; cursor:pointer; color:#8a8fa3;
      width:28px; height:28px; border-radius:8px; display:flex; align-items:center; justify-content:center;
      transition:background .15s ease, color .15s ease;
    }
    #wb-fin-root .wb-close:hover{ background:rgba(0,0,0,.06); color:#333; }

    #wb-fin-root .wb-body{ padding:12px 16px 16px; }

    /* Buttons */
    #wb-fin-root .wb-actions{ display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-bottom:8px; }
    #wb-fin-root .wb-btn{
      display:inline-flex; align-items:center; justify-content:center; gap:8px;
      border:none; border-radius:10px; padding:11px 12px; cursor:pointer;
      font-weight:800; font-size:13px; transition:transform .12s ease, box-shadow .2s ease, filter .2s;
    }
    #wb-fin-root .wb-btn.primary{ background:linear-gradient(135deg, ${BRAND.purple}, ${BRAND.purpleD}); color:#fff; }
    #wb-fin-root .wb-btn.primary:hover{ transform:translateY(-1px); box-shadow:0 10px 24px rgba(126,59,255,.28); }
    #wb-fin-root .wb-btn.dark{ background:#1f2330; color:#fff; }
    #wb-fin-root .wb-btn.dark:hover{ filter:brightness(1.08); }
    #wb-fin-root .wb-btn.ghost{ background:#eef0f6; color:#1f2330; }
    #wb-fin-root .wb-btn.ghost:hover{ background:#e7e9f2; }

    /* FAQ popover */
    #wb-fin-root .wb-help{ display:flex; justify-content:flex-end; margin-bottom:10px; }
    #wb-fin-root .wb-help .q{
      width:24px; height:24px; border-radius:50%;
      background:rgba(255,255,255,.85); color:#222; font-weight:900;
      display:inline-flex; align-items:center; justify-content:center;
      position:relative; box-shadow:0 2px 8px rgba(0,0,0,.12);
      user-select:none;
    }
    #wb-fin-root[data-theme="dark"] .wb-help .q{ background:rgba(42,47,59,.95); color:${BRAND.darkText}; }
    #wb-fin-root .wb-help .q::after{ content:'?'; font-size:14px; line-height:1; }
    #wb-fin-root .wb-help .q:hover .popup{ opacity:1; transform:translateY(0); pointer-events:auto; }

    #wb-fin-root .wb-help .popup{
      position:absolute; right:0; top:calc(100% + 10px);
      width:360px; max-width:min(360px, 82vw);
      background:rgba(20,22,28,.92); color:#f5f6fb;
      padding:14px 16px; border-radius:12px; z-index:2147483647;
      opacity:0; transform:translateY(6px); transition:opacity .2s, transform .2s; pointer-events:none;
      backdrop-filter: blur(12px) saturate(140%);
      box-shadow:0 16px 40px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.06);
      text-align:left; line-height:1.5; word-break:break-word;
    }
    #wb-fin-root .wb-help .popup::before{
      content:''; position:absolute; right:10px; top:-8px; width:12px; height:12px;
      background:inherit; transform:rotate(45deg);
      filter:drop-shadow(0 -2px 2px rgba(0,0,0,.12));
    }
    #wb-fin-root .wb-faq-title{ font-weight:700; font-size:13px; margin-bottom:8px; color:#fff; }
    #wb-fin-root .wb-faq-ul{ margin:0; padding:0; list-style:none; }
    #wb-fin-root .wb-faq-ul li{ display:flex; gap:10px; align-items:flex-start; margin:6px 0; color:#e8ebf7; font-size:13px; }
    #wb-fin-root .wb-faq-ul .dot{ margin-top:6px; width:6px; height:6px; border-radius:50%; background:#c5d0ff; flex:0 0 6px; }
    #wb-fin-root .wb-kbd, #wb-fin-root .wb-chip{
      display:inline-block; padding:2px 8px; border-radius:8px; font-size:12px; line-height:1.2;
      border:1px solid rgba(255,255,255,.22); background:rgba(255,255,255,.10); color:#fff; font-weight:700;
    }
    #wb-fin-root[data-theme="light"] .wb-help .popup{ background:rgba(255,255,255,.97); color:#222; }
    #wb-fin-root[data-theme="light"] .wb-faq-ul li{ color:#2b2f3a; }
    #wb-fin-root[data-theme="light"] .wb-kbd, #wb-fin-root[data-theme="light"] .wb-chip{
      background:rgba(0,0,0,.06); border-color:rgba(0,0,0,.12); color:#111;
    }

    /* Progress */
    #wb-fin-root .wb-progress-wrap{ display:none; margin:6px 0 10px; }
    #wb-fin-root .wb-progress-text{ font-size:12px; color:#6d7285; margin-bottom:6px; }
    #wb-fin-root .wb-progress{
      position:relative; height:8px; border-radius:999px; overflow:hidden;
      background:linear-gradient(180deg, rgba(0,0,0,.06), rgba(0,0,0,.12));
    }
    #wb-fin-root .wb-progress .bar{
      position:absolute; left:0; top:0; bottom:0; width:0%;
      background:linear-gradient(90deg, ${BRAND.purple}, ${BRAND.purpleD});
      animation: wbbar 1.6s ease-in-out infinite;
    }
    @keyframes wbbar{
      0%{ width:8%; transform:translateX(0); }
      50%{ width:70%; transform:translateX(20%); }
      100%{ width:8%; transform:translateX(100%); }
    }

    /* Result card (hidden before calc) */
    #wb-fin-root .wb-card{
      background:rgba(255,255,255,0.60); border:1px solid #e3e6ef; border-radius:12px; padding:12px;
      color:${BRAND.lightText}; font-size:14px; backdrop-filter: blur(10px) saturate(130%);
      display:none;
    }
    #wb-fin-root .wb-card.show{ display:block; }
    #wb-fin-root .wb-row{ display:flex; align-items:center; justify-content:space-between; padding:8px 0; border-bottom:1px dashed rgba(0,0,0,.15); }
    #wb-fin-root .wb-row:last-child{ border-bottom:none; }
    #wb-fin-root .wb-row strong{ color:${BRAND.lightText}; font-weight:700; }
    #wb-fin-root .wb-val{ font-weight:800; font-size:16px; color:${BRAND.red}; }

    #wb-fin-root .wb-note{ font-size:12px; margin-top:6px; color:#6d7285; }

    /* Toast */
    #wb-fin-root .wb-toast{
      position:absolute; left:50%; transform:translateX(-50%) translateY(6px);
      bottom:10px; background:rgba(17,20,28,.96); color:#fff;
      padding:10px 12px; border-radius:10px; font-size:13px; font-weight:700;
      box-shadow:var(--wb-shadow); display:flex; gap:8px; align-items:center;
      opacity:0; transition:opacity .2s, transform .2s;
    }
    #wb-fin-root .wb-toast.show{ opacity:1; transform:translateX(-50%) translateY(0); }
    #wb-fin-root .wb-toast .ico{ width:16px; height:16px; display:inline-flex; align-items:center; justify-content:center; }

    /* Dark theme overrides */
    #wb-fin-root[data-theme="dark"] .wb-panel{ background:${BRAND.glassDark}; border-color:${BRAND.borderDark}; }
    #wb-fin-root[data-theme="dark"] .wb-header-title{ color:${BRAND.darkText}; }
    #wb-fin-root[data-theme="dark"] .wb-theme{ background:rgba(255,255,255,.08); }
    #wb-fin-root[data-theme="dark"] .wb-theme .opt{ color:${BRAND.darkText}; }
    #wb-fin-root[data-theme="dark"] .wb-theme .selector{ background:#1f2330; }
    #wb-fin-root[data-theme="dark"] .wb-btn.ghost{ background:#2a2f3b; color:${BRAND.darkText}; }
    #wb-fin-root[data-theme="dark"] .wb-btn.ghost:hover{ background:#323947; }
    #wb-fin-root[data-theme="dark"] .wb-btn.dark{ background:#131722; color:${BRAND.darkText}; }
    #wb-fin-root[data-theme="dark"] .wb-progress{ background:linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.14)); }
    #wb-fin-root[data-theme="dark"] .wb-progress-text{ color:${BRAND.darkMuted}; }
    #wb-fin-root[data-theme="dark"] .wb-card{ background:rgba(20,22,28,0.60); border-color:${BRAND.borderDark}; color:${BRAND.darkText}; }
    #wb-fin-root[data-theme="dark"] .wb-row{ border-bottom:1px dashed rgba(255,255,255,.18); }
    #wb-fin-root[data-theme="dark"] .wb-row strong{ color:${BRAND.darkText}; }
    #wb-fin-root[data-theme="dark"] .wb-val{ color:${BRAND.darkRed}; }
  `);

  // ------------ HTML ------------
  const html = `
    <div id="wb-fin-root" data-theme="light">
      <!-- FAB -->
      <button class="wb-fab" id="wb-fab" title="Фин-отчёт">
        <span class="wb-logo" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 4v16M4 12h16" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>
        </span>
        <span class="wb-title">Фин-отчёт WB</span>
        <span class="wb-mini-badge" id="wb-mini-badge">—</span>
      </button>

      <!-- Panel -->
      <div class="wb-panel" id="wb-panel">
        <div class="wb-header" id="wb-header">
          <div class="wb-header-title"><span class="wb-dot"></span> Авто-Фин отчёт</div>
          <div class="wb-right">
            <div class="wb-theme">
              <div class="selector" id="theme-selector"></div>
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
            <button class="wb-btn primary" id="btn-calc">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 4v16M4 12h16" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>
              Расчёт
            </button>
            <button class="wb-btn dark" id="btn-copy">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 9h10v10H9zM5 5h10v10" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              Копировать
            </button>
          </div>

          <!-- FAQ -->
          <div class="wb-help">
            <span class="q">
              <div class="popup">
                <div class="wb-faq-title">Как пользоваться</div>
                <ul class="wb-faq-ul">
                  <li><span class="dot"></span><span>Выбери период в фильтрах отчёта.</span></li>
                  <li><span class="dot"></span><span>Нажми <span class="wb-kbd">Расчёт</span> — ниже появятся суммы.</span></li>
                  <li><span class="dot"></span><span><span class="wb-kbd">Копировать</span> — текстовый отчёт в буфер.</span></li>
                </ul>
              </div>
            </span>
          </div>

          <!-- Progress -->
          <div class="wb-progress-wrap" id="progress-wrap">
            <div class="wb-progress-text" id="progress-text">Считаю изо всех сил…</div>
            <div class="wb-progress"><div class="bar"></div></div>
          </div>

          <!-- Result (hidden before calc) -->
          <div class="wb-card" id="result">
            <div class="wb-row"><strong>Продажи</strong><span class="wb-val" id="v-sales">0</span></div>
            <div class="wb-row"><strong>Комиссия WB</strong><span class="wb-val" id="v-comm">0</span></div>
            <div class="wb-row"><strong>Логистика</strong><span class="wb-val" id="v-log">0</span></div>
            <div class="wb-row"><strong>Штрафы</strong><span class="wb-val" id="v-fines">0</span></div>
            <div class="wb-row"><strong>Хранение</strong><span class="wb-val" id="v-store">0</span></div>
            <div class="wb-row"><strong>Прочие удержания</strong><span class="wb-val" id="v-other">0</span></div>
            <div class="wb-row"><strong>Итого к оплате</strong><span class="wb-val" id="v-total">0</span></div>
            <div class="wb-note" id="v-period"></div>
          </div>
        </div>

        <div class="wb-toast" id="toast"><span class="ico">✅</span><span id="toast-text">Готово</span></div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', html);

  // ------------ STATE ------------
  restorePosition();
  setTheme(loadTheme() || 'light');
  setCollapsed((localStorage.getItem(LS_COLLAPSED) ?? '1') === '1'); // скрыта по умолчанию

  // ------------ HANDLERS ------------
  $('#wb-fab').on('click', () => togglePanel(true));
  $('#wb-close').on('click', () => togglePanel(false));
  $('#theme-light').on('click', () => setTheme('light'));
  $('#theme-dark').on('click', () => setTheme('dark'));
  makeDraggable($('#wb-fin-root'), $('#wb-header'));
  makeDraggable($('#wb-fin-root'), $('#wb-fab'));

  $('#btn-calc').on('click', runCalc);
  $('#btn-copy').on('click', copyToClipboard);

  // Hotkeys
  document.addEventListener('keydown', (e)=>{
    if (e.altKey && e.key.toLowerCase()==='s'){ e.preventDefault(); runCalc(); }
    if (e.altKey && e.key.toLowerCase()==='c'){ e.preventDefault(); copyToClipboard(); }
  });

  // ------------ LOGIC (from your calc, wrapped) ------------
  function parseNumber(text) {
    return parseFloat(String(text||'').replace(/\s/g,'').replace(',', '.')) || 0;
  }

  function getPeriod() {
    const periodCells = document.querySelectorAll('.Reports-table-row__cell__QhcDmbkNMD span[data-name="Text"]');
    for (const cell of periodCells) {
      if (cell.textContent.includes(' по ')) return cell.textContent.trim();
    }
    return '';
  }

  // Sum by column header (exact match)
  function sumByHeader(headerText) {
    const headers = document.querySelectorAll('.HeaderCell__VQC5V4CsQu span[data-name="Text"]');
    let columnIndex = -1;
    headers.forEach((h, i) => { if (h.textContent.trim() === headerText) columnIndex = i; });
    if (columnIndex === -1) return 0;

    let sum = 0;
    const rows = document.querySelectorAll('.Reports-table-row__cell__QhcDmbkNMD');
    const cols = headers.length;

    rows.forEach((cell, i) => {
      if (i % cols === columnIndex) {
        let el = cell.querySelector('span[data-name="Text"]') || cell.querySelector('.caption__8LYzUwjpQs');
        if (el) sum += parseNumber(el.textContent);
      }
    });
    return sum;
  }

  function n2str(n){ return n.toLocaleString('ru-RU', {minimumFractionDigits:2, maximumFractionDigits:2}); }

  async function runCalc(){
    showProgress(true, 'Считаю изо всех сил…');
    await sleep(150);

    const salesSum     = sumByHeader('Продажа');
    const payoutSum    = sumByHeader('К перечислению за товар');
    const logisticsSum = sumByHeader('Стоимость логистики');
    const finesSum     = sumByHeader('Общая сумма штрафов');
    const storageSum   = sumByHeader('Стоимость хранения');
    const otherSum     = sumByHeader('Прочие удержания/выплаты');
    const totalSum     = sumByHeader('Итого к оплате');
    const commission   = salesSum - payoutSum;

    // Fill UI
    $('#v-sales').text(`${n2str(salesSum)} ₽`);
    $('#v-comm').text(`${n2str(commission)} ₽`);
    $('#v-log').text(`${n2str(logisticsSum)} ₽`);
    $('#v-fines').text(`${n2str(finesSum)} ₽`);
    $('#v-store').text(`${n2str(storageSum)} ₽`);
    $('#v-other').text(`${n2str(otherSum)} ₽`);
    $('#v-total').text(`${n2str(totalSum)} ₽`);
    const period = getPeriod();
    $('#v-period').text(period ? `Период: ${period}` : '');
    $('#result').addClass('show');

    // badge on FAB — итог к оплате
    $('#wb-mini-badge').text(n2str(salesSum));

    showProgress(false);
    toast('Посчитано');
  }

  function copyToClipboard(){
    if (!$('#result').hasClass('show')) { toast('Сначала выполните расчёт'); return; }
    const period = $('#v-period').text().replace(/^Период:\s*/,'') || new Date().toLocaleDateString('ru-RU');

    const data = `
WB Отчёт (${period})

Продажи: ${$('#v-sales').text()}
Комиссия WB: ${$('#v-comm').text()}
Логистика: ${$('#v-log').text()}
Штрафы: ${$('#v-fines').text()}
Хранение: ${$('#v-store').text()}
Прочие удержания: ${$('#v-other').text()}

Итого к оплате: ${$('#v-total').text()}`.trim();

    GM_setClipboard(data, 'text');
    toast('Скопировано');
  }

  // ------------ UX helpers ------------
  function setTheme(mode){
    $('#wb-fin-root').attr('data-theme', mode);
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

  function showProgress(on, text=''){
    const $wrap = $('#progress-wrap');
    const $txt  = $('#progress-text');
    if (on){ $txt.text(text); $wrap.show(); }
    else  { $wrap.hide(); }
  }

  function toast(msg){
    $('#toast-text').text(msg);
    $('#toast').addClass('show');
    setTimeout(()=> $('#toast').removeClass('show'), 1600);
  }

  function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }

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
      if(!drag) return; drag=false;
      const rect=$root[0].getBoundingClientRect();
      localStorage.setItem(LS_POS, JSON.stringify({left:rect.left, top:rect.top}));
    });
  }
  function restorePosition(){
    const raw=localStorage.getItem(LS_POS); if(!raw) return;
    try{
      const pos=JSON.parse(raw);
      if(typeof pos.left==='number' && typeof pos.top==='number'){
        $('#wb-fin-root').css({left:pos.left+'px', top:pos.top+'px', right:'auto', bottom:'auto'});
      }
    }catch{}
  }
})();
