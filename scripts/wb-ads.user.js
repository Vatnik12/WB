// ==UserScript==
// @name         WB Реклама
// @namespace    https://github.com/Vatnik12/WB
// @version      4.1.1
// @description  WB tools
// @author       Vatnik
// @homepageURL  https://github.com/Vatnik12/WB
// @supportURL   https://github.com/Vatnik12/WB/issues
// @updateURL    https://raw.githubusercontent.com/Vatnik12/WB/main/scripts/wb-ads.user.js
// @downloadURL  https://raw.githubusercontent.com/Vatnik12/WB/main/scripts/wb-ads.user.js
// @match        https://cmp.wildberries.ru/campaigns/statistics*
// @grant        GM_addStyle
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// @run-at       document-idle
// @license      MIT
// ==/UserScript==


(function () {
  'use strict';

  // ===== CONST / THEME =====
  const BRAND = {
    purple:'#7e3bff', purpleD:'#6a2cd6',
    red:'#ff2d55',
    glassLight:'rgba(255,255,255,0.70)',
    glassDark:'rgba(20,22,28,0.72)',
    fabGlass:'rgba(126,59,255,0.35)',
    fabBorder:'rgba(126,59,255,0.65)',
    border:'rgba(0,0,0,0.08)', borderDark:'rgba(255,255,255,0.14)',
    lightText:'#111', darkText:'#f2f4f8', darkMuted:'#c9cfe2', darkRed:'#ff6b6b',
    green:'#14b85a', greenD:'#0f9a4b'
  };
  const LS_POS = 'wb_ads_panel_pos';
  const LS_COLLAPSED = 'wb_ads_collapsed';
  const LS_THEME = 'wb_ads_theme';

  // ===== STATE =====
  let activeTotal = 0, archiveTotal = 0;
  let activeCount = 0, archiveCount = 0;
  let periodText = '';
  let advMode = false;
  const advTotals = new Map(); // id -> sum

  // Advanced view state
  let advFilter = '';
  const ADV_PAGE_LIMIT = 5; // максимум 5 ID в обычном режиме

  // ===== STYLES =====
  GM_addStyle(`
    :root{
      --wb-shadow: 0 18px 45px rgba(0,0,0,.18);
      --wb-radius: 16px;
      /* NEW */
      --wb-grad: linear-gradient(135deg, #7e3bff, #6a2cd6);
      --wb-grad-soft: linear-gradient(135deg, rgba(126,59,255,.16), rgba(106,44,214,.12));
      --wb-grad-soft-strong: linear-gradient(135deg, rgba(126,59,255,.22), rgba(255,90,200,.16));
    }
    /* NEW */
    @media (prefers-reduced-motion: reduce){
      *{animation:none!important;transition:none!important}
    }

    #wb-ads-root{ position:fixed; right:20px; bottom:20px; z-index:2147483647; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,Arial,sans-serif; letter-spacing:.1px; transition:left .15s ease, top .15s ease; }
    /* FAB */
    #wb-ads-root .wb-fab{ display:inline-flex; align-items:center; gap:10px; padding:10px 14px; border-radius:9999px; background:${BRAND.fabGlass}; border:1px solid ${BRAND.fabBorder}; color:#fff; text-shadow:0 1px 0 rgba(0,0,0,.25); backdrop-filter: blur(12px) saturate(120%); box-shadow: var(--wb-shadow); cursor:grab; user-select:none; transition: transform .18s cubic-bezier(.2,.8,.2,1), box-shadow .2s, opacity .2s; }
    #wb-ads-root .wb-fab:active{ cursor:grabbing; transform:scale(.98); }
    #wb-ads-root .wb-fab:hover{ transform:translateY(-1px); box-shadow:0 22px 44px rgba(126,59,255,.28); }
    #wb-ads-root .wb-fab .wb-title{ font-weight:800; font-size:13px; }
    #wb-ads-root .wb-fab .wb-mini-badge{ background:#fff; color:${BRAND.purpleD}; border:0; padding:2px 8px; border-radius:10px; font-weight:800; font-size:12px; }
    /* Panel */
    #wb-ads-root .wb-panel{ position:absolute; right:0; bottom:58px; width:480px; background:${BRAND.glassLight}; border:1px solid ${BRAND.border}; border-radius:var(--wb-radius); box-shadow:var(--wb-shadow); backdrop-filter: blur(14px) saturate(140%); transform: translateY(10px) scale(.98); opacity:0; visibility:hidden; transition: transform .22s cubic-bezier(.2,.8,.2,1), opacity .22s, visibility .22s; overflow: visible; }
    #wb-ads-root .wb-panel.show{ transform: translateY(0) scale(1); opacity:1; visibility:visible; }
    #wb-ads-root .wb-header{ display:flex; align-items:center; justify-content:space-between; gap:10px; padding:12px 16px; border-bottom:1px solid ${BRAND.border}; cursor:grab; }
    #wb-ads-root .wb-header:active{ cursor:grabbing; }
    #wb-ads-root .wb-header-title{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; font-weight:800; font-size:14px; color:${BRAND.lightText}; }
    #wb-ads-root .wb-dot{ width:10px; height:10px; border-radius:50%; background: linear-gradient(135deg, ${BRAND.purple}, ${BRAND.purpleD}); box-shadow: 0 0 0 3px rgba(126,59,255,.18); }
    #wb-ads-root .wb-right{ display:flex; gap:8px; align-items:center; }
    /* upd badge */
    #wb-ads-root .wb-badge-upd{ padding:2px 8px; border-radius:999px; font-size:11px; font-weight:900; letter-spacing:.3px; text-transform:uppercase; color:#fff; background:linear-gradient(135deg, ${BRAND.green}, ${BRAND.greenD}); box-shadow:0 6px 14px rgba(20,184,90,.25); }
    /* switch */
    #wb-ads-root .wb-switch{ display:inline-flex; align-items:center; gap:8px; padding:4px 6px; border-radius:999px; background:rgba(0,0,0,.06); }
    #wb-ads-root .wb-switch .label{ font-size:12px; font-weight:800; color:#333; }
    #wb-ads-root .wb-switch input{ display:none; }
    #wb-ads-root .wb-switch .slider{ position:relative; width:36px; height:20px; border-radius:999px; background:#d9dbe1; transition:background .15s; }
    #wb-ads-root .wb-switch .slider::after{ content:''; position:absolute; top:2px; left:2px; width:16px; height:16px; border-radius:50%; background:#fff; box-shadow:0 1px 3px rgba(0,0,0,.2); transition:left .18s cubic-bezier(.2,.8,.2,1); }
    #wb-ads-root .wb-switch input:checked + .slider{ background:linear-gradient(135deg, ${BRAND.green}, ${BRAND.greenD}); }
    #wb-ads-root .wb-switch input:checked + .slider::after{ left:18px; }
    /* Theme selector */
    #wb-ads-root .wb-theme{ position:relative; display:inline-grid; grid-auto-flow:column; gap:2px; background:rgba(0,0,0,.06); padding:4px; border-radius:999px; }
    #wb-ads-root .wb-theme .opt{ position:relative; z-index:2; min-width:42px; display:inline-flex; align-items:center; justify-content:center; padding:6px 8px; border:none; background:transparent; cursor:pointer; font-size:14px; font-weight:800; color:#333; }
    #wb-ads-root .wb-theme .selector{ position:absolute; z-index:1; top:4px; bottom:4px; width:calc(50% - 4px); left:4px; border-radius:999px; background:#fff; box-shadow:0 2px 8px rgba(0,0,0,.12); transition:left .22s cubic-bezier(.2,.8,.2,1); }
    #wb-ads-root .wb-close{ background:transparent; border:none; cursor:pointer; color:#8a8fa3; width:28px; height:28px; border-radius:8px; display:flex; align-items:center; justify-content:center; transition:background .15s ease, color .15s ease; }
    #wb-ads-root .wb-close:hover{ background:rgba(0,0,0,.06); color:#333; }
    #wb-ads-root .wb-body{ padding:12px 16px 16px; }
    /* Buttons */
    #wb-ads-root .wb-actions{ display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-bottom:8px; }
    #wb-ads-root .wb-btn{ display:inline-flex; align-items:center; justify-content:center; gap:8px; border:none; border-radius:10px; padding:11px 12px; cursor:pointer; font-weight:800; font-size:13px; transition:transform .12s ease, box-shadow .2s ease, filter .2s; }
    #wb-ads-root .wb-btn.primary{ background:var(--wb-grad); color:#fff; }
    #wb-ads-root .wb-btn.primary:hover{ transform:translateY(-1px); box-shadow:0 10px 24px rgba(126,59,255,.28); }
    #wb-ads-root .wb-btn.ghost{ background:#eef0f6; color:#1f2330; }
    #wb-ads-root .wb-btn.ghost:hover{ background:#e7e9f2; }
    #wb-ads-root .wb-btn.full{ grid-column:1 / -1; }
    /* FAQ */
    #wb-ads-root .wb-help{ display:flex; justify-content:flex-end; margin-bottom:10px; position:relative; z-index:2147483647; }
    #wb-ads-root .wb-help .q{ width:24px; height:24px; border-radius:50%; background:rgba(255,255,255,.92); color:#222; font-weight:900; display:inline-flex; align-items:center; justify-content:center; position:relative; box-shadow:0 2px 8px rgba(0,0,0,.12); user-select:none; }
    #wb-ads-root[data-theme="dark"] .wb-help .q{ background:rgba(42,47,59,.95); color:${BRAND.darkText}; }
    #wb-ads-root .wb-help .q:hover .popup{ opacity:1; transform:translateY(0); pointer-events:auto; }
    #wb-ads-root .wb-help .popup{ position:absolute; right:0; top:calc(100% + 10px); width:360px; max-width:min(360px, 82vw); background:rgba(20,22,28,.92); color:#f5f6fb; padding:14px 16px; border-radius:12px; z-index:2147483647; opacity:0; transform:translateY(6px); transition:opacity .2s, transform .2s; pointer-events:none; backdrop-filter: blur(12px) saturate(140%); box-shadow:0 16px 40px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.06); text-align:left; line-height:1.5; word-break:break-word; }
    #wb-ads-root .wb-help .popup::before{ content:''; position:absolute; right:10px; top:-8px; width:12px; height:12px; background:inherit; transform:rotate(45deg); filter:drop-shadow(0 -2px 2px rgba(0,0,0,.12)); }
    #wb-ads-root .wb-faq-title{ font-weight:700; font-size:13px; margin-bottom:8px; color:#fff; }
    #wb-ads-root .wb-faq-ul{ margin:0; padding:0; list-style:none; }
    #wb-ads-root .wb-faq-ul li{ display:flex; gap:10px; align-items:flex-start; margin:6px 0; color:#e8ebf7; font-size:13px; }
    #wb-ads-root .wb-faq-ul .dot{ margin-top:6px; width:6px; height:6px; border-radius:50%; background:#c5d0ff; flex:0 0 6px; }
    /* LIGHT overrides for FAQ */
    #wb-ads-root[data-theme="light"] .wb-help .popup{ background: rgba(255,255,255,.97); color: #222; box-shadow: 0 16px 40px rgba(0,0,0,.20), inset 0 1px 0 rgba(255,255,255,.60); }
    #wb-ads-root[data-theme="light"] .wb-faq-title{ color: #222; }
    #wb-ads-root[data-theme="light"] .wb-faq-ul li{ color: #2b2f3a; }
    /* Progress */
    #wb-ads-root .wb-progress-wrap{ display:none; margin:6px 0 10px; }
    #wb-ads-root .wb-progress-text{ font-size:12px; color:#6d7285; margin-bottom:6px; }
    #wb-ads-root .wb-progress{ position:relative; height:8px; border-radius:999px; overflow:hidden; background:linear-gradient(180deg, rgba(0,0,0,.06), rgba(0,0,0,.12)); }
    #wb-ads-root .wb-progress .bar{ background:var(--wb-grad); }
    @keyframes wbbar{ 0%{ width:8%; transform:translateX(0); } 50%{ width:70%; transform:translateX(20%); } 100%{ width:8%; transform:translateX(100%); } }
    /* Result card */
    #wb-ads-root .wb-card{ background:rgba(255,255,255,0.60); border:1px solid #e3e6ef; border-radius:12px; padding:12px; color:${BRAND.lightText}; font-size:14px; backdrop-filter: blur(10px) saturate(130%); display:none; }
    #wb-ads-root .wb-card.show{ display:block; }
    #wb-ads-root .wb-row{ display:flex; align-items:center; justify-content:space-between; padding:8px 0; border-bottom:1px dashed rgba(0,0,0,.15); }
    #wb-ads-root .wb-row:last-child{ border-bottom:none; }
    #wb-ads-root .wb-row strong{ color:${BRAND.lightText}; font-weight:700; }
    #wb-ads-root .wb-val{ font-weight:800; font-size:16px; color:${BRAND.red}; }
    #wb-ads-root .wb-note{ font-size:12px; margin-top:6px; color:#6d7285; }
    /* Advanced table */
    #wb-ads-root .wb-adv-head{ display:flex; align-items:center; justify-content:space-between; gap:8px; margin-top:10px; margin-bottom:6px; font-weight:800; flex-wrap:wrap; }
    #wb-ads-root .wb-adv-left{ display:flex; align-items:center; gap:8px; flex:1 1 auto; }
    #wb-ads-root .wb-adv-counter{ font-size:12px; font-weight:800; color:#6d7285; }
    #wb-ads-root .wb-adv-search{ flex:1 1 160px; min-width:160px; display:flex; align-items:center; gap:6px; background:rgba(0,0,0,.06); padding:6px 8px; border-radius:8px; }
    #wb-ads-root .wb-adv-search input{ width:100%; border:none; background:transparent; outline:none; font-size:13px; color:#111; }
    #wb-ads-root[data-theme="dark"] .wb-adv-search input{ color:#fff; caret-color:#fff; }
    #wb-ads-root .wb-table{ width:100%; border-collapse:separate; border-spacing:0; overflow:hidden; border-radius:10px; }
    #wb-ads-root .wb-table th, #wb-ads-root .wb-table td{ padding:8px 10px; font-size:13px; }
    #wb-ads-root .wb-table thead th{ text-align:left; background:rgba(0,0,0,.06); }
    #wb-ads-root .wb-table tbody tr:nth-child(even){ background:rgba(0,0,0,.035); }
    #wb-ads-root .wb-table tfoot td{ font-weight:900; border-top:1px dashed rgba(0,0,0,.2); }
    #wb-ads-root .wb-adv-actions{ display:flex; align-items:center; gap:8px; }
    /* Toast */
    #wb-ads-root .wb-toast{ position:absolute; left:50%; transform:translateX(-50%) translateY(6px); bottom:10px; background:rgba(17,20,28,.96); color:#fff; padding:10px 12px; border-radius:10px; font-size:13px; font-weight:700; box-shadow:var(--wb-shadow); display:flex; gap:8px; align-items:center; opacity:0; transition:opacity .2s, transform .2s; }
    #wb-ads-root .wb-toast.show{ opacity:1; transform:translateX(-50%) translateY(0); }
    #wb-ads-root .wb-toast .ico{ width:16px; height:16px; display:inline-flex; align-items:center; justify-content:center; }
    /* Dark overrides */
    #wb-ads-root[data-theme="dark"] .wb-panel{ background:${BRAND.glassDark}; border-color:${BRAND.borderDark}; }
    #wb-ads-root[data-theme="dark"] .wb-header-title{ color:${BRAND.darkText}; }
    #wb-ads-root[data-theme="dark"] .wb-theme{ background:rgba(255,255,255,.08); }
    #wb-ads-root[data-theme="dark"] .wb-theme .opt{ color:${BRAND.darkText}; }
    #wb-ads-root[data-theme="dark"] .wb-theme .selector{ background:#1f2330; }
    #wb-ads-root[data-theme="dark"] .wb-btn.ghost{ background:#2a2f3b; color:${BRAND.darkText}; }
    #wb-ads-root[data-theme="dark"] .wb-btn.ghost:hover{ background:#323947; }
    #wb-ads-root[data-theme="dark"] .wb-progress{ background:linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.14)); }
    #wb-ads-root[data-theme="dark"] .wb-progress-text{ color:${BRAND.darkMuted}; }
    #wb-ads-root[data-theme="dark"] .wb-card{ background:rgba(20,22,28,0.60); border-color:${BRAND.borderDark}; color:${BRAND.darkText}; }
    #wb-ads-root[data-theme="dark"] .wb-row{ border-bottom:1px dashed rgba(255,255,255,.18); }
    #wb-ads-root[data-theme="dark"] .wb-row strong{ color:${BRAND.darkText}; }
    #wb-ads-root[data-theme="dark"] .wb-val{ color:${BRAND.darkRed}; }

    /* ===== DATA MODE (fullscreen) ===== */
    #wb-data-mode{ position:fixed; inset:0; z-index:2147483647; display:none; }
    #wb-data-mode.show{ display:block; }
    #wb-data-mode .backdrop{ position:absolute; inset:0; backdrop-filter: blur(12px) saturate(140%); background:rgba(10,12,18,.55); }
    #wb-ads-root[data-theme="light"] ~ #wb-data-mode .backdrop{ background:rgba(255,255,255,.55); }
    #wb-data-mode .shell{ position:relative; inset:0; height:100%; display:flex; flex-direction:column; padding:20px; }
    #wb-data-mode .topbar{ display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:14px; }
    #wb-data-mode .left{ display:flex; align-items:center; gap:10px; }
    #wb-data-mode .title{ font-weight:900; font-size:16px; color:#fff; text-shadow:0 2px 12px rgba(0,0,0,.35); }
    #wb-ads-root[data-theme="light"] ~ #wb-data-mode .title{ color:#111; text-shadow:none; }
    #wb-data-mode .actions{ display:flex; align-items:center; gap:8px; }
    #wb-data-mode .btn{ border:none; padding:10px 12px; border-radius:10px; font-weight:800; cursor:pointer; }
    #wb-data-mode .btn.primary{ background:linear-gradient(135deg, ${BRAND.purple}, ${BRAND.purpleD}); color:#fff; }
    #wb-data-mode .btn.ghost{ background:rgba(255,255,255,.86); }
    #wb-ads-root[data-theme="light"] ~ #wb-data-mode .btn.ghost{ background:#eef0f6; }
    #wb-data-mode .search{ display:flex; align-items:center; gap:8px; background:rgba(255,255,255,.10); border:1px solid rgba(255,255,255,.22); padding:8px 10px; border-radius:10px; min-width:240px; }
    #wb-ads-root[data-theme="light"] ~ #wb-data-mode .search{ background:rgba(0,0,0,.06); border-color: rgba(0,0,0,.08); }
    #wb-data-mode .search input{ border:none; outline:none; background:transparent; color:#fff; width:280px; font-size:14px; }
    #wb-ads-root[data-theme="light"] ~ #wb-data-mode .search input{ color:#111; }

    #wb-data-mode .stage{
      position:relative; flex:1 1 auto; border-radius:14px; overflow:hidden;
      background:var(--wb-grad-soft);
      box-shadow: 0 18px 45px rgba(0,0,0,.18), inset 0 1px 0 rgba(255,255,255,.06);
    }
    #wb-ads-root[data-theme="light"] ~ #wb-data-mode .stage{
      background:linear-gradient(135deg, rgba(255,255,255,.86), rgba(255,255,255,.92));
      box-shadow: 0 18px 45px rgba(0,0,0,.10), inset 0 1px 0 rgba(255,255,255,.60);
    }
    #wb-data-mode .grid{
      position:absolute; inset:0; padding:18px; display:grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap:14px; overflow:auto; justify-items:stretch; align-content:start;
      perspective: 900px; /* NEW: для 3D-tilt */
    }
    #wb-data-mode .grid.few-1{ grid-template-columns: minmax(340px, min(880px, 82vw)); place-content:start center; }
    #wb-data-mode .grid.few-2{ grid-template-columns: repeat(2, minmax(320px, min(560px, 44vw))); place-content:start center; }

    /* card */
    #wb-data-mode .cell{
      position:relative;
      color:#fff;
      background:
        linear-gradient(180deg, rgba(255,255,255,.06), rgba(0,0,0,.06)),
        linear-gradient(135deg, rgba(126,59,255,.22), rgba(255,90,200,.18));
      border:1px solid rgba(255,255,255,.18);
      border-radius:18px; padding:16px;
      transform:scale(.98); opacity:0;
      animation: cellFadeIn .26s ease forwards, springIn .48s cubic-bezier(.2,.8,.3,1.4) .06s both; /* NEW */
      overflow:hidden; will-change: transform, filter; transform-style: preserve-3d; /* NEW */
    }
    #wb-ads-root[data-theme="light"] ~ #wb-data-mode .cell{
      color:#0f1220;
      background:
        linear-gradient(180deg, rgba(0,0,0,.02), rgba(0,0,0,.04)),
        linear-gradient(135deg, rgba(126,59,255,.10), rgba(255,90,200,.08));
      border-color:#e3e6ef;
    }
    #wb-data-mode .cell::after{ /* NEW: мягкая подсветка */
      content:''; position:absolute; inset:0;
      background:radial-gradient(1200px 300px at -10% -20%, rgba(255,255,255,.08), transparent 50%);
      pointer-events:none;
    }
    #wb-data-mode .cell-inner{ position:relative; z-index:2; transform: translateZ(20px); } /* NEW */
    #wb-data-mode .cell .id{ font-weight:900; font-size:clamp(12px, 1.4vw, 14px); opacity:.92; }
    #wb-data-mode .cell .sum{ font-size:clamp(18px, 2.2vw, 28px); font-weight:900; margin-top:6px; letter-spacing:.3px; }
    /* hover / tilt (класс .hovered добавляет JS) */
    #wb-data-mode .cell.hovered .cell-inner{ transition: transform .12s ease; }
    #wb-data-mode .cell.hovered{ box-shadow: 0 18px 40px rgba(126,59,255,.22); }

    @keyframes cellFadeIn{ to{ transform:scale(1); opacity:1; } }
    @keyframes springIn{ 0%{ transform:scale(.96); } 60%{ transform:scale(1.035); } 100%{ transform:scale(1); } }


    /* pieces for shatter/assemble */
    #wb-data-mode .pieces{ position:absolute; inset:0; z-index:1; pointer-events:none; }
    #wb-data-mode .p{ position:absolute; width:36%; height:36%; background:currentColor; opacity:.08; filter:blur(0.4px); transform-origin:center; border-radius:6px; }
    /* NEW: светлая тема — цвет осколков менее тёмный */
    #wb-ads-root[data-theme="light"] ~ #wb-data-mode .pieces{ color:#7c6bd6; }

    /* layout of 6 pieces */
    #wb-data-mode .p1{ left:4%; top:4%; clip-path:polygon(0 0, 100% 0, 80% 100%, 0 80%); }
    #wb-data-mode .p2{ right:4%; top:6%; clip-path:polygon(20% 0, 100% 0, 100% 80%, 0 60%); }
    #wb-data-mode .p3{ left:8%; bottom:6%; clip-path:polygon(0 20%, 80% 0, 100% 100%, 0 100%); }
    #wb-data-mode .p4{ right:6%; bottom:6%; clip-path:polygon(0 0, 100% 10%, 80% 100%, 0 90%); }
    #wb-data-mode .p5{ left:32%; top:30%; width:22%; height:22%; clip-path:polygon(0 0, 100% 0, 100% 100%, 0 60%); }
    #wb-data-mode .p6{ right:30%; bottom:26%; width:24%; height:24%; clip-path:polygon(0 40%, 100% 0, 100% 100%, 0 100%); }

    /* SHATTER OUT */
    #wb-data-mode .cell.shatter .p1{ animation:boom1 .38s ease forwards; }
    #wb-data-mode .cell.shatter .p2{ animation:boom2 .38s ease forwards; }
    #wb-data-mode .cell.shatter .p3{ animation:boom3 .38s ease forwards; }
    #wb-data-mode .cell.shatter .p4{ animation:boom4 .38s ease forwards; }
    #wb-data-mode .cell.shatter .p5{ animation:boom5 .38s ease forwards; }
    #wb-data-mode .cell.shatter .p6{ animation:boom6 .38s ease forwards; }
    #wb-data-mode .cell.shatter{ animation: cellOut .32s ease forwards; }
    @keyframes cellOut{ to{ transform:scale(.96); opacity:0; filter:blur(2px);} }
    @keyframes boom1{ to{ transform:translate(-30px,-26px) rotate(-12deg); opacity:0; } }
    @keyframes boom2{ to{ transform:translate(36px,-18px) rotate(10deg); opacity:0; } }
    @keyframes boom3{ to{ transform:translate(-26px,24px) rotate(-8deg); opacity:0; } }
    @keyframes boom4{ to{ transform:translate(28px,28px) rotate(12deg); opacity:0; } }
    @keyframes boom5{ to{ transform:translate(-18px,8px) rotate(-16deg); opacity:0; } }
    @keyframes boom6{ to{ transform:translate(16px,-8px) rotate(14deg); opacity:0; } }

    /* ASSEMBLE IN */
    #wb-data-mode .cell.assemble .p1{ animation:rev1 .42s ease backwards; }
    #wb-data-mode .cell.assemble .p2{ animation:rev2 .42s ease backwards; }
    #wb-data-mode .cell.assemble .p3{ animation:rev3 .42s ease backwards; }
    #wb-data-mode .cell.assemble .p4{ animation:rev4 .42s ease backwards; }
    #wb-data-mode .cell.assemble .p5{ animation:rev5 .42s ease backwards; }
    #wb-data-mode .cell.assemble .p6{ animation:rev6 .42s ease backwards; }
    @keyframes rev1{ from{ transform:translate(-30px,-26px) rotate(-12deg); opacity:0; } }
    @keyframes rev2{ from{ transform:translate(36px,-18px) rotate(10deg); opacity:0; } }
    @keyframes rev3{ from{ transform:translate(-26px,24px) rotate(-8deg); opacity:0; } }
    @keyframes rev4{ from{ transform:translate(28px,28px) rotate(12deg); opacity:0; } }
    @keyframes rev5{ from{ transform:translate(-18px,8px) rotate(-16deg); opacity:0; } }
    @keyframes rev6{ from{ transform:translate(16px,-8px) rotate(14deg); opacity:0; } }
  `);

  // ===== HTML =====
  const html = `
    <div id="wb-ads-root" data-theme="light">
      <!-- FAB -->
      <button class="wb-fab" id="wb-fab" title="Расходы на рекламу">
        <span class="wb-logo" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 4v16M4 12h16" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>
        </span>
        <span class="wb-title">Реклама WB</span>
        <span class="wb-mini-badge" id="wb-mini-badge">—</span>
      </button>

      <!-- Panel -->
      <div class="wb-panel" id="wb-panel">
        <div class="wb-header" id="wb-header">
          <div class="wb-header-title">
            <span class="wb-dot"></span>
            Затраты на рекламу <span class="wb-badge-upd">upd</span>
            <label class="wb-switch" title="Суммировать по ID кампании">
              <input type="checkbox" id="adv-toggle"/>
              <span class="slider"></span><span class="label">Расширенный режим</span>
            </label>
          </div>
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
          <!-- Controls -->
          <div class="wb-actions">
            <button class="wb-btn primary" id="btn-active">Активные</button>
            <button class="wb-btn ghost"   id="btn-archive">Архивные</button>
            <button class="wb-btn ghost full" id="btn-copy">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 9h10v10H9zM5 5h10v10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              Копировать отчёт
            </button>
            <button class="wb-btn ghost full" id="btn-reset">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 13a8 8 0 1 0 2-5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
              Сброс
            </button>
          </div>

          <!-- FAQ -->
          <div class="wb-help" id="wb-faq">
            <span class="q">?
              <div class="popup">
                <div class="wb-faq-title">Как пользоваться</div>
                <ul class="wb-faq-ul">
                  <li><span class="dot"></span><span>Выбери период в поле даты (вверху страницы).</span></li>
                  <li><span class="dot"></span><span>Выбери Показать записей: 50 (внизу страницы).</span></li>
                  <li><span class="dot"></span><span>Страниц несколько? Жми <b>Активные</b>/<b>Архивные</b> на каждой — значения <u>накапливаются</u>.</span></li>
                  <li><span class="dot"></span><span>В <b>Расширенном режиме</b> формируется таблица «ID кампании → общий расход» + поиск.</span></li>
                  <li><span class="dot"></span><span><b>Сброс</b> обнуляет всё и скрывает результаты.</span></li>
                  <li><span class="dot"></span><span><b>Копировать отчёт</b> — текст с периодом, суммами и (если включено) таблицей.</span></li>
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
            <div class="wb-row"><strong>Активные</strong><span class="wb-val" id="v-active">0</span></div>
            <div class="wb-row"><strong>Архивные</strong><span class="wb-val" id="v-archive">0</span></div>
            <div class="wb-row"><strong>Итого</strong><span class="wb-val" id="v-total">0</span></div>
            <div class="wb-note" id="v-period"></div>
          </div>

          <!-- Advanced (per ID) -->
          <div class="wb-card" id="adv-card">
            <div class="wb-adv-head">
              <div class="wb-adv-left">
                <span>Сводка по ID кампании</span>
                <span class="wb-adv-counter" id="adv-counter"></span>
              </div>
              <div class="wb-adv-actions">
                <div class="wb-adv-search" id="adv-search-wrap" title="Поиск по ID (появится при данных)" style="display:none">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M21 21l-4.3-4.3M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                  <input id="adv-search" type="text" placeholder="Поиск по ID"/>
                </div>
                <button class="wb-btn ghost" id="btn-enter-data" style="display:none">Погрузиться в данные</button>
                <button class="wb-btn ghost" id="btn-copy-adv" title="Скопировать таблицу">Копировать таблицу</button>
              </div>
            </div>
            <div id="adv-table"></div>
          </div>
        </div>

        <div class="wb-toast" id="toast"><span class="ico">✅</span><span id="toast-text">Готово</span></div>
      </div>
    </div>

    <!-- DATA MODE OVERLAY -->
    <div id="wb-data-mode" aria-hidden="true">
      <div class="backdrop"></div>
      <div class="shell">
        <div class="topbar">
          <div class="left">
            <div class="title">Режим данных</div>
            <div class="search">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M21 21l-4.3-4.3M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
              <input id="data-search" type="text" placeholder="Поиск по ID…"/>
            </div>
          </div>
          <div class="actions">
            <div class="wb-theme" id="data-theme">
              <div class="selector" id="data-theme-selector"></div>
              <button class="opt" data-mode="light" id="data-theme-light">☀️</button>
              <button class="opt" data-mode="dark"  id="data-theme-dark">🌙</button>
            </div>
            <button class="btn primary" id="btn-exit-data">К скрипту</button>
          </div>
        </div>
        <div class="stage">
          <div class="grid" id="data-grid"></div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', html);

  // ===== INIT =====
  restorePosition();
  setTheme(loadTheme() || 'light');
  setCollapsed((localStorage.getItem(LS_COLLAPSED) ?? '1') === '1');

  // handlers
  $('#wb-fab').on('click', () => togglePanel(true));
  $('#wb-close').on('click', () => togglePanel(false));
  $('#theme-light').on('click', () => setTheme('light'));
  $('#theme-dark').on('click', () => setTheme('dark'));
  $('#data-theme-light').on('click', () => setTheme('light'));
  $('#data-theme-dark').on('click', () => setTheme('dark'));
  $('#adv-toggle').on('change', function(){ advMode = this.checked; render(); });

  makeDraggable($('#wb-ads-root'), $('#wb-header'));
  makeDraggable($('#wb-ads-root'), $('#wb-fab'));

  $('#btn-active').on('click', () => runAndAccumulate('active'));
  $('#btn-archive').on('click', () => runAndAccumulate('archive'));
  $('#btn-copy').on('click', copyReport);
  $('#btn-copy-adv').on('click', copyAdvTable);
  $('#btn-reset').on('click', resetAll);

  // Advanced search
  $('#adv-search').on('input', function(){ advFilter = (this.value||'').trim().toLowerCase(); render(); });

  // Data Mode
  $('#btn-enter-data').on('click', openDataMode);
  $('#btn-exit-data').on('click', closeDataMode);
  $('#data-search').on('input', handleDataSearch);

  updatePeriod();
  setInterval(updatePeriod, 5000);

  // ===== PARSING =====
  function getPeriodText(){
    const $inp = $('input.ant-input[placeholder="Выберите интервал"]');
    return $inp.length ? ($inp.val() || '').trim() : '';
  }
  function updatePeriod(){
    periodText = getPeriodText();
    $('#v-period').text(periodText ? `Период: ${periodText}` : '');
  }

  // robust header finder
  function findHeaderIndex(matchers){
    let idx = -1;
    $('th.ant-table-cell').each(function(i){
      const t = $(this).text().trim().toLowerCase().replace(/\s+/g,' ');
      for (const m of matchers){
        if (typeof m === 'string'){
          if (t === m || t.includes(m)){ idx = i; return false; }
        } else if (m instanceof RegExp){
          if (m.test(t)){ idx = i; return false; }
        }
      }
    });
    return idx;
  }

  function sumCostsOnPage(){
    const idx = findHeaderIndex(['затраты, ₽','затраты','расход','расходы']);
    if (idx === -1) return {sum:0, count:0};
    let sum = 0, count = 0;
    $('tbody tr.ant-table-row').each(function(){
      const $td = $(this).find(`td.ant-table-cell:eq(${idx})`);
      if (!$td.length) return;
      const n = parseMoney($td.text());
      if (!isNaN(n)){ sum += n; count++; }
    });
    return {sum, count};
  }

  function collectPerIdOnPage(){
    const idIdx = findHeaderIndex(['id кампании', /(^|\s)id(\s|$)/]);
    const costIdx = findHeaderIndex(['затраты, ₽','затраты','расход','расходы']);
    if (idIdx === -1 || costIdx === -1) return 0;
    let rows = 0;
    $('tbody tr.ant-table-row').each(function(){
      const $id = $(this).find(`td.ant-table-cell:eq(${idIdx})`);
      const $c  = $(this).find(`td.ant-table-cell:eq(${costIdx})`);
      if (!$id.length || !$c.length) return;
      const id = ($id.text()||'').trim().replace(/\s+/g,' ');
      const n = parseMoney($c.text());
      if (!id || isNaN(n)) return;
      advTotals.set(id, (advTotals.get(id) || 0) + n);
      rows++;
    });
    return rows;
  }

  // ===== CALC (always accumulate) =====
  function n2(n){ return n.toLocaleString('ru-RU',{minimumFractionDigits:2, maximumFractionDigits:2}); }
  function parseMoney(txt){
    const s = (txt||'').toString().replace(/\s/g,'').replace(/[^\d,.-]/g,'').replace(',', '.');
    const n = parseFloat(s);
    return isNaN(n) ? NaN : n;
  }

  async function runAndAccumulate(mode){
    showProgress(true, 'Считаю изо всех сил…');
    await sleep(120);
    const {sum, count} = sumCostsOnPage();
    if (mode === 'active'){ activeTotal += sum; activeCount += count; }
    else { archiveTotal += sum; archiveCount += count; }
    if (advMode){ collectPerIdOnPage(); }
    render();
    showProgress(false);
    toast('Добавлено к итогу');
  }

  function resetAll(){
    activeTotal=archiveTotal=0; activeCount=archiveCount=0;
    advTotals.clear();
    advFilter='';
    render(true);
    toast('Сброшено');
  }

  // ===== Advanced helpers =====
  function getAdvArrayFiltered(){
    let arr = Array.from(advTotals.entries()).map(([id,sum])=>({id,sum}));
    arr.sort((a,b)=> b.sum - a.sum);
    if (advFilter){
      const f = advFilter;
      arr = arr.filter(r => r.id.toLowerCase().includes(f));
    }
    return arr;
  }

  function render(hideIfZero=false){
    const total = activeTotal + archiveTotal;
    $('#v-active').text(`${n2(activeTotal)} ₽ (${activeCount})`);
    $('#v-archive').text(`${n2(archiveTotal)} ₽ (${archiveCount})`);
    $('#v-total').text(`${n2(total)} ₽`);
    $('#result').toggleClass('show', !(hideIfZero && total===0));
    $('#wb-mini-badge').text(total ? n2(total) : '—');

    // Advanced block
    const showAdv = advMode && advTotals.size>0;
    $('#adv-card').toggleClass('show', showAdv);
    $('#adv-search-wrap').css('display', showAdv ? '' : 'none');
    $('#btn-enter-data').css('display', showAdv ? '' : 'none');

    if (showAdv){
      const arrAll = getAdvArrayFiltered();
      const visibleArr = arrAll.slice(0, ADV_PAGE_LIMIT); // максимум 5

      // counter
      $('#adv-counter').text(`${visibleArr.length} из ${arrAll.length}`);

      // table render
      const rows = visibleArr.map(r=>`<tr><td>${escapeHtml(r.id)}</td><td style="text-align:right;font-weight:800">${n2(r.sum)} ₽</td></tr>`).join('');
      const totalStr = n2(arrAll.reduce((s,r)=>s+r.sum,0))+' ₽';
      $('#adv-table').html(`
        <table class="wb-table">
          <thead><tr><th>ID кампании</th><th style="text-align:right">Сумма</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="2" style="text-align:center;color:#6d7285">Нет совпадений</td></tr>`}</tbody>
          <tfoot><tr><td>Итого (с учётом фильтра)</td><td style="text-align:right">${totalStr}</td></tr></tfoot>
        </table>
      `);
    } else {
      $('#adv-table').empty();
      $('#adv-counter').text('');
    }
  }

  // ===== DATA MODE =====
  function openDataMode(){
    buildDataGrid(); // initial render
    $('#wb-data-mode').addClass('show');
    $('#wb-panel').removeClass('show');
  }
  function closeDataMode(){
    $('#wb-data-mode').removeClass('show');
    togglePanel(true);
  }

  function cellHtml(id, sum, extraClass='assemble'){
    return `
      <div class="cell ${extraClass}" data-id="${escapeHtml(id)}">
        <div class="cell-inner">
          <div class="id">${escapeHtml(id)}</div>
          <div class="sum">${n2(sum)} ₽</div>
        </div>
        <div class="pieces">
          <span class="p p1"></span><span class="p p2"></span><span class="p p3"></span>
          <span class="p p4"></span><span class="p p5"></span><span class="p p6"></span>
        </div>
      </div>`;
  }

  function applyFewClass(count){
    const $grid = $('#data-grid');
    $grid.removeClass('few-1 few-2');
    if (count === 1) $grid.addClass('few-1');
    else if (count === 2) $grid.addClass('few-2');
  }

  function buildDataGrid(filter=''){
    const $grid = $('#data-grid');
    const arrAll = Array.from(advTotals.entries()).map(([id,sum])=>({id,sum})).sort((a,b)=>b.sum-a.sum);
    const f = (filter||'').trim().toLowerCase();
    const data = f ? arrAll.filter(r => r.id.toLowerCase().includes(f)) : arrAll;

    // full rebuild with assemble animation
    const html = data.map(r => cellHtml(r.id, r.sum, 'assemble')).join('');
    $grid.html(html);
    applyFewClass(data.length);
  }

  let searchDebounce = null;
  function handleDataSearch(){
    const q = ($('#data-search').val()||'').trim();
    if (searchDebounce) clearTimeout(searchDebounce);
    searchDebounce = setTimeout(()=> updateDataGridAnimated(q), 120);
  }

  // diff + shatter/assemble animations
  function updateDataGridAnimated(filter=''){
    const $grid = $('#data-grid');
    const oldIds = new Set(Array.from($grid.children()).map(el => el.getAttribute('data-id')));

    const arrAll = Array.from(advTotals.entries()).map(([id,sum])=>({id,sum})).sort((a,b)=>b.sum-a.sum);
    const f = (filter||'').trim().toLowerCase();
    const data = f ? arrAll.filter(r => r.id.toLowerCase().includes(f)) : arrAll;
    const newIds = new Set(data.map(r=>r.id));

    // 1) mark removed -> shatter, then remove
    oldIds.forEach(id=>{
      if(!newIds.has(id)){
        const el = $grid.find(`.cell[data-id="${cssEscape(id)}"]`);
        el.addClass('shatter').removeClass('assemble');
        setTimeout(()=> el.remove(), 390);
      }
    });

    // 2) add new with assemble
    data.forEach((r, idx)=>{
      if(!oldIds.has(r.id)){
        $grid.append(cellHtml(r.id, r.sum, 'assemble'));
      }
    });

    // 3) reorder to match data order
    data.forEach(r=>{
      const el = $grid.find(`.cell[data-id="${cssEscape(r.id)}"]`);
      $grid.append(el); // move to end in correct order
    });

    applyFewClass(data.length);
  }

  // ===== COPY =====
  function copyReport(){
    const total = activeTotal + archiveTotal;
    let text = `Отчёт по рекламе WB${periodText ? ' за период ' + periodText : ''}:\n\nВсе, кроме архивных:\n- Количество: ${activeCount}\n- Сумма: ${n2(activeTotal)} ₽\n\nАрхивные кампании:\n- Количество: ${archiveCount}\n- Сумма: ${n2(archiveTotal)} ₽\n\nИтого:\n- Общая сумма: ${n2(total)} ₽`;
    if (advMode && advTotals.size>0){
      const arr = getAdvArrayFiltered();
      text += `\n\nСводка по ID кампании (ID;Сумма ₽) — ${arr.length} строк:\n`;
      text += arr.map(r=> `${r.id};${n2(r.sum)}`).join('\n');
    }
    navigator.clipboard.writeText(text).then(()=> toast('Скопировано')).catch(()=> toast('Не удалось скопировать'));
  }

  function copyAdvTable(){
    if (!(advMode && advTotals.size>0)){ toast('Нет данных'); return; }
    const arr = getAdvArrayFiltered();
    const tsv = ['ID кампании\tСумма ₽'].concat(arr.map(r=> `${r.id}\t${n2(r.sum)}`)).join('\n');
    navigator.clipboard.writeText(tsv).then(()=> toast('Таблица скопирована')).catch(()=> toast('Не удалось скопировать'));
  }

  // ===== UX HELPERS =====
  function setTheme(mode){
    $('#wb-ads-root').attr('data-theme', mode);
    localStorage.setItem(LS_THEME, mode);
    $('#theme-selector').css('left', mode === 'light' ? '4px' : 'calc(50% + 2px)');
    $('#data-theme-selector').css('left', mode === 'light' ? '4px' : 'calc(50% + 2px)');
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
        $('#wb-ads-root').css({left:pos.left+'px', top:pos.top+'px', right:'auto', bottom:'auto'});
      }
    }catch{}
  }

  function escapeHtml(s){
    return (s||'').toString().replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  }
  function cssEscape(s){
    return s.replace(/["\\]/g, '\\$&');
  }
})();
