// ==UserScript==
// @name         WB Воронка продаж
// @namespace    https://github.com/Vatnik12/WB
// @version      2.1.1
// @description  WB tools
// @author       Vatnik
// @homepageURL  https://github.com/Vatnik12/WB
// @supportURL   https://github.com/Vatnik12/WB/issues
// @updateURL    https://raw.githubusercontent.com/Vatnik12/WB/main/scripts/wb-sales-funnel.user.js
// @downloadURL  https://raw.githubusercontent.com/Vatnik12/WB/main/scripts/wb-sales-funnel.user.js
// @match        https://seller.wildberries.ru/content-analytics/interactive-report/main*
// @grant        GM_setClipboard
// @grant        GM_addStyle
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

(function () {
  'use strict';

  // ---------- helpers ----------
  const norm = s => (s || '').replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  const fmtMoney = n => (typeof n === 'number'
    ? n.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    : n);
  const sleep = ms => new Promise(r=>setTimeout(r, ms));

  // вычищаем проценты из текста значения: "(12%)", " 12 %", "(12,3 %)" и т.п.
  function stripPercents(str){
    return String(str || '')
      // сносим скобочные проценты
      .replace(/\s*\([^)]*?%[^)]*?\)/g, '')
      // сносим одиночные проценты без скобок
      .replace(/\s*\d+[.,]?\d*\s*%/g, '')
      .replace(/\s{2,}/g,' ')
      .trim();
  }

  // ищем «Период» рядом с кнопкой календаря
  function getPeriodText(){
    const btn = document.querySelector('button.Date-input__icon-button__H1gMHXfwJr');
    const patterns = [
      /\b\d{2}\.\d{2}\.\d{4}\s*[—-]\s*\d{2}\.\d{2}\.\d{4}\b/,
      /\b\d{2}\.\d{2}\.\d{2}\s*[—-]\s*\d{2}\.\d{2}\.\d{2}\b/,
      /\bс\s+\d{2}\.\d{2}\.\d{4}\s+по\s+\d{2}\.\d{2}\.\d{4}\b/i,
      /\bс\s+\d{2}\.\d{2}\.\d{2}\s+по\s+\d{2}\.\d{2}\.\d{2}\b/i,
    ];
    // где искать: сначала в ближайшем контейнере, затем по документу
    const scopes = [];
    if (btn){
      const root = btn.closest('header,section,div,main') || btn.parentElement || document.body;
      scopes.push(root);
    }
    scopes.push(document.body);

    for (const scope of scopes){
      const nodes = scope.querySelectorAll('span,div,button,p,td,th');
      for (const el of nodes){
        const txt = (el.textContent || '').replace(/\u00A0/g,' ').trim();
        if (!txt) continue;
        for (const re of patterns){
          const m = txt.match(re);
          if (m) return m[0];
        }
      }
    }
    return '';
  }

  // ---------- THEME / CONST ----------
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
  const LS_POS   = 'wb_funnel_pos';
  const LS_COLL  = 'wb_funnel_collapsed';
  const LS_THEME = 'wb_funnel_theme';

  // ---------- STYLES ----------
  GM_addStyle(`
    :root { --wb-shadow: 0 18px 45px rgba(0,0,0,.18); --wb-radius: 16px; }
    #wb-funnel-root{
      position:fixed; right:20px; bottom:20px; z-index:2147483647;
      font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,Arial,sans-serif;
      letter-spacing:.1px; transition:left .15s ease, top .15s ease;
    }
    /* FAB */
    #wb-funnel-root .wb-fab{
      display:inline-flex; align-items:center; gap:10px;
      padding:10px 14px; border-radius:9999px;
      background:${BRAND.fabGlass}; border:1px solid ${BRAND.fabBorder};
      color:#fff; text-shadow:0 1px 0 rgba(0,0,0,.25);
      backdrop-filter: blur(12px) saturate(120%);
      box-shadow: var(--wb-shadow);
      cursor:grab; user-select:none;
      transition: transform .18s cubic-bezier(.2,.8,.2,1), box-shadow .2s, opacity .2s;
    }
    #wb-funnel-root .wb-fab:active{ cursor:grabbing; transform:scale(.98); }
    #wb-funnel-root .wb-fab:hover{ transform:translateY(-1px); box-shadow:0 22px 44px rgba(126,59,255,.28); }
    #wb-funnel-root .wb-fab .wb-title{ font-weight:800; font-size:13px; }
    #wb-funnel-root .wb-fab .wb-mini-badge{
      background:#fff; color:${BRAND.purpleD}; border:0; padding:2px 8px; border-radius:10px;
      font-weight:800; font-size:12px;
    }

    /* Panel */
    #wb-funnel-root .wb-panel{
      position:absolute; right:0; bottom:58px; width:460px;
      background:${BRAND.glassLight}; border:1px solid ${BRAND.border};
      border-radius:var(--wb-radius); box-shadow:var(--wb-shadow);
      backdrop-filter: blur(14px) saturate(140%);
      transform: translateY(10px) scale(.98);
      opacity:0; visibility:hidden;
      transition: transform .22s cubic-bezier(.2,.8,.2,1), opacity .22s, visibility .22s;
      overflow: visible;
    }
    #wb-funnel-root .wb-panel.show{ transform: translateY(0) scale(1); opacity:1; visibility:visible; }

    #wb-funnel-root .wb-header{
      display:flex; align-items:center; justify-content:space-between;
      padding:12px 16px; border-bottom:1px solid ${BRAND.border}; cursor:grab;
    }
    #wb-funnel-root .wb-header:active{ cursor:grabbing; }
    #wb-funnel-root .wb-header-title{ display:flex; align-items:center; gap:10px; font-weight:800; font-size:14px; color:${BRAND.lightText}; }
    #wb-funnel-root .wb-dot{ width:10px; height:10px; border-radius:50%;
      background: linear-gradient(135deg, ${BRAND.purple}, ${BRAND.purpleD});
      box-shadow: 0 0 0 3px rgba(126,59,255,.18); }
    #wb-funnel-root .wb-right{ display:flex; gap:8px; align-items:center; }

    /* Theme selector */
    #wb-funnel-root .wb-theme{ position:relative; display:inline-grid; grid-auto-flow:column; gap:2px; background:rgba(0,0,0,.06); padding:4px; border-radius:999px; }
    #wb-funnel-root .wb-theme .opt{ position:relative; z-index:2; min-width:42px; display:inline-flex; align-items:center; justify-content:center; padding:6px 8px; border-radius:999px; border:none; background:transparent; cursor:pointer; font-size:14px; font-weight:800; color:#333; }
    #wb-funnel-root .wb-theme .selector{ position:absolute; z-index:1; top:4px; bottom:4px; width:calc(50% - 4px); left:4px; border-radius:999px; background:#fff; box-shadow:0 2px 8px rgba(0,0,0,.12); transition:left .22s cubic-bezier(.2,.8,.2,1); }

    #wb-funnel-root .wb-close{ background:transparent; border:none; cursor:pointer; color:#8a8fa3; width:28px; height:28px; border-radius:8px; display:flex; align-items:center; justify-content:center; transition:background .15s ease, color .15s ease; }
    #wb-funnel-root .wb-close:hover{ background:rgba(0,0,0,.06); color:#333; }

    #wb-funnel-root .wb-body{ padding:12px 16px 16px; }

    /* Actions */
    #wb-funnel-root .wb-actions{ display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-bottom:8px; }
    #wb-funnel-root .wb-btn{
      display:inline-flex; align-items:center; justify-content:center; gap:8px;
      border:none; border-radius:10px; padding:11px 12px; cursor:pointer;
      font-weight:800; font-size:13px; transition:transform .12s ease, box-shadow .2s ease, filter .2s;
    }
    #wb-funnel-root .wb-btn.primary{ background:linear-gradient(135deg, ${BRAND.purple}, ${BRAND.purpleD}); color:#fff; }
    #wb-funnel-root .wb-btn.primary:hover{ transform:translateY(-1px); box-shadow:0 10px 24px rgba(126,59,255,.28); }
    #wb-funnel-root .wb-btn.ghost{ background:#eef0f6; color:#1f2330; }
    #wb-funnel-root .wb-btn.ghost:hover{ background:#e7e9f2; }
    #wb-funnel-root .wb-btn.full{ grid-column:1 / -1; }

    /* FAQ (light & dark) */
    #wb-funnel-root .wb-help{ display:flex; justify-content:flex-end; margin-bottom:10px; }
    #wb-funnel-root .wb-help .q{ width:24px; height:24px; border-radius:50%; background:rgba(255,255,255,.85); color:#222; font-weight:900; display:inline-flex; align-items:center; justify-content:center; position:relative; box-shadow:0 2px 8px rgba(0,0,0,.12); user-select:none; }
    #wb-funnel-root .wb-help .q::after{ content:'?'; font-size:14px; line-height:1; }
    #wb-funnel-root .wb-help .q:hover .popup{ opacity:1; transform:translateY(0); pointer-events:auto; }
    #wb-funnel-root .wb-help .popup{
      position:absolute; right:0; top:calc(100% + 10px); width:360px; max-width:min(360px, 82vw);
      background:rgba(255,255,255,.97); color:#222; padding:14px 16px; border-radius:12px; z-index:2147483647;
      opacity:0; transform:translateY(6px); transition:opacity .2s, transform .2s; pointer-events:none;
      backdrop-filter: blur(12px) saturate(140%); box-shadow:0 16px 40px rgba(0,0,0,.20), inset 0 1px 0 rgba(255,255,255,.6);
      text-align:left; line-height:1.5; word-break:break-word;
    }
    #wb-funnel-root .wb-help .popup::before{ content:''; position:absolute; right:10px; top:-8px; width:12px; height:12px; background:inherit; transform:rotate(45deg); filter:drop-shadow(0 -2px 2px rgba(0,0,0,.12)); }
    #wb-funnel-root .wb-faq-title{ font-weight:700; font-size:13px; margin-bottom:8px; }
    #wb-funnel-root .wb-faq-ul{ margin:0; padding:0; list-style:none; }
    #wb-funnel-root .wb-faq-ul li{ display:flex; gap:10px; align-items:flex-start; margin:6px 0; color:#2b2f3a; font-size:13px; }
    #wb-funnel-root .wb-faq-ul .dot{ margin-top:6px; width:6px; height:6px; border-radius:50%; background:#7e8cff; flex:0 0 6px; }
    #wb-funnel-root[data-theme="dark"] .wb-help .q{ background:rgba(42,47,59,.95); color:${BRAND.darkText}; }
    #wb-funnel-root[data-theme="dark"] .wb-help .popup{ background:rgba(20,22,28,.92); color:#f5f6fb; box-shadow:0 16px 40px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.06); }
    #wb-funnel-root[data-theme="dark"] .wb-faq-ul li{ color:#e8ebf7; }
    #wb-funnel-root[data-theme="dark"] .wb-faq-ul .dot{ background:#c5d0ff; }

    /* Progress */
    #wb-funnel-root .wb-progress-wrap{ display:none; margin:6px 0 10px; }
    #wb-funnel-root .wb-progress-text{ font-size:12px; color:#6d7285; margin-bottom:6px; }
    #wb-funnel-root .wb-progress{ position:relative; height:8px; border-radius:999px; overflow:hidden; background:linear-gradient(180deg, rgba(0,0,0,.06), rgba(0,0,0,.12)); }
    #wb-funnel-root .wb-progress .bar{ position:absolute; left:0; top:0; bottom:0; width:0%; background:linear-gradient(90deg, ${BRAND.purple}, ${BRAND.purpleD}); animation: wbbar 1.6s ease-in-out infinite; }
    @keyframes wbbar{ 0%{ width:8%; transform:translateX(0); } 50%{ width:70%; transform:translateX(20%); } 100%{ width:8%; transform:translateX(100%); } }

    /* Result card */
    #wb-funnel-root .wb-card{ background:rgba(255,255,255,0.60); border:1px solid #e3e6ef; border-radius:12px; padding:12px; color:${BRAND.lightText}; font-size:14px; backdrop-filter: blur(10px) saturate(130%); display:none; }
    #wb-funnel-root .wb-card.show{ display:block; }
    #wb-funnel-root .wb-row{ display:flex; align-items:center; justify-content:space-between; padding:8px 0; border-bottom:1px dashed rgba(0,0,0,.15); }
    #wb-funnel-root .wb-row:last-child{ border-bottom:none; }
    #wb-funnel-root .wb-row strong{ color:${BRAND.lightText}; font-weight:700; }
    #wb-funnel-root .wb-val{ font-weight:800; font-size:16px; color:${BRAND.red}; }
    #wb-funnel-root .wb-note{ font-size:12px; margin-top:6px; color:#6d7285; }

    /* Toast */
    #wb-funnel-root .wb-toast{ position:absolute; left:50%; transform:translateX(-50%) translateY(6px); bottom:10px; background:rgba(17,20,28,.96); color:#fff; padding:10px 12px; border-radius:10px; font-size:13px; font-weight:700; box-shadow:var(--wb-shadow); display:flex; gap:8px; align-items:center; opacity:0; transition:opacity .2s, transform .2s; }
    #wb-funnel-root .wb-toast.show{ opacity:1; transform:translateX(-50%) translateY(0); }
    #wb-funnel-root .wb-toast .ico{ width:16px; height:16px; display:inline-flex; align-items:center; justify-content:center; }

    /* Dark theme */
    #wb-funnel-root[data-theme="dark"] .wb-panel{ background:${BRAND.glassDark}; border-color:${BRAND.borderDark}; }
    #wb-funnel-root[data-theme="dark"] .wb-header-title{ color:${BRAND.darkText}; }
    #wb-funnel-root[data-theme="dark"] .wb-theme{ background:rgba(255,255,255,.08); }
    #wb-funnel-root[data-theme="dark"] .wb-theme .opt{ color:${BRAND.darkText}; }
    #wb-funnel-root[data-theme="dark"] .wb-theme .selector{ background:#1f2330; }
    #wb-funnel-root[data-theme="dark"] .wb-btn.ghost{ background:#2a2f3b; color:${BRAND.darkText}; }
    #wb-funnel-root[data-theme="dark"] .wb-btn.ghost:hover{ background:#323947; }
    #wb-funnel-root[data-theme="dark"] .wb-progress{ background:linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.14)); }
    #wb-funnel-root[data-theme="dark"] .wb-progress-text{ color:${BRAND.darkMuted}; }
    #wb-funnel-root[data-theme="dark"] .wb-card{ background:rgba(20,22,28,0.60); border-color:${BRAND.borderDark}; color:${BRAND.darkText}; }
    #wb-funnel-root[data-theme="dark"] .wb-row{ border-bottom:1px dashed rgba(255,255,255,.18); }
    #wb-funnel-root[data-theme="dark"] .wb-row strong{ color:${BRAND.darkText}; }
    #wb-funnel-root[data-theme="dark"] .wb-val{ color:${BRAND.darkRed}; }
  `);

  // ---------- HTML ----------
  const html = `
    <div id="wb-funnel-root" data-theme="light">
      <!-- FAB -->
      <button class="wb-fab" id="wb-fab" title="Воронка продаж">
        <span class="wb-logo" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 4v16M4 12h16" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>
        </span>
        <span class="wb-title">Итоги WB</span>
        <span class="wb-mini-badge" id="wb-mini-badge">—</span>
      </button>

      <!-- Panel -->
      <div class="wb-panel" id="wb-panel">
        <div class="wb-header" id="wb-header">
          <div class="wb-header-title"><span class="wb-dot"></span> Воронка продаж · Итоги</div>
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
          <!-- Actions -->
          <div class="wb-actions">
            <button class="wb-btn primary" id="btn-run">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 4v16M4 12h16" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>
              Рассчитать
            </button>
            <button class="wb-btn ghost" id="btn-copy">
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
                  <li><span class="dot"></span><span>Открой раздел <b>Воронка продаж</b> и дождись загрузки таблицы.</span></li>
                  <li><span class="dot"></span><span>"Расчитать" подтянет столбцы: <b>«Заказали на сумму»</b> и <b>«Заказали товаров, шт»</b> за выбранный период.</span></li>
                </ul>
              </div>
            </span>
          </div>

          <!-- Progress -->
          <div class="wb-progress-wrap" id="progress-wrap">
            <div class="wb-progress-text" id="progress-text">Считаю изо всех сил…</div>
            <div class="wb-progress"><div class="bar"></div></div>
          </div>

          <!-- Result -->
          <div class="wb-card" id="result">
            <div class="wb-row"><strong>Заказали на сумму</strong><span class="wb-val" id="v-sum">—</span></div>
            <div class="wb-row"><strong>Заказали товаров, шт</strong><span class="wb-val" id="v-qty">—</span></div>
            <div class="wb-note" id="v-period"></div>
          </div>
        </div>

        <div class="wb-toast" id="toast"><span class="ico">✅</span><span id="toast-text">Готово</span></div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', html);

  // ---------- INIT ----------
  restorePosition();
  setTheme(loadTheme() || 'light');
  setCollapsed((localStorage.getItem(LS_COLL) ?? '1') === '1');

  // handlers
  $('#wb-fab').on('click', () => togglePanel(true));
  $('#wb-close').on('click', () => togglePanel(false));
  $('#theme-light').on('click', () => setTheme('light'));
  $('#theme-dark').on('click', () => setTheme('dark'));
  makeDraggable($('#wb-funnel-root'), $('#wb-header'));
  makeDraggable($('#wb-funnel-root'), $('#wb-fab'));

  $('#btn-run').on('click', runCalc);
  $('#btn-copy').on('click', copyValues);

  document.addEventListener('keydown', (e) => {
    if (e.altKey && e.key.toLowerCase() === 'a') { e.preventDefault(); $('#btn-run').click(); }
    if (e.altKey && e.key.toLowerCase() === 'c') { e.preventDefault(); $('#btn-copy').click(); }
  });

  // ---------- table detection / parsing ----------
  function waitForTables(timeoutMs = 15000) {
    return new Promise(resolve => {
      const have = () => Array.from(document.querySelectorAll('table'));
      const first = have();
      if (first.length) return resolve(first);
      const obs = new MutationObserver(() => {
        const arr = have();
        if (arr.length) { obs.disconnect(); resolve(arr); }
      });
      obs.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { obs.disconnect(); resolve(have()); }, timeoutMs);
    });
  }

  function findFunnelTable(tables) {
    for (const table of tables) {
      const head = table.querySelector('thead');
      if (!head) continue;
      const rows = Array.from(head.querySelectorAll('tr'));
      let idxSum = -1, idxQty = -1;
      for (const row of rows) {
        let running = 0;
        for (const th of row.querySelectorAll('th,td')) {
          const text = norm(th.innerText);
          const span = Math.max(1, parseInt(th.getAttribute('colspan') || '1', 10));
          if (idxSum === -1 && /заказали на сумму/.test(text)) idxSum = running;
          if (idxQty === -1 && (/заказали товаров[, ]*шт/.test(text) || (text.includes('заказали товаров') && /шт/.test(text)))) idxQty = running;
          running += span;
        }
      }
      if (idxSum !== -1 && idxQty !== -1) return { table, idxSum, idxQty };
    }
    return null;
  }

  function findTotalsRow(table) {
    const tbody = table.querySelector('tbody');
    if (!tbody) return null;
    const allRows = Array.from(tbody.querySelectorAll('tr'));
    let totals = allRows.find(tr => norm(tr.innerText).includes('итого по товарам'));
    if (totals) return totals;
    totals = allRows.find(tr => tr.querySelectorAll('td').length > 1);
    return totals || null;
  }

  function extractValues(row, idxSum, idxQty) {
    const tds = row ? Array.from(row.querySelectorAll('td')) : [];
    const get = (i) => (tds[i] ? tds[i].innerText.trim() : '');
    return { sumText: get(idxSum) || '', qtyText: get(idxQty) || '' };
  }

  async function calc() {
    const tables = await waitForTables();
    const pick = findFunnelTable(tables);
    if (!pick) {
      return { error: 'Не нашли столбцы «Заказали на сумму» и «Заказали товаров, шт». Открой «Воронку продаж» и дождись загрузки.' };
    }
    const totalsRow = findTotalsRow(pick.table);
    if (!totalsRow) return { error: 'Строка с итогами не найдена. Прокрути таблицу, чтобы она догрузилась.' };

    const { sumText, qtyText } = extractValues(totalsRow, pick.idxSum, pick.idxQty);
    if (!sumText && !qtyText) return { error: 'Целевые значения пустые. Попробуй другой период/детализацию.' };
    return { sumText, qtyText };
  }

  // ---------- CALC / RENDER / COPY ----------
  let lastRes = null;
  let lastPeriod = '';

  async function runCalc(){
    showProgress(true, 'Считаю изо всех сил…');
    $('#v-sum').text('—'); $('#v-qty').text('—'); $('#v-period').text('');
    await sleep(120);

    lastRes = await calc();
    lastPeriod = getPeriodText();

    showProgress(false);

    if (lastRes.error){
      $('#result').addClass('show');
      $('#v-sum').text(lastRes.error);
      $('#v-qty').text('—');
      toast('Ошибка');
      return;
    }

    $('#v-sum').text(stripPercents(lastRes.sumText));
    $('#v-qty').text(stripPercents(lastRes.qtyText)); // на карточке тоже без % — если хочешь оставить %, убери stripPercents тут
    $('#v-period').text(lastPeriod ? `Период: ${lastPeriod}` : '');
    $('#result').addClass('show');

    // бейдж — только сумма без ₽ и процентов
    const badge = stripPercents(String(lastRes.sumText)).replace(/\s*₽/,'').trim();
    $('#wb-mini-badge').text(badge || '—');

    toast('Готово');
  }

  function copyValues(){
    if (!lastRes){ toast('Сначала «Рассчитать»'); return; }
    if (lastRes.error){ toast('Нечего копировать'); return; }

    const sumClean = stripPercents(lastRes.sumText);
    const qtyClean = stripPercents(lastRes.qtyText);

    const text = `${lastPeriod ? `Период: ${lastPeriod}\n` : ''}Сумма заказов: ${sumClean}\nЗаказы, шт: ${qtyClean}`;
    if (typeof GM_setClipboard === 'function') GM_setClipboard(text, 'text');
    toast('Скопировано');
  }

  // ---------- UX helpers ----------
  function setTheme(mode){
    $('#wb-funnel-root').attr('data-theme', mode);
    localStorage.setItem(LS_THEME, mode);
    $('#theme-selector').css('left', mode === 'light' ? '4px' : 'calc(50% + 2px)');
  }
  function loadTheme(){ return localStorage.getItem(LS_THEME); }

  function togglePanel(open){
    const $panel = $('#wb-panel');
    const $fab   = $('#wb-fab');
    if (open) { $panel.addClass('show'); localStorage.setItem(LS_COLL,'0'); }
    else      { $panel.removeClass('show'); localStorage.setItem(LS_COLL,'1'); }
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
        $('#wb-funnel-root').css({left:pos.left+'px', top:pos.top+'px', right:'auto', bottom:'auto'});
      }
    }catch{}
  }
})();
