// ==UserScript==
// @name         WB Сводный по продавцу
// @namespace    https://github.com/Vatnik12/WB
// @version      5.0.1
// @description  WB tools
// @author       Vatnik
// @homepageURL  https://github.com/Vatnik12/WB
// @supportURL   https://github.com/Vatnik12/WB/issues
// @updateURL    https://raw.githubusercontent.com/Vatnik12/WB/main/scripts/wb-summary-seller.user.js
// @downloadURL  https://raw.githubusercontent.com/Vatnik12/WB/main/scripts/wb-summary-seller.user.js
// @match        https://seller.wildberries.ru/analytics-reports/summary-report*
// @grant        GM_setClipboard
// @grant        GM_addStyle
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/date-fns/1.30.1/date_fns.min.js
// @run-at       document-idle
// @license      MIT
// ==/UserScript==


(function () {
  'use strict';

  // ===== Helpers (как в оригинале) =====
  const norm = s => (s || '').replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  const fmtMoney = n => n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const parseNumber = t => {
    if (!t) return 0;
    const v = parseFloat(
      t.replace(/\u00A0/g, ' ')
       .replace(/\s+/g, '')
       .replace(',', '.')
       .replace(/[^\d.\-]/g, '')
    );
    return isNaN(v) ? 0 : v;
  };
  function parseInputDateLocal(yyyy_mm_dd) {
    const [y, m, d] = yyyy_mm_dd.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  // ===== Brand & LS =====
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
  const LS_POS = 'wb_period_panel_pos';
  const LS_COLLAPSED = 'wb_period_collapsed';
  const LS_THEME = 'wb_period_theme';

  // ===== State =====
  let lastRes = null; // { from, to, totalAmount, totalOrders } | { error }
  let periodButtons = [7,30,60,90]; // Неделя/Месяц/2 мес/Квартал

  // ===== Styles =====
  GM_addStyle(`
    :root { --wb-shadow: 0 18px 45px rgba(0,0,0,.18); --wb-radius: 16px; }
    #wb-period-root{
      position:fixed; right:20px; bottom:20px; z-index:2147483647;
      font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,Arial,sans-serif;
      letter-spacing:.1px; transition:left .15s ease, top .15s ease;
    }
    /* FAB pill */
    #wb-period-root .wb-fab{
      display:inline-flex; align-items:center; gap:10px;
      padding:10px 14px; border-radius:9999px;
      background:${BRAND.fabGlass}; border:1px solid ${BRAND.fabBorder};
      color:#fff; text-shadow:0 1px 0 rgba(0,0,0,.25);
      backdrop-filter: blur(12px) saturate(120%);
      box-shadow: var(--wb-shadow);
      cursor:grab; user-select:none;
      transition: transform .18s cubic-bezier(.2,.8,.2,1), box-shadow .2s, opacity .2s;
    }
    #wb-period-root .wb-fab:active{ cursor:grabbing; transform:scale(.98); }
    #wb-period-root .wb-fab:hover{ transform:translateY(-1px); box-shadow:0 22px 44px rgba(126,59,255,.28); }
    #wb-period-root .wb-title{ font-weight:800; font-size:13px; }
    #wb-period-root .wb-mini-badge{
      background:#fff; color:${BRAND.purpleD}; border:0; padding:2px 8px; border-radius:10px;
      font-weight:800; font-size:12px; white-space:nowrap;
    }

    /* Panel */
    #wb-period-root .wb-panel{
      position:absolute; right:0; bottom:58px; width:520px;
      background:${BRAND.glassLight}; border:1px solid ${BRAND.border};
      border-radius:var(--wb-radius); box-shadow:var(--wb-shadow);
      backdrop-filter: blur(14px) saturate(140%);
      transform: translateY(10px) scale(.98);
      opacity:0; visibility:hidden;
      transition: transform .22s cubic-bezier(.2,.8,.2,1), opacity .22s, visibility .22s;
      overflow: visible;
    }
    #wb-period-root .wb-panel.show{ transform: translateY(0) scale(1); opacity:1; visibility:visible; }

    #wb-period-root .wb-header{
      display:flex; align-items:center; justify-content:space-between;
      padding:12px 16px; border-bottom:1px solid ${BRAND.border}; cursor:grab;
    }
    #wb-period-root .wb-header:active{ cursor:grabbing; }
    #wb-period-root .wb-header-title{ display:flex; align-items:center; gap:10px; font-weight:800; font-size:14px; color:${BRAND.lightText}; }
    #wb-period-root .wb-dot{ width:10px; height:10px; border-radius:50%;
      background: linear-gradient(135deg, ${BRAND.purple}, ${BRAND.purpleD});
      box-shadow: 0 0 0 3px rgba(126,59,255,.18); }
    #wb-period-root .wb-right{ display:flex; gap:8px; align-items:center; }

    /* Theme selector */
    #wb-period-root .wb-theme{
      position:relative; display:inline-grid; grid-auto-flow:column; gap:2px;
      background:rgba(0,0,0,.06); padding:4px; border-radius:999px;
    }
    #wb-period-root .wb-theme .opt{
      position:relative; z-index:2; min-width:42px;
      display:inline-flex; align-items:center; justify-content:center;
      padding:6px 8px; border-radius:999px; border:none; background:transparent;
      cursor:pointer; font-size:14px; font-weight:800; color:#333;
    }
    #wb-period-root .wb-theme .selector{
      position:absolute; z-index:1; top:4px; bottom:4px; width:calc(50% - 4px);
      left:4px; border-radius:999px; background:#fff; box-shadow:0 2px 8px rgba(0,0,0,.12);
      transition:left .22s cubic-bezier(.2,.8,.2,1);
    }

    #wb-period-root .wb-close{
      background:transparent; border:none; cursor:pointer; color:#8a8fa3;
      width:28px; height:28px; border-radius:8px; display:flex; align-items:center; justify-content:center;
      transition:background .15s ease, color .15s ease;
    }
    #wb-period-root .wb-close:hover{ background:rgba(0,0,0,.06); color:#333; }

    #wb-period-root .wb-body{ padding:12px 16px 16px; }

    /* Dates + quick */
    #wb-period-root .wb-dates{ display:grid; grid-template-columns: auto 1fr 1fr; gap:10px; align-items:center; margin-bottom:10px; }
    #wb-period-root .wb-date-label{ font-size:13px; color:#555; }
    #wb-period-root .wb-date-input{ padding:8px 10px; border-radius:10px; border:1px solid rgba(0,0,0,.15); background:rgba(255,255,255,.85); }
    #wb-period-root .wb-quick{ display:grid; grid-template-columns: repeat(4, 1fr); gap:8px; margin-bottom:10px; }
    #wb-period-root .wb-quick-btn{
      background:#eef0f6; border:1px solid rgba(0,0,0,.12);
      padding:8px 10px; border-radius:10px; cursor:pointer; font-size:12px; font-weight:700;
    }
    #wb-period-root .wb-quick-btn:hover{ background:#e7e9f2; }
    #wb-period-root .wb-quick-btn.active{ background:linear-gradient(135deg, ${BRAND.purple}, ${BRAND.purpleD}); color:#fff; border-color:transparent; }

    /* Actions */
    #wb-period-root .wb-actions{ display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-bottom:8px; }
    #wb-period-root .wb-btn{
      display:inline-flex; align-items:center; justify-content:center; gap:8px;
      border:none; border-radius:10px; padding:11px 12px; cursor:pointer;
      font-weight:800; font-size:13px; transition:transform .12s ease, box-shadow .2s ease, filter .2s;
    }
    #wb-period-root .wb-btn.primary{ background:linear-gradient(135deg, ${BRAND.purple}, ${BRAND.purpleD}); color:#fff; }
    #wb-period-root .wb-btn.primary:hover{ transform:translateY(-1px); box-shadow:0 10px 24px rgba(126,59,255,.28); }
    #wb-period-root .wb-btn.ghost{ background:#eef0f6; color:#1f2330; }
    #wb-period-root .wb-btn.ghost:hover{ background:#e7e9f2; }
    #wb-period-root .wb-btn.full{ grid-column:1 / -1; }

    /* FAQ (иконка + поповер) */
    #wb-period-root .wb-help{ display:flex; justify-content:flex-end; margin-bottom:10px; }
    #wb-period-root .wb-help .q{
      width:24px; height:24px; border-radius:50%;
      background:rgba(255,255,255,.85); color:#222; font-weight:900;
      display:inline-flex; align-items:center; justify-content:center;
      position:relative; box-shadow:0 2px 8px rgba(0,0,0,.12);
      user-select:none;
    }
    #wb-period-root[data-theme="dark"] .wb-help .q{ background:rgba(42,47,59,.95); color:${BRAND.darkText}; }
    #wb-period-root .wb-help .q::after{ content:'?'; font-size:14px; line-height:1; }
    #wb-period-root .wb-help .q:hover .popup{ opacity:1; transform:translateY(0); pointer-events:auto; }

    #wb-period-root .wb-help .popup{
      position:absolute; right:0; top:calc(100% + 10px);
      width:380px; max-width:min(380px, 82vw);
      background:rgba(20,22,28,.92); color:#f5f6fb;
      padding:14px 16px; border-radius:12px; z-index:2147483647;
      opacity:0; transform:translateY(6px); transition:opacity .2s, transform .2s; pointer-events:none;
      backdrop-filter: blur(12px) saturate(140%);
      box-shadow:0 16px 40px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.06);
      text-align:left; line-height:1.5; word-break:break-word;
    }
    #wb-period-root .wb-help .popup::before{
      content:''; position:absolute; right:10px; top:-8px; width:12px; height:12px;
      background:inherit; transform:rotate(45deg);
      filter:drop-shadow(0 -2px 2px rgba(0,0,0,.12));
    }
    #wb-period-root .wb-faq-title{ font-weight:700; font-size:13px; margin-bottom:8px; color:#fff; }
    #wb-period-root .wb-faq-ul{ margin:0; padding:0; list-style:none; }
    #wb-period-root .wb-faq-ul li{ display:flex; gap:10px; align-items:flex-start; margin:6px 0; color:#e8ebf7; font-size:13px; }
    #wb-period-root .wb-faq-ul .dot{ margin-top:6px; width:6px; height:6px; border-radius:50%; background:#c5d0ff; flex:0 0 6px; }
    /* Light overrides for FAQ */
    #wb-period-root[data-theme="light"] .wb-help .popup{ background:rgba(255,255,255,.97); color:#222; box-shadow:0 16px 40px rgba(0,0,0,.20), inset 0 1px 0 rgba(255,255,255,.60); }
    #wb-period-root[data-theme="light"] .wb-faq-title{ color:#222; }
    #wb-period-root[data-theme="light"] .wb-faq-ul li{ color:#2b2f3a; }

    /* Progress */
    #wb-period-root .wb-progress-wrap{ display:none; margin:6px 0 10px; }
    #wb-period-root .wb-progress-text{ font-size:12px; color:#6d7285; margin-bottom:6px; }
    #wb-period-root .wb-progress{
      position:relative; height:8px; border-radius:999px; overflow:hidden;
      background:linear-gradient(180deg, rgba(0,0,0,.06), rgba(0,0,0,.12));
    }
    #wb-period-root .wb-progress .bar{
      position:absolute; left:0; top:0; bottom:0; width:0%;
      background:linear-gradient(90deg, ${BRAND.purple}, ${BRAND.purpleD});
      animation: wbbar 1.6s ease-in-out infinite;
    }
    @keyframes wbbar{
      0%{ width:8%; transform:translateX(0); }
      50%{ width:70%; transform:translateX(20%); }
      100%{ width:8%; transform:translateX(100%); }
    }

    /* Result card */
    #wb-period-root .wb-card{
      background:rgba(255,255,255,0.60); border:1px solid #e3e6ef; border-radius:12px; padding:12px;
      color:${BRAND.lightText}; font-size:14px; backdrop-filter: blur(10px) saturate(130%);
      display:none;
    }
    #wb-period-root .wb-card.show{ display:block; }
    #wb-period-root .wb-grid{ display:grid; grid-template-columns: 1fr auto; gap:8px 16px; }
    #wb-period-root .wb-k{ color:#555; }
    #wb-period-root .wb-v{ font-weight:800; text-align:right; }
    #wb-period-root .wb-note{ font-size:12px; margin-top:6px; color:#6d7285; }

    /* Toast */
    #wb-period-root .wb-toast{
      position:absolute; left:50%; transform:translateX(-50%) translateY(6px);
      bottom:10px; background:rgba(17,20,28,.96); color:#fff;
      padding:10px 12px; border-radius:10px; font-size:13px; font-weight:700;
      box-shadow:var(--wb-shadow); display:flex; gap:8px; align-items:center;
      opacity:0; transition:opacity .2s, transform .2s;
    }
    #wb-period-root .wb-toast.show{ opacity:1; transform:translateX(-50%) translateY(0); }
    #wb-period-root .wb-toast .ico{ width:16px; height:16px; display:inline-flex; align-items:center; justify-content:center; }

    /* Dark overrides */
    #wb-period-root[data-theme="dark"] .wb-panel{ background:${BRAND.glassDark}; border-color:${BRAND.borderDark}; }
    #wb-period-root[data-theme="dark"] .wb-header-title{ color:${BRAND.darkText}; }
    #wb-period-root[data-theme="dark"] .wb-theme{ background:rgba(255,255,255,.08); }
    #wb-period-root[data-theme="dark"] .wb-theme .opt{ color:${BRAND.darkText}; }
    #wb-period-root[data-theme="dark"] .wb-theme .selector{ background:#1f2330; }
    #wb-period-root[data-theme="dark"] .wb-btn.ghost{ background:#2a2f3b; color:${BRAND.darkText}; }
    #wb-period-root[data-theme="dark"] .wb-btn.ghost:hover{ background:#323947; }
    #wb-period-root[data-theme="dark"] .wb-progress{ background:linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.14)); }
    #wb-period-root[data-theme="dark"] .wb-progress-text{ color:${BRAND.darkMuted}; }
    #wb-period-root[data-theme="dark"] .wb-card{ background:rgba(20,22,28,0.60); border-color:${BRAND.borderDark}; color:${BRAND.darkText}; }
    #wb-period-root[data-theme="dark"] .wb-k{ color:${BRAND.darkMuted}; }
    #wb-period-root[data-theme="dark"] .wb-v{ color:${BRAND.darkText}; }
  `);

  // ===== HTML =====
  const html = `
    <div id="wb-period-root" data-theme="light">
      <!-- FAB -->
      <button class="wb-fab" id="wb-fab" title="Итоги периода">
        <span class="wb-logo" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 4v16M4 12h16" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>
        </span>
        <span class="wb-title">Итоги WB</span>
        <span class="wb-mini-badge" id="wb-mini-badge">—</span>
      </button>

      <!-- Panel -->
      <div class="wb-panel" id="wb-panel">
        <div class="wb-header" id="wb-header">
          <div class="wb-header-title"><span class="wb-dot"></span> Итоги за период</div>
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
          <!-- Dates -->
          <div class="wb-dates">
            <div class="wb-date-label">Период:</div>
            <input type="date" id="wb-date-start" class="wb-date-input">
            <input type="date" id="wb-date-end" class="wb-date-input">
          </div>

          <!-- Quick buttons -->
          <div class="wb-quick" id="wb-quick"></div>

          <!-- Actions -->
          <div class="wb-actions">
            <button class="wb-btn primary" id="wb-calc">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 4v16M4 12h16" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>
              Посчитать
            </button>
            <button class="wb-btn ghost" id="wb-copy">
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
                  <li><span class="dot"></span><span>На странице <b>Сводного отчёта</b> раскрой «Детализацию» до <u>дней</u>.</span></li>
                  <li><span class="dot"></span><span>Выбери период в календаре или нажми на быстрые кнопки: Неделя/Месяц/2 мес/Квартал.</span></li>
                  <li><span class="dot"></span><span>Нажми <b>Посчитать</b> — получишь: Период, Сумма заказов, Заказано (шт.).</span></li>
                  <li><span class="dot"></span><span><b>Копировать</b> — сохранит эти три строки в буфер обмена.</span></li>
                </ul>
              </div>
            </span>
          </div>

          <!-- Progress -->
          <div class="wb-progress-wrap" id="wb-progress-wrap">
            <div class="wb-progress-text" id="wb-progress-text">Считаю изо всех сил…</div>
            <div class="wb-progress"><div class="bar"></div></div>
          </div>

          <!-- Result -->
          <div class="wb-card" id="wb-result" aria-live="polite"></div>
        </div>

        <div class="wb-toast" id="wb-toast"><span class="ico">✅</span><span id="wb-toast-text">Готово</span></div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', html);

  // ===== Init: dates & quick =====
  const end0 = new Date(), start0 = new Date(); start0.setDate(end0.getDate() - 60);
  $('#wb-date-start')[0].valueAsDate = start0;
  $('#wb-date-end')[0].valueAsDate = end0;

  const $quick = $('#wb-quick');
  periodButtons.forEach((days, i) => {
    const label = days===7?'Неделя':days===30?'Месяц':days===60?'2 месяца':'Квартал';
    const btn = $(`<button class="wb-quick-btn${days===60?' active':''}" data-days="${days}">${label}</button>`);
    btn.on('click', function(){
      $('.wb-quick-btn').removeClass('active');
      $(this).addClass('active');
      const dEnd = new Date(), dStart = new Date(); dStart.setDate(dEnd.getDate() - days + 1);
      $('#wb-date-start')[0].valueAsDate = dStart;
      $('#wb-date-end')[0].valueAsDate = dEnd;
    });
    $quick.append(btn);
  });

  // ===== Theme / position / panel =====
  restorePosition();
  setTheme(loadTheme() || 'light');
  setCollapsed((localStorage.getItem(LS_COLLAPSED) ?? '1') === '1');

  $('#wb-fab').on('click', () => togglePanel(true));
  $('#wb-close').on('click', () => togglePanel(false));
  $('#theme-light').on('click', () => setTheme('light'));
  $('#theme-dark').on('click', () => setTheme('dark'));
  makeDraggable($('#wb-period-root'), $('#wb-header'));
  makeDraggable($('#wb-period-root'), $('#wb-fab'));

  // ===== Actions =====
  $('#wb-calc').on('click', async function(){
    showProgress(true, 'Считаю изо всех сил…');
    const self = this; const old = self.innerText; self.innerText = 'Считаем…';
    try{
      lastRes = await calcTotals();
      render(lastRes);
      if (!lastRes.error) {
        // показаем сумму на FAB
        $('#wb-mini-badge').text(`${fmtMoney(lastRes.totalAmount)} ₽`);
        toast('Готово');
      } else {
        toast('Нет данных');
      }
    } finally {
      self.innerText = old;
      showProgress(false);
    }
  });

  $('#wb-copy').on('click', function(){
    if (!lastRes){ toast('Сначала «Посчитать»'); return; }
    const text = toClipboard(lastRes);
    GM_setClipboard(text, 'text');
    toast(/ошибка|нет данных/i.test(text) ? 'Не удалось' : 'Скопировано');
  });

  // хоткеи
  document.addEventListener('keydown', e => {
    if (e.altKey && e.key.toLowerCase() === 'a') { e.preventDefault(); $('#wb-calc').click(); }
    if (e.altKey && e.key.toLowerCase() === 'c') { e.preventDefault(); $('#wb-copy').click(); }
  });

  // ===== Table detection (как в твоей версии) =====
  function waitForTables(timeoutMs = 12000) {
    return new Promise(resolve => {
      const now = () => Array.from(document.querySelectorAll('table'));
      const ready = now();
      if (ready.length) return resolve(ready);
      const obs = new MutationObserver(() => {
        const arr = now();
        if (arr.length) { obs.disconnect(); resolve(arr); }
      });
      obs.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { obs.disconnect(); resolve(now()); }, timeoutMs);
    });
  }

  function scanHeaderForIndexes(table) {
    const head = table.querySelector('thead');
    if (!head) return null;
    const rows = Array.from(head.querySelectorAll('tr'));
    if (!rows.length) return null;

    for (const row of rows) {
      const cells = Array.from(row.querySelectorAll('th,td'));
      let running = 0;
      let idxDate = -1, idxAmt = -1, idxOrd = -1;
      for (const th of cells) {
        const text = norm(th.innerText);
        const span = Math.max(1, parseInt(th.getAttribute('colspan') || '1', 10));
        if (idxDate === -1 && /\bдень\b/.test(text)) idxDate = running;
        if (idxAmt  === -1 && text.includes('сумма заказов по розничным ценам')) idxAmt = running;
        if (idxOrd  === -1 && (text.includes('заказано, шт') || text.includes('количество заказов'))) idxOrd = running;
        running += span;
      }
      if (idxDate !== -1 && idxAmt !== -1 && idxOrd !== -1) {
        return { table, date: idxDate, amount: idxAmt, orders: idxOrd };
      }
    }
    return null;
  }

  function guessByFirstDay(table) {
    const tbody = table.querySelector('tbody');
    if (!tbody) return null;
    const rows = Array.from(tbody.querySelectorAll('tr'));
    const reDate = /^\d{2}\.\d{2}\.\d{2}$/;

    for (const r of rows) {
      const tds = Array.from(r.querySelectorAll('td'));
      if (!tds.length) continue;
      let dateIdx = -1;
      for (let i = 0; i < tds.length; i++) {
        const txt = (tds[i].innerText || '').trim();
        if (reDate.test(txt)) { dateIdx = i; break; }
      }
      if (dateIdx === -1) continue;
      let amountIdx = -1, ordersIdx = -1;
      for (let i = dateIdx + 1; i < Math.min(dateIdx + 6, tds.length); i++) {
        const txt = (tds[i].innerText || '').trim();
        const n = parseNumber(txt);
        if (amountIdx === -1 && n > 100 && /[\s,]/.test(txt)) amountIdx = i;
        if (ordersIdx === -1 && n >= 0 && n < 100000 && /^\d+$/.test(txt.replace(/\s+/g,''))) ordersIdx = i;
      }
      if (dateIdx !== -1 && amountIdx !== -1 && ordersIdx !== -1) {
        return { table, date: dateIdx, amount: amountIdx, orders: ordersIdx };
      }
    }
    return null;
  }

  async function resolveWorkingTable() {
    const tables = await waitForTables();
    let pick = null;
    for (const t of tables) { pick = scanHeaderForIndexes(t); if (pick) break; }
    if (!pick) for (const t of tables) { pick = guessByFirstDay(t); if (pick) break; }
    return pick;
  }

  function getDayRows(table) {
    const tbody = table.querySelector('tbody');
    if (!tbody) return [];
    const classBased = Array.from(tbody.querySelectorAll('tr[class*="Body-table__day__"]'));
    if (classBased.length) return classBased;
    const re = /^\d{2}\.\d{2}\.\d{2}$/;
    return Array.from(tbody.querySelectorAll('tr')).filter(tr=>{
      const tds = tr.querySelectorAll('td');
      return tds.length && re.test((tds[0].innerText || tds[1]?.innerText || tds[2]?.innerText || '').trim());
    });
  }

  async function calcTotals() {
    const pick = await resolveWorkingTable();
    if (!pick) {
      return { error: 'Не удалось найти таблицу/колонки. Открой «Детализацию» и раскрой месяц до дней.' };
    }
    const { table, date:colDate, amount:colAmount, orders:colOrders } = pick;

    const startInput = document.getElementById('wb-date-start').value;
    const endInput   = document.getElementById('wb-date-end').value;
    const startDate  = parseInputDateLocal(startInput);
    const endDate    = parseInputDateLocal(endInput); endDate.setHours(23,59,59,999);

    const rows = getDayRows(table);
    const reDate = /^\d{2}\.\d{2}\.\d{2}$/;

    let totalAmount = 0, totalOrders = 0;
    let fromText = null, toText = null;

    for (const tr of rows) {
      const tds = tr.querySelectorAll('td');
      const dateText = (tds[colDate]?.innerText || '').trim();
      if (!reDate.test(dateText)) continue;

      const [dd, mm, yy] = dateText.split('.').map(Number);
      const fullYear = yy < 50 ? 2000 + yy : 1900 + yy;
      const d = new Date(fullYear, mm - 1, dd);

      if (d < startDate || d > endDate) continue;

      fromText = fromText || dateText;
      toText = dateText;

      totalAmount += parseNumber((tds[colAmount]?.innerText || '').trim());
      totalOrders += parseNumber((tds[colOrders]?.innerText || '').trim());
    }

    if (fromText == null) {
      return { error: 'Нет дней в выбранном периоде. Убедись, что месяц раскрыт до дат.' };
    }

    return { from: fromText, to: toText, totalAmount, totalOrders };
  }

  function render(res){
    const box = document.getElementById('wb-result');
    if (res.error) {
      box.classList.add('show');
      box.innerHTML = `<div style="color:#c62828;">${res.error}</div>`;
      return;
    }
    box.classList.add('show');
    box.innerHTML = `
      <div class="wb-grid">
        <div class="wb-k">Период</div><div class="wb-v">${res.from} — ${res.to}</div>
        <div class="wb-k">Сумма заказов</div><div class="wb-v">${fmtMoney(res.totalAmount)} ₽</div>
        <div class="wb-k">Заказано, шт.</div><div class="wb-v">${res.totalOrders}</div>
      </div>
    `;
  }

  function toClipboard(res){
    if (res.error) return res.error;
    return `Период: ${res.from} — ${res.to}
Сумма заказов: ${fmtMoney(res.totalAmount)} ₽
Заказано, шт.: ${res.totalOrders}
`;
  }

  // ===== UX helpers =====
  function setTheme(mode){
    $('#wb-period-root').attr('data-theme', mode);
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
    const $wrap = $('#wb-period-root #wb-progress-wrap');
    const $txt  = $('#wb-period-root #wb-progress-text');
    if (on){ $txt.text(text); $wrap.show(); }
    else  { $wrap.hide(); }
  }
  function toast(msg){
    $('#wb-toast-text').text(msg);
    $('#wb-toast').addClass('show');
    setTimeout(()=> $('#wb-toast').removeClass('show'), 1600);
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
        $('#wb-period-root').css({left:pos.left+'px', top:pos.top+'px', right:'auto', bottom:'auto'});
      }
    }catch{}
  }
})();
