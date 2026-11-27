/* Dashboard application — tabs, data load, tables, charts wiring, export, share.
   Extracted from index.html; loaded synchronously at the same position as before.
   Map it with: grep -n "^// ──\|^/\* ──\|^function \|^async function " public/app/js/dashboard.js */
/* ── ELITE IMAGE EXPORT METHOD ── */
/* The image exporter (~280 KB) is only needed when someone takes a snapshot,
   so it is fetched on first use instead of blocking every page load. This
   build understands modern CSS colours (color-mix / color()), which the
   previous one rejected — every export failed with "unsupported color function". */
let _exporterPromise = null;
function loadExporter() {
  if (!_exporterPromise) {
    _exporterPromise = new Promise((resolve, reject) => {
      const done = () => {
        const fn = window.html2canvas && (window.html2canvas.default || window.html2canvas);
        typeof fn === 'function' ? resolve(fn) : reject(new Error('Image exporter unavailable'));
      };
      if (window.html2canvas) return done();
      const el = document.createElement('script');
      el.src = '/vendor/html2canvas-pro-2.5.0.min.js';
      el.onload = done;
      el.onerror = () => reject(new Error('Image exporter failed to load'));
      document.head.appendChild(el);
    }).catch(err => { _exporterPromise = null; throw err; });
  }
  return _exporterPromise;
}

async function exportDOM(element, namePrefix) {
  // The large-display UI scale distorts the exporter's text layout, so render
  // at 1:1 and restore the scale afterwards (output is 3x+ regardless).
  const _root = document.documentElement, _zoom = _root.style.zoom;
  _root.style.zoom = '';
  try {
    const btn = element.querySelector('.cam-btn');
    if(btn) btn.style.display = 'none'; // hide button during capture
    
    // Slight delay to ensure hover states clear
    await new Promise(r => setTimeout(r, 100));
    
    // Create a temporary wrapper to inject watermark
    const clone = element.cloneNode(true);
    const _isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const watermark = document.createElement('div');
    watermark.className = 'mc-export-mark';
    const _wm = window.MCBrand ? MCBrand.logoFor(_isLight) : null;
    watermark.style.color = _isLight ? '#000' : '#fff';
    watermark.innerHTML = _wm ? `<span>FII &amp; DII Data</span><img alt="Mr. Chartist" src="${_wm}">` : '<span>Mr. Chartist · FII &amp; DII Data</span>';
    const _wmImg = watermark.querySelector('img');
    if (_wmImg) { try { await _wmImg.decode(); } catch (e) {} }
    
    // Only append to cards, not the full body export to avoid mess
    if(element.classList.contains('card') || element.classList.contains('card-glass')) {
       clone.style.position = 'relative';
       clone.appendChild(watermark);
       document.body.appendChild(clone);
       clone.style.position = 'absolute';
       clone.style.left = '-9999px';
    } else {
       // For full page dump, just use original
       clone.style.display = 'none';
       // Dashboard panels are captured in place (their layout depends on the
       // surrounding grid), so brand them directly for the duration of the capture
       if (element.classList.contains('terminal-panel')) {
         if (getComputedStyle(element).position === 'static') element.style.position = 'relative';
         element.appendChild(watermark);
       }
    }
    
    const targetEl = clone.parentNode === document.body ? clone : element;

    const isLightTheme = document.documentElement.getAttribute('data-theme') === 'light';
    const canvas = await (await loadExporter())(targetEl, {
      backgroundColor: isLightTheme ? '#F6F5F2' : '#000000',
      scale: Math.min(4, Math.max(3, window.devicePixelRatio || 1)), // 3x+ so shared snapshots stay sharp on 4K screens
      useCORS: true,
      logging: false,
      // The capture button itself has no place in the shared image
      ignoreElements: el => el.tagName === 'BUTTON' && /snapshot/i.test(el.textContent || ''),
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight
    });
    
    // Trigger download
    const link = document.createElement('a');
    link.download = `${namePrefix}_mr_chartist_${new Date().toISOString().split('T')[0]}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    
    if(clone.parentNode === document.body) document.body.removeChild(clone);
    if(btn) btn.style.display = 'flex'; // restore
  } catch (err) {
    console.error("Export failed", err);
    (window.mcToast || alert)('Export failed. Please try again.');
  } finally {
    document.querySelectorAll('.terminal-panel > .mc-export-mark').forEach(n => n.remove());
    _root.style.zoom = _zoom;
  }
}

/* ── MAIN TAB LOGIC ── */
const ALL_PANELS = ['t-hero', 't-fno', 't-matrix', 't-sector', 't-docs', 't-ai'];

let isSwitchingTab = false;
function switchMainTab(id) {
  if (isSwitchingTab) return;
  const currentPanel = document.querySelector('.panel.active');
  const targetPanel = document.getElementById(id);
  if (currentPanel && currentPanel.id === id) return;
  
  isSwitchingTab = true;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  
  // Activate matching tab button immediately for snappy feel
  const matchingTab = document.querySelector(`.tab[data-tab="${id}"]`);
  if (matchingTab) matchingTab.classList.add('active');
  try { history.replaceState(null, '', id === 't-hero' ? location.pathname + location.search : '#' + id); } catch (e) {}

  const showTarget = () => {
    ALL_PANELS.forEach(pid => {
      const el = document.getElementById(pid);
      if (el) { el.style.display = 'none'; el.classList.remove('active', 'exiting'); }
    });
    
    if (targetPanel) {
      targetPanel.style.display = 'block';
      // Force reflow to restart animations
      void targetPanel.offsetWidth; 
      targetPanel.classList.add('active');
    }
    
    // Trigger chart re-renders
    if (id === 't-charts') {
      const activeHist = document.querySelector('.s-tab[id^="hc-m-"].active');
      const mode = activeHist ? activeHist.id.replace('hc-m-', '') : 'daily';
      if (typeof renderHistoryChart === 'function') setTimeout(() => renderHistoryChart(mode), 50);
    }
    if (id === 't-sector') {
      // Deep links, keyboard shortcuts and in-page buttons all land here, so
      // the tab must not depend on its caller to draw the board
      try { if (typeof renderSectors === 'function') renderSectors(); if (typeof renderSectorChart === 'function') renderSectorChart(); } catch (e) {}
    }
    if (id === 't-fno') {
      if (typeof renderFnoHistoryChart === 'function') setTimeout(() => renderFnoHistoryChart('fii-fut'), 50);
      if (typeof renderLsRatioChart === 'function') setTimeout(() => renderLsRatioChart(), 80);
    }
    isSwitchingTab = false;
  };

  if (currentPanel) {
    currentPanel.classList.remove('active');
    currentPanel.classList.add('exiting');
    // Wait for exit animation (250ms)
    setTimeout(showTarget, 250);
  } else {
    showTarget();
  }
}

/* ── SUB TAB LOGIC ── */
function switchSubTab(id) {
  // Sync chart rendering based on selected table timeframe
  const period = id.replace('s-', ''); // daily, weekly, monthly, yearly
  const chartMode = period === 'yearly' ? 'annual' : period;
  
  if (typeof switchHistoryChart === 'function') {
    switchHistoryChart(chartMode);
  }

  // Handle active class styling for tabs and panels
  const tabs = document.querySelectorAll('.sub-tabs .s-tab');
  tabs.forEach(t => t.classList.remove('active'));
  
  // Use event.target, or if called programmatically find the corresponding tab
  if (event && event.target && event.target.classList.contains('s-tab')) {
    event.target.classList.add('active');
  } else {
    document.getElementById(`tab-${chartMode === 'annual' ? 'yearly' : chartMode}`)?.classList.add('active');
  }
  
  document.querySelectorAll('.s-panel').forEach(p => p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

/* ── DATASETS ── */
let dailyData = []; // Populated dynamically on startup

/* Static seeds shown until live data loads — recomputeRollups() rebuilds all
   three from dailyData so the Weekly/Monthly/Annual views stay current */
let weeklyData = [
  { w:"Wk Mar 18*", fn:-16821, dn:21071 },
  { w:"Wk Mar 13", fn:-22905, dn:26097 }, { w:"Wk Mar 06", fn:-20399, dn:22099 },
  { w:"Wk Feb 27", fn:-18602, dn:22519 }, { w:"Wk Feb 20", fn:-11204, dn:16402 },
  { w:"Wk Feb 13", fn:+4201,  dn:-1202 },  { w:"Wk Feb 06", fn:-14201, dn:15003 },
  { w:"Wk Jan 30", fn:-28401, dn:32104 }, { w:"Wk Jan 23", fn:-31002, dn:35201 },
  { w:"Wk Jan 16", fn:-15201, dn:19402 }, { w:"Wk Jan 09", fn:-12770, dn:18602 },
];

let monthlyData = [
  { m:"Mar 2026*", fn:-46646,  dn:36462,  nc:"-2.8%", np:22199 },
  { m:"Feb 2026",  fn:-12240,  dn:57471,  nc:"+1.2%", np:22920 },
  { m:"Jan 2026",  fn:-87374,  dn:105309, nc:"-3.4%", np:23163 },
  { m:"Dec 2025",  fn:-21402,  dn:38401,  nc:"+4.1%", np:23644 },
  { m:"Nov 2025",  fn:-42101,  dn:51201,  nc:"-1.2%", np:24131 },
  { m:"Oct 2025",  fn:-114402, dn:121002, nc:"-6.2%", np:24205 },
  { m:"Sep 2025",  fn:+15401,  dn:35201,  nc:"+3.2%", np:25810 },
  { m:"Aug 2025",  fn:-18402,  dn:48201,  nc:"+1.4%", np:25235 },
  { m:"Jul 2025",  fn:-12401,  dn:52101,  nc:"+4.5%", np:24951 },
  { m:"Jun 2025",  fn:+26501,  dn:20102,  nc:"+6.6%", np:24010 },
  { m:"May 2025",  fn:-42101,  dn:68402,  nc:"-0.3%", np:24667 },
  { m:"Apr 2025",  fn:-34201,  dn:45201,  nc:"+1.2%", np:24039 },
];

let yearlyData = [
  { y:"2026*", fn:-112414, dn:186649 }, { y:"2025",  fn:-306419, dn:788184 },
  { y:"2024",  fn:-304217, dn:527438 }, { y:"2023",  fn:-16325,  dn:181482 },
  { y:"2022",  fn:-278429, dn:275726 }, { y:"2021",  fn:-91626,  dn:94846  },
  { y:"2020",  fn:+170262, dn:-47000 }, { y:"2019",  fn:+101122, dn:-18358 },
  { y:"2018",  fn:-33014,  dn:109590 }, { y:"2017",  fn:+51252,  dn:56242  },
  { y:"2016",  fn:-14172,  dn:55703  }, { y:"2015",  fn:+17806,  dn:14296  },
  { y:"2014",  fn:+97054,  dn:-49750 }, { y:"2013",  fn:+113135, dn:-74000 }
];

/* ── DOM RENDER UTILS ── */
function fC(v) { return (v>0?'pos':'neg'); }
// Net-only sessions (d.p): the archives publish net but not gross buy/sell — show "—", never a fake 0
const NA_CELL = '<td colspan="2" class="na-gross" title="Gross buy/sell was not published for this session; net figures are verified against independent archives">—</td>';
function fmt(v) { return (v>0?'+':(v<0?'-':'')) + '₹' + Math.abs(v).toLocaleString('en-IN') + ' Cr'; }
/* Escape untrusted strings (LLM output, scraped sector names, API errors)
   before they reach an innerHTML sink */
function escapeHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function getBar(v, max) { 
  const p = Math.min(100, Math.abs(v)/max*100); 
  return `<div class="td-bar-wrap"><div class="td-bar" style="width:${p}%; background:${v>0?'var(--green)':'var(--red)'}"></div></div>`; 
}

// 1. Heatmap calculate utility
function getHeatClass(val, max) {
  let r = Math.abs(val) / max;
  if(val < 0) {
    if(r > 0.8) return 'c-r4';
    if(r > 0.6) return 'c-r3';
    if(r > 0.3) return 'c-r2';
    return 'c-r1';
  } else {
    if(r > 0.8) return 'c-g4';
    if(r > 0.6) return 'c-g3';
    if(r > 0.3) return 'c-g2';
    return 'c-g1';
  }
}

// 2. Render Utilities for Matrices & Heatmaps
function renderHeatmaps() {
  const fHeat = document.getElementById('fii-heatmap');
  const dHeat = document.getElementById('dii-heatmap');
  if(!fHeat || !dHeat) return;
  const maxF = 15000, maxD = 10000;
  
  fHeat.innerHTML = dailyData.slice(0, 45).map(d => {
    return `<div class="cal-cell ${getHeatClass(d.fn, maxF)}" data-tip="${d.d}: ${fmt(d.fn)}"></div>`;
  }).reverse().join('');
  dHeat.innerHTML = dailyData.slice(0, 45).map(d => {
    return `<div class="cal-cell ${getHeatClass(d.dn, maxD)}" data-tip="${d.d}: ${fmt(d.dn)}"></div>`;
  }).reverse().join('');

  // Also render 3D isometric view
  renderIsoMatrix3D();
}

// 3D Isometric Flow Matrix Renderer
function renderIsoMatrix3D() {
  try {
    const fiiGrid = document.getElementById('fii-iso-grid');
    const diiGrid = document.getElementById('dii-iso-grid');
    if (!fiiGrid || !diiGrid) { console.warn('[ISO] Grid elements not found'); return; }
    if (!dailyData || !dailyData.length) { console.warn('[ISO] No daily data'); return; }

    const data45 = dailyData.slice(0, 45).slice().reverse(); // oldest → newest (left to right)
    const maxF = Math.max(1, ...data45.map(d => Math.abs(d.fn || 0)));
    const maxD = Math.max(1, ...data45.map(d => Math.abs(d.dn || 0)));
    const MAX_H = 85; // max bar height in px (grid is 90px)

    function isoClass(val) {
      if (!val || val === 0) return 'iso-flat';
      const abs = Math.abs(val);
      const prefix = val < 0 ? 'iso-r' : 'iso-g';
      const maxV = val < 0 ? maxF : maxD;
      const r = abs / maxV;
      if (r > 0.75) return prefix + '4';
      if (r > 0.50) return prefix + '3';
      if (r > 0.25) return prefix + '2';
      return prefix + '1';
    }

    function barH(val, maxV) {
      if (!val) return 2;
      return Math.max(2, Math.round((Math.abs(val) / maxV) * MAX_H));
    }

    function buildGrid(el, data, maxV, key) {
      el.innerHTML = data.map((d, i) => {
        const v = d[key] || 0;
        const cls = isoClass(v);
        const h = barH(v, maxV);
        const delay = (i * 0.015).toFixed(3);
        const tip = d.d + ': ' + fmt(v); // fmt() already prefixes the sign
        return '<div class="iso-bar-wrap"><div class="iso-bar ' + cls + '" style="height:' + h + 'px;animation-delay:' + delay + 's" title="' + tip + '"><span class="iso-tip">' + tip + '</span></div></div>';
      }).join('');
    }

    buildGrid(fiiGrid, data45, maxF, 'fn');
    buildGrid(diiGrid, data45, maxD, 'dn');
    console.log('[ISO] ✅ Rendered 3D matrix:', data45.length, 'bars, maxFII:', maxF, 'maxDII:', maxD);
  } catch (e) {
    console.error('[ISO] Render error:', e);
  }
}
function initTables() {
  const fBtn = document.getElementById('fBtn-all');
  if (fBtn) filterDaily('all', fBtn);
  
  const wHtml = weeklyData.map(d => {
    const liq = d.fn + d.dn;
    let sigStr = '';
    if (d.fn > 0 && d.dn > 0) sigStr = ' Both Buying';
    else if (d.fn < 0 && d.dn < 0) sigStr = ' Heavy Distribution';
    else if (d.fn < 0 && d.dn > 0) sigStr = '⚡ FII Outflow / DII Absorbing';
    else sigStr = ' Mixed Bias';
    return `<tr><td>${d.w}</td><td class="${fC(d.fn)}">${fmt(d.fn)}</td><td class="${fC(d.dn)}">${fmt(d.dn)}</td><td class="${fC(liq)}">${fmt(liq)}</td><td style="opacity:0.8">${sigStr}</td></tr>`;
  }).join('');
  const tbW = document.getElementById('tbWeekly');
  if (tbW) tbW.innerHTML = wHtml;

  const mHtml = monthlyData.map(d => {
    const printer = d.fn + d.dn;
    const ncClass = d.nc.includes('-') ? 't-red' : 't-green';
    return `<tr><td>${d.m}</td><td class="${fC(d.fn)}">${fmt(d.fn)}</td><td class="${fC(d.dn)}">${fmt(d.dn)}</td><td class="${fC(printer)}">${fmt(printer)}</td><td><span class="${ncClass}">${d.nc}</span></td></tr>`;
  }).join('');
  const tbM = document.getElementById('tbMonthly');
  if (tbM) tbM.innerHTML = mHtml;

  const yHtml = yearlyData.map(d => {
    const tFlow = d.fn + d.dn;
    let mult = '—';
    if(d.fn < 0 && d.dn > 0) mult = Math.abs(d.dn/d.fn).toFixed(1) + 'x Absorbed';
    else if (d.fn > 0 && d.dn > 0) mult = 'Synchronized Accumulation';
    return `<tr><td>${d.y}</td><td class="${fC(d.fn)}">${fmt(d.fn)}</td><td class="${fC(d.dn)}">${fmt(d.dn)}</td><td class="${fC(tFlow)}">${fmt(tFlow)}</td><td style="opacity:0.8">${mult}</td></tr>`;
  }).join('');
  const tbY = document.getElementById('tbYearly');
  if (tbY) tbY.innerHTML = yHtml;
}

const clr = (v) => v>0 ? 't-green' : 't-red';

/* ── NSE DATE PARSER: handles "16-Mar-2026" cross-browser ── */
function parseNSEDate(str) {
  const M = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
  const p = (str || '').split('-');
  if (p.length === 3 && M[p[1]] !== undefined)
    return new Date(parseInt(p[2]), M[p[1]], parseInt(p[0]));
  return null;
}

/* ── Live rollups ──
   Rebuild the Weekly / Monthly / Annual aggregates from dailyData so the
   tables and chart modes track the live feed instead of the static seeds
   (which were frozen at their hand-entry date). Months/years only partially
   covered by the loaded history keep their seeded values where available. */
const _seedMonthly = monthlyData.slice();
function recomputeRollups() {
  if (!dailyData.length || dailyData[0].d === 'N/A') return;
  const MN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const rows = [];
  dailyData.forEach(r => {
    const dt = parseNSEDate(r.d);
    if (dt) rows.push({ dt, fn: r.fn || 0, dn: r.dn || 0 });
  });
  if (!rows.length) return;
  rows.sort((a, b) => a.dt - b.dt);
  const oldest = rows[0].dt, newest = rows[rows.length - 1].dt;

  // Weekly — last 12 weeks, keyed by week-start Monday, labeled by week's last session
  const weeks = new Map();
  rows.forEach(r => {
    const monday = new Date(r.dt);
    monday.setDate(r.dt.getDate() - ((r.dt.getDay() + 6) % 7));
    const key = monday.getTime();
    const w = weeks.get(key) || { end: r.dt, fn: 0, dn: 0 };
    w.fn += r.fn; w.dn += r.dn;
    if (r.dt > w.end) w.end = r.dt;
    weeks.set(key, w);
  });
  weeklyData = [...weeks.entries()].sort((a, b) => b[0] - a[0]).slice(0, 12)
    .map(([, w], i) => ({
      w: `Wk ${MN[w.end.getMonth()]} ${String(w.end.getDate()).padStart(2, '0')}${i === 0 ? '*' : ''}`,
      fn: Math.round(w.fn), dn: Math.round(w.dn)
    }));

  // Monthly — computed where history covers the month; Nifty change/level (nc/np)
  // and months older than the loaded history come from the static seed
  const months = new Map();
  rows.forEach(r => {
    const key = r.dt.getFullYear() * 100 + r.dt.getMonth();
    const m = months.get(key) || { y: r.dt.getFullYear(), mo: r.dt.getMonth(), fn: 0, dn: 0 };
    m.fn += r.fn; m.dn += r.dn;
    months.set(key, m);
  });
  const moArr = [...months.entries()].sort((a, b) => b[0] - a[0]);
  const curMoKey = moArr[0][0];
  const computedMonths = moArr.map(([key, m]) => {
    const label = `${MN[m.mo]} ${m.y}`;
    const seed = _seedMonthly.find(s => s.m.replace('*', '') === label);
    const fullyCovered = m.y > oldest.getFullYear() ||
      (m.y === oldest.getFullYear() && (m.mo > oldest.getMonth() || oldest.getDate() <= 3));
    if (!fullyCovered && seed) return { ...seed, m: label + (key === curMoKey ? '*' : '') };
    return {
      m: label + (key === curMoKey ? '*' : ''),
      fn: Math.round(m.fn), dn: Math.round(m.dn),
      nc: seed ? seed.nc : '—', np: seed ? seed.np : null
    };
  });
  const computedLabels = new Set(computedMonths.map(x => x.m.replace('*', '')));
  monthlyData = [...computedMonths, ..._seedMonthly.filter(s => !computedLabels.has(s.m.replace('*', '')))].slice(0, 24);

  // Annual — recompute the current (partial, '*') year from live data;
  // completed historical years keep their static records
  const curYear = newest.getFullYear();
  let fnY = 0, dnY = 0;
  rows.forEach(r => { if (r.dt.getFullYear() === curYear) { fnY += r.fn; dnY += r.dn; } });
  const yRow = { y: `${curYear}*`, fn: Math.round(fnY), dn: Math.round(dnY) };
  const yIdx = yearlyData.findIndex(x => String(x.y).replace('*', '') === String(curYear));
  if (yIdx >= 0) yearlyData[yIdx] = yRow; else yearlyData.unshift(yRow);
}

/* ── 30-session signal replay strip (hero) ──
   Quadrant classification per session: both buying / DII absorbing FII selling /
   FII buying alone / both selling. */
function renderSignalTimeline() {
  const el = document.getElementById('signal-timeline');
  if (!el || !dailyData.length || dailyData[0].d === 'N/A') return;
  const sessions = dailyData.slice(0, 30).reverse(); // oldest → newest
  el.innerHTML = sessions.map(s => {
    let cls, label;
    if (s.fn >= 0 && s.dn >= 0)      { cls = 'sig-q-bull';    label = 'Both buying'; }
    else if (s.fn < 0 && s.dn >= 0)  { cls = 'sig-q-absorb';  label = 'DII absorbing FII selling'; }
    else if (s.fn >= 0 && s.dn < 0)  { cls = 'sig-q-fiionly'; label = 'FII buying, DII selling'; }
    else                             { cls = 'sig-q-bear';    label = 'Both selling'; }
    const i = dailyData.indexOf(s);
    const gap = gapAfter(i) ? `<div class="sig-gap" title="Sessions between ${escapeHtml(dailyData[i + 1].d)} and ${escapeHtml(s.d)} are missing from the archive"></div>` : '';
    return `${gap}<div class="sig-dot ${cls}" title="${escapeHtml(s.d)} — ${label} · FII ${fmt(s.fn)} · DII ${fmt(s.dn)}"></div>`;
  }).join('');
}

/* Open a session from the home table inside Flow Analytics, expanded */
function openSession(dateStr) {
  switchMainTab('t-matrix');
  setTimeout(() => {
    try {
      clearDateRange();
      const allBtn = document.getElementById('fBtn-all');
      filterDaily('all', allBtn);
      const idx = paginatedFilteredData.findIndex(r => r.d === dateStr);
      if (idx < 0) return;
      currPageDaily = Math.floor(idx / pageSizeDaily) + 1;
      renderDailyTable();
      toggleRowDetail(idx);
      const row = document.querySelector(`tr[data-row-idx="${idx}"]`);
      if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (e) { /* navigation only */ }
  }, 320);
}

/* ── Sticky KPI strip — headline numbers follow the user down the page ── */
let _stickyKpiWired = false;
/* Flow island: latest session in a floating capsule at the bottom (desktop). Shows after the hero scrolls away,
   tucks away while the footer is on screen, and jumps back to the cash-flow tape on click. */
function renderStickyKpi() {
  const el = document.getElementById('stickyKpi');
  if (!el || !dailyData.length || dailyData[0].d === 'N/A') return;
  const d = dailyData[0];
  const clr = v => v >= 0 ? 'var(--green)' : 'var(--red)';
  const fresh = (window.MCFresh && MCFresh.assess(d.d)) || { status: 'fresh' };
  el.innerHTML =
    `<span class="sk-dot ${fresh.status === 'fresh' ? '' : fresh.status}" title="${fresh.status === 'fresh' ? 'Up to date' : 'Data is ' + (fresh.behind || 0) + ' session(s) behind'}"></span>` +
    `<span class="sk-item">${escapeHtml(d.d)}</span>` +
    `<span class="sk-item">FII <b style="color:${clr(d.fn)}">${fmt(d.fn)}</b></span>` +
    `<span class="sk-item">DII <b style="color:${clr(d.dn)}">${fmt(d.dn)}</b></span>` +
    `<span class="sk-item">Net <b style="color:${clr(d.fn + d.dn)}">${fmt(d.fn + d.dn)}</b></span>` +
    `<span class="sk-up" aria-hidden="true"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg></span>`;
  if (!_stickyKpiWired) {
    _stickyKpiWired = true;
    el.setAttribute('role', 'button'); el.setAttribute('tabindex', '0'); el.setAttribute('aria-label', 'Latest session — back to top');
    el.removeAttribute('aria-hidden');
    const top = () => window.scrollTo({ top: 0, behavior: 'smooth' });
    el.addEventListener('click', top);
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); top(); } });
    window.addEventListener('scroll', () => { el.classList.toggle('visible', window.scrollY > 480); }, { passive: true });
    const foot = document.querySelector('.os-footer');
    if (foot && 'IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => el.classList.toggle('tucked', e.isIntersecting), { threshold: 0.05 }).observe(foot);
    }
  }
}

/* ── NSE bulk/block deals panel (Flow Analytics tab) ── */
let _dealsLoaded = false;
async function loadLargeDeals() {
  if (_dealsLoaded) return;
  try {
    const res = await fetch('/api/large-deals');
    if (!res.ok) return; // NSE blocking or no data — keep panel hidden
    const data = await res.json();
    const rows = [
      ...(data.bulk || []).map(d => ({ ...d, type: 'Bulk' })),
      ...(data.block || []).map(d => ({ ...d, type: 'Block' }))
    ].filter(d => d.symbol);
    if (!rows.length) return;
    rows.sort((a, b) => (b.qty * b.price) - (a.qty * a.price));
    const body = document.getElementById('tbLargeDeals');
    body.innerHTML = rows.slice(0, 12).map(d => {
      const buy = /b/i.test(d.side);
      return `<tr>
        <td><span class="signal-pill ${d.type === 'Block' ? 'sig-neutral' : 'sig-bull'}" style="text-transform:none;">${d.type}</span></td>
        <td style="font-weight:700; color:var(--t1);">${escapeHtml(d.symbol)}</td>
        <td style="color:var(--t3); max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(d.client)}">${escapeHtml(d.client)}</td>
        <td class="${buy ? 'pos' : 'neg'}" style="font-weight:800;">${buy ? '▲ BUY' : '▼ SELL'}</td>
        <td style="font-variant-numeric:tabular-nums;">${Number(d.qty || 0).toLocaleString('en-IN')}</td>
        <td style="font-variant-numeric:tabular-nums;">₹${Number(d.price || 0).toLocaleString('en-IN')}</td>
      </tr>`;
    }).join('');
    const dt = document.getElementById('ld-date');
    if (dt && data.as_on) dt.textContent = data.as_on;
    document.getElementById('large-deals-card').style.display = 'block';
    _dealsLoaded = true;
  } catch { /* keep hidden */ }
}

/* ── NSDL custodian-confirmed figure next to the provisional NSE number ── */
async function loadNsdlConfirm() {
  try {
    const res = await fetch('/api/fpi-daily');
    if (!res.ok) return;
    const data = await res.json();
    const row = (data.rows || [])[0] || data.latest;
    if (!row || !row.date || row.equity_net == null) return;
    const el = document.getElementById('nsdlConfirm');
    if (!el) return;
    const v = row.equity_net;
    // A months-old confirmation next to today's number reads as if it confirmed it
    if (window.MCFresh && dailyData.length && Math.abs(MCFresh.daysApart(dailyData[0].d, row.date)) > 6) return;
    el.innerHTML = `🏛️ NSDL custodian-confirmed (reported ${escapeHtml(row.date)}): FPI equity net <b style="color:${v >= 0 ? 'var(--green)' : 'var(--red)'}">${fmt(v)}</b> · <span class="gloss" data-tip="Depository-settled figures from NSDL. They lag the provisional exchange numbers by a day but are the confirmed record, and include flows NSE cash data misses.">why this differs</span>`;
    el.style.display = 'block';
  } catch { /* keep hidden */ }
}

/* Today in context: 20-session average, rank of today's move, month- and year-to-date totals */
function renderFlowContext(latest) {
  try {
    const real = dailyData.filter(d => d.d !== 'N/A');
    if (!real.length) return;
    const last20 = real.slice(0, 20);
    const avg = (arr, k) => arr.reduce((a, d) => a + (d[k] || 0), 0) / arr.length;
    const rankLine = (k, v) => {
      let n = 0;
      for (let i = 1; i < real.length; i++) { if (v < 0 ? real[i][k] <= v : real[i][k] >= v) break; n++; }
      const word = v < 0 ? 'selling' : 'buying';
      return n >= 5 ? ` · ${n === real.length - 1 ? 'heaviest' : 'heaviest'} ${word} in ${n + 1} sessions` : '';
    };
    const ctx = (id, k, v) => {
      const el = document.getElementById(id); if (!el) return;
      const a = avg(last20, k);
      el.innerHTML = `<span class="mc-ctx-k">20-session avg</span> <b class="${a >= 0 ? 't-green' : 't-red'}">${fmt(Math.round(a))}</b>${escapeHtml(rankLine(k, v))}`;
    };
    ctx('lFiiCtx', 'fn', latest.fn); ctx('lDiiCtx', 'dn', latest.dn);
    const ld = parseNSEDate(latest.d); if (!ld) return;
    const inMonth = real.filter(d => { const t = parseNSEDate(d.d); return t && t.getFullYear() === ld.getFullYear() && t.getMonth() === ld.getMonth(); });
    const inYear = real.filter(d => { const t = parseNSEDate(d.d); return t && t.getFullYear() === ld.getFullYear(); });
    const sum = (arr, k) => arr.reduce((a, d) => a + (d[k] || 0), 0);
    const put = (id, v, n) => { const el = document.getElementById(id); if (!el) return; el.textContent = fmt(Math.round(v)); el.className = v >= 0 ? 't-green' : 't-red'; el.title = `${n} sessions`; };
    put('mtdFii', sum(inMonth, 'fn'), inMonth.length); put('mtdDii', sum(inMonth, 'dn'), inMonth.length);
    put('ytdFii', sum(inYear, 'fn'), inYear.length); put('ytdDii', sum(inYear, 'dn'), inYear.length);
    const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][ld.getMonth()];
    const lab = document.querySelectorAll('#mcPeriods span');
    if (lab[0]) lab[0].textContent = `FII ${mon} to date`; if (lab[1]) lab[1].textContent = `DII ${mon} to date`;
    if (lab[2]) lab[2].textContent = `FII ${ld.getFullYear()} to date`; if (lab[3]) lab[3].textContent = `DII ${ld.getFullYear()} to date`;
  } catch (e) { /* context is optional */ }
}

/* ── Data freshness ──
   Says plainly when the feed has fallen behind, instead of showing "Live"
   next to weeks-old figures. */
function applyFreshness() {
  if (!window.MCFresh || !dailyData.length || dailyData[0].d === 'N/A') return;
  const f = MCFresh.assess(dailyData[0].d);
  document.documentElement.setAttribute('data-feed', f.status);
  const pill = document.getElementById('sPill');
  if (pill) pill.setAttribute('data-feed', f.status);
  const bar = document.getElementById('mcStale');
  if (bar) {
    if (f.status === 'stale') {
      const when = f.latest.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
      bar.innerHTML = `<b>Data feed delayed.</b> The latest session here is <b>${escapeHtml(when)}</b>, about ${f.behind} trading sessions behind. The figures below describe that day, not the current market.`;
      bar.hidden = false;
    } else { bar.hidden = true; }
  }
  // "Provisional" only applies to the freshly published evening figures
  const provChip = document.getElementById('provChip');
  if (provChip) provChip.style.display = f.behind <= 1 ? 'inline-block' : 'none';
}

/* Sessions that follow a hole in the archive (more than a long weekend).
   Streaks must not be counted across them. */
function gapAfter(i) {
  return !!(window.MCFresh && dailyData[i] && dailyData[i + 1] && MCFresh.isGap(dailyData[i].d, dailyData[i + 1].d));
}

/* How far F&O trails the newest cash session. NSE normally publishes it a few
   hours later; anything beyond a couple of sessions is stale, not "pending". */
function fnoLag(latestFno) {
  const idx = dailyData.indexOf(latestFno);
  return idx < 0 ? 0 : idx;
}

function renderDashboard() {
  recomputeRollups();
  renderSignalTimeline();
  renderStickyKpi();
  applyFreshness();
  const latest = dailyData[0];

  // Calculate Flow Streak
  let streakCount = 1;
  let sType = latest.fn > 0 ? 'buy' : 'sell';
  let sVol = latest.fn;
  for(let i=1; i<dailyData.length; i++) {
     if (gapAfter(i - 1)) break; // missing sessions — the run cannot be verified past here
     if(sType === 'sell' && dailyData[i].fn < 0) { streakCount++; sVol += dailyData[i].fn; }
     else if(sType === 'buy' && dailyData[i].fn > 0) { streakCount++; sVol += dailyData[i].fn; }
     else break;
  }
  
  const stDot = document.getElementById('streak-dot');
  const stBorder = document.getElementById('streak-border');
  const stVal = document.getElementById('streak-val');
  const stVol = document.getElementById('streak-vol');
  
  if (stVal) {
    const stColor = sType === 'sell' ? 'var(--red)' : 'var(--green)';
    stDot.style.background = stColor;
    stDot.style.boxShadow = `0 0 8px ${stColor}`;
    stBorder.style.background = `linear-gradient(90deg, ${stColor}, var(--bg), ${stColor})`;
    stBorder.style.backgroundSize = '200% 200%';
    stVal.innerText = `${streakCount} Day${streakCount > 1 ? 's' : ''} ${sType === 'sell' ? 'Selling' : 'Buying'}`;
    stVal.style.color = stColor;
    stVol.innerText = fmt(sVol);
    stVol.style.color = stColor;
  }

  // ── DII Streak ──────────────────────────────────────────────────────────────
  let diiStreakCount = 1;
  let diiSType = latest.dn > 0 ? 'buy' : 'sell';
  let diiSVol = latest.dn;
  for (let i = 1; i < dailyData.length; i++) {
    if (gapAfter(i - 1)) break;
    if (diiSType === 'sell' && dailyData[i].dn < 0) { diiStreakCount++; diiSVol += dailyData[i].dn; }
    else if (diiSType === 'buy' && dailyData[i].dn > 0) { diiStreakCount++; diiSVol += dailyData[i].dn; }
    else break;
  }
  const diiStDot    = document.getElementById('dii-streak-dot');
  const diiStBorder = document.getElementById('dii-streak-border');
  const diiStVal    = document.getElementById('dii-streak-val');
  const diiStVol    = document.getElementById('dii-streak-vol');
  if (diiStVal) {
    const diiColor = diiSType === 'sell' ? 'var(--red)' : 'var(--green)';
    diiStDot.style.background = diiColor;
    diiStDot.style.boxShadow = `0 0 8px ${diiColor}`;
    diiStBorder.style.background = `linear-gradient(90deg, ${diiColor}, var(--bg), ${diiColor})`;
    diiStBorder.style.backgroundSize = '200% 200%';
    diiStVal.innerText = `${diiStreakCount} Day${diiStreakCount > 1 ? 's' : ''} ${diiSType === 'sell' ? 'Selling' : 'Buying'}`;
    diiStVal.style.color = diiColor;
    diiStVol.innerText = fmt(diiSVol);
    diiStVol.style.color = diiColor;
  }


  const setLatestMetric = (id, value, terminalClass, legacyClass) => {
    const target = document.getElementById(id);
    if (!target) return;
    target.innerText = fmt(value);
    target.className = `${target.closest('.terminal-shell') ? terminalClass : legacyClass} ${clr(value)}`;
  };
  setLatestMetric('lFii', latest.fn, 'terminal-value', 'num-xl');
  setLatestMetric('lDii', latest.dn, 'terminal-value terminal-value-sm', 'num-l');
  renderFlowContext(latest);
  document.documentElement.removeAttribute('data-loading');

  // Phase 8: Dynamic hero card accent border
  const heroCard = document.getElementById('hero-card');
  if (heroCard) {
    heroCard.classList.remove('hero-bull', 'hero-bear');
    heroCard.classList.add(latest.fn >= 0 ? 'hero-bull' : 'hero-bear');
  }

  
  const net = latest.fn + latest.dn;
  setLatestMetric('lNet', net, 'terminal-value terminal-value-sm', 'num-s');
  
  const dt = parseNSEDate(latest.d);
  let dtStr = dt ? dt.toLocaleDateString('en-GB', {weekday:'long', day:'numeric', month:'long', year:'numeric'}) : latest.d;
  document.getElementById('lDate').innerText = dtStr;

  // ── Dynamic Momentum Badge ──────────────────────────────────────────────────
  const badge = document.getElementById('heroBadge');
  if (badge) {
    const fn = latest.fn;
    let label, cls;
    let tone, tip;
    if      (fn <= -10000) { label = 'Bearish: Heavy FII Selling'; cls = 'mb-bear'; tone = 'bear'; tip = 'FII net selling above ₹10,000 Cr in a day = Bearish for Indian equities'; }
    else if (fn <=  -3000) { label = 'Bearish: FII Net Selling'; cls = 'mb-bear'; tone = 'bear'; tip = 'FII net selling = Bearish for Indian equities'; }
    else if (fn <    3000) { label = 'Neutral: Balanced Flows'; cls = 'mb-neut'; tone = 'neutral'; tip = 'FII flows are small either way = Neutral'; }
    else if (fn <   10000) { label = 'Bullish: FII Net Buying'; cls = 'mb-bull'; tone = 'bull'; tip = 'FII net buying = Bullish for Indian equities'; }
    else                   { label = 'Bullish: Heavy FII Buying'; cls = 'mb-bull'; tone = 'bull'; tip = 'FII net buying above ₹10,000 Cr in a day = Bullish for Indian equities'; }
    badge.className = `mom-badge os-badge ${tone} ${cls}`;
    badge.title = tip;
    badge.innerHTML = `<i class="os-dot"></i>${label}`;
    // Market Mood summary
    const mood = document.getElementById('osMood');
    if (mood) {
      const mb = document.getElementById('osMoodBadge'), mt = document.getElementById('osMoodText');
      const word = tone === 'bull' ? 'Bullish' : tone === 'bear' ? 'Bearish' : 'Neutral';
      mood.className = `os-mood os-${tone}`;
      mood.title = tip;
      mb.className = `os-badge ${tone} lg`;
      mb.innerHTML = `<i class="os-dot"></i>${word}`;
      const vb = v => v >= 0 ? 'bought' : 'sold';
      const dNote = latest.dn >= 0 ? (latest.fn < 0 ? ', DII support' : '') : (latest.fn < 0 ? ', DIIs also selling' : '');
      mt.innerHTML = `<strong>Market Mood:</strong> FIIs ${vb(latest.fn)} ₹${Math.abs(Math.round(latest.fn)).toLocaleString('en-IN')} Cr while DIIs ${vb(latest.dn)} ₹${Math.abs(Math.round(latest.dn)).toLocaleString('en-IN')} Cr. ${word} for FIIs${dNote}.`;
    }
  }

  // ── Liquidity Drain / Injection Label ──────────────────────────────────────
  const liqLbl = document.getElementById('liqLabel');
  if (liqLbl) liqLbl.innerText = net < 0 ? 'Combined Liquidity Drain' : 'Net Liquidity Injection';

  // ── 5-Day FII Velocity ─────────────────────────────────────────────────────
  const last5 = dailyData.slice(0, 5);
  const vel5  = last5.reduce((s, d) => s + d.fn, 0);
  const avg5  = Math.round(vel5 / last5.length);
  const vel5El   = document.getElementById('vel5d');
  const vel5Desc = document.getElementById('vel5dDesc');
  if (vel5El)   { vel5El.innerText = fmt(vel5); vel5El.className = `num-m ${clr(vel5)}`; }
  if (vel5Desc) {
    const side = avg5 < 0 ? 'selling' : 'buying';
    vel5Desc.innerHTML = `Avg daily ${side}: <strong>${fmt(avg5)}/day</strong> over the last ${last5.length} sessions.`;
  }

  // Render Flow Strength Meter
// Wait 2 seconds for JS execution before doing the rest
  // ── Render F&O Data ────────────────────────────────────────────────────────
  // NSE publishes participant-OI later than cash, so the newest session can have
  // cash but all-zero F&O. Show the most recent session that actually HAS F&O
  // rather than a misleading all-zeros panel.
  const _hasRealFno = d => d && ((d.fii_idx_fut_long || 0) !== 0 || (d.fii_idx_fut_short || 0) !== 0);
  const latestFno = dailyData.find(_hasRealFno) || latest;
  const fnoIsStale = latestFno && latest && latestFno.d !== latest.d;

  if (_hasRealFno(latestFno)) {
    const fnl = n => n ? n.toLocaleString('en-IN') : '0';
    const fillRatio = (l, s, bar, reverseColor = false) => {
      document.getElementById(bar).style.width = (l+s > 0) ? `${(l/(l+s))*100}%` : '50%';
    };
    
    // FII
    document.getElementById('fiiFutL').innerText = fnl(latestFno.fii_idx_fut_long);
    document.getElementById('fiiFutS').innerText = fnl(latestFno.fii_idx_fut_short);
    fillRatio(latestFno.fii_idx_fut_long, latestFno.fii_idx_fut_short, 'barFiiFut');

    if (document.getElementById('fiiStkFutL')) {
      document.getElementById('fiiStkFutL').innerText = fnl(latestFno.fii_stk_fut_long);
      document.getElementById('fiiStkFutS').innerText = fnl(latestFno.fii_stk_fut_short);
      fillRatio(latestFno.fii_stk_fut_long, latestFno.fii_stk_fut_short, 'barFiiStkFut');
    }

    document.getElementById('fiiCallL').innerText = fnl(latestFno.fii_idx_call_long);
    document.getElementById('fiiCallS').innerText = fnl(latestFno.fii_idx_call_short);
    fillRatio(latestFno.fii_idx_call_long, latestFno.fii_idx_call_short, 'barFiiCall');

    document.getElementById('fiiPutL').innerText = fnl(latestFno.fii_idx_put_long);
    document.getElementById('fiiPutS').innerText = fnl(latestFno.fii_idx_put_short);
    fillRatio(latestFno.fii_idx_put_long, latestFno.fii_idx_put_short, 'barFiiPut', true); // Put long = Bearish

    // DII
    document.getElementById('diiFutL').innerText = fnl(latestFno.dii_idx_fut_long);
    document.getElementById('diiFutS').innerText = fnl(latestFno.dii_idx_fut_short);
    fillRatio(latestFno.dii_idx_fut_long, latestFno.dii_idx_fut_short, 'barDiiFut');

    if (document.getElementById('diiStkFutL')) {
      document.getElementById('diiStkFutL').innerText = fnl(latestFno.dii_stk_fut_long);
      document.getElementById('diiStkFutS').innerText = fnl(latestFno.dii_stk_fut_short);
      fillRatio(latestFno.dii_stk_fut_long, latestFno.dii_stk_fut_short, 'barDiiStkFut');
    }

    // Sentiment heuristic
    const futNet = latestFno.fii_idx_fut_long - latestFno.fii_idx_fut_short;
    const callNet = latestFno.fii_idx_call_long - latestFno.fii_idx_call_short;
    const putNet = latestFno.fii_idx_put_long - latestFno.fii_idx_put_short;
    let score = 0;
    if (futNet > 10000) score++; if (futNet < -10000) score--;
    if (callNet > 50000) score++; if (callNet < -50000) score--;
    if (putNet > 50000) score--; if (putNet < -50000) score++; // Long Puts = Bearish
    
    const sBadge = document.getElementById('faoSentiment');
    const _fsT = 'Based on FII index futures, call and put positions. Net long futures/calls = Bullish; net long puts = Bearish.';
    sBadge.title = _fsT;
    if (score >= 2) { sBadge.innerHTML = '<i class="os-dot"></i>Bullish: Strong'; sBadge.className = 'mom-badge os-badge bull mb-bull'; }
    else if (score == 1) { sBadge.innerHTML = '<i class="os-dot"></i>Bullish: Mild'; sBadge.className = 'mom-badge os-badge bull mb-bull'; }
    else if (score == 0) { sBadge.innerHTML = '<i class="os-dot"></i>Neutral'; sBadge.className = 'mom-badge os-badge neutral mb-neut'; }
    else if (score == -1) { sBadge.innerHTML = '<i class="os-dot"></i>Bearish: Mild'; sBadge.className = 'mom-badge os-badge bear mb-bear'; }
    else { sBadge.innerHTML = '<i class="os-dot"></i>Bearish: Strong'; sBadge.className = 'mom-badge os-badge bear mb-bear'; }

    // Date Update for F&O Header
    const fnoDt = parseNSEDate(latestFno.d);
    let fnoDtStr = fnoDt ? fnoDt.toLocaleDateString('en-GB', {weekday:'long', day:'numeric', month:'long', year:'numeric'}) : latestFno.d;
    const _lag = fnoLag(latestFno);
    document.getElementById('fnoDate').innerText = !fnoIsStale
      ? `Data for: ${fnoDtStr}`
      : _lag <= 2
        ? `Data for: ${fnoDtStr} · F&O for ${latest.d} pending (NSE publishes it later)`
        : `Stale: last F&O is ${fnoDtStr}, ${_lag} sessions behind cash`;
    sBadge.classList.toggle('is-stale', _lag > 2);
    if (_lag > 2) sBadge.title = `Positioning as of ${latestFno.d} — ${_lag} sessions old. ` + _fsT;

    // F&O Historical Chart
    if (typeof renderFnoHistoryChart === 'function') {
      renderFnoHistoryChart();
    }
  } else {
    // No F&O anywhere in the loaded history
    const fnoDateEl = document.getElementById('fnoDate');
    if (fnoDateEl) fnoDateEl.innerText = 'F&O positioning data not available yet';
  }

  const fNetAbs = Math.abs(latest.fn);
  const dNetAbs = Math.abs(latest.dn);
  const totalFlow = fNetAbs + dNetAbs;
  if(totalFlow > 0) {
    const pF = Math.round((fNetAbs / totalFlow) * 100);
    const pD = 100 - pF;
    document.getElementById('meterFII').style.width = pF + '%';
    document.getElementById('meterDII').style.width = pD + '%';
    
    // Label depending on direction
    document.getElementById('pFii').innerText = (dailyData[0].fn < 0 ? 'FII Selling: ' : 'FII Buying: ') + pF + '%';
    document.getElementById('pFii').className = dailyData[0].fn < 0 ? 't-red' : 't-green';
    // Bar colours follow direction (a buying FII bar must not be drawn red)
    document.getElementById('meterFII').classList.toggle('is-buy', dailyData[0].fn >= 0);
    document.getElementById('meterDII').classList.toggle('is-sell', dailyData[0].dn <= 0);
    
    document.getElementById('pDii').innerText = (dailyData[0].dn > 0 ? 'DII Support: ' : 'DII Selling: ') + pD + '%';
    document.getElementById('pDii').className = dailyData[0].dn > 0 ? 't-green' : 't-red';
  }

  // Heatmap Render
  let fHtml = '', dHtml = '';
  for(let i=0; i<45; i++) {
    let ref = dailyData[i % dailyData.length];
    let fv = i<dailyData.length? ref.fn : ref.fn * (1-(i/100));
    let dv = i<dailyData.length? ref.dn : ref.dn * (1-(i/100));
    let dt = i<dailyData.length? ref.d : `Day -${i}`;
    
    fHtml += `<div class="cal-cell ${getHeatClass(fv, 15000)}" data-tip="${dt}: ${fmt(fv)}"></div>`;
    dHtml += `<div class="cal-cell ${getHeatClass(dv, 15000)}" data-tip="${dt}: ${fmt(dv)}"></div>`;
  }
  const fiiHeat = document.getElementById('fii-heatmap');
  const diiHeat = document.getElementById('dii-heatmap');
  if (fiiHeat) fiiHeat.innerHTML = fHtml;
  if (diiHeat) diiHeat.innerHTML = dHtml;

  // Daily Flow Render
  filterDaily('all', document.getElementById('fBtn-all'));

  // Other Tables
  document.getElementById('tbWeekly').innerHTML = weeklyData.map(d => {const t=d.fn+d.dn; return `<tr><td style="color:var(--t2)">${d.w}</td><td class="${fC(d.fn)}">${fmt(d.fn)}${getBar(d.fn, 40000)}</td><td class="${fC(d.dn)}">${fmt(d.dn)}${getBar(d.dn, 40000)}</td><td class="${fC(t)}">${fmt(t)}</td><td><span class="${t>0?'mb-bull bull':'mb-bear bear'} mom-badge os-badge" title="${t>0?'FII + DII net buying this week = Bullish, money is flowing in':'FII + DII net selling this week = Bearish, money is flowing out'}"><i class="os-dot"></i>${t>0?'Bullish: Net Buying':'Bearish: Net Selling'}</span></td></tr>`}).join('');
  document.getElementById('tbMonthly').innerHTML = monthlyData.map(d => {const t=d.fn+d.dn; const ncCls=d.nc.includes('+')?'pos':d.nc.includes('-')?'neg':''; return `<tr><td style="color:var(--t2); font-weight:700;">${d.m}</td><td class="${fC(d.fn)}">${fmt(d.fn)}${getBar(d.fn, 150000)}</td><td class="${fC(d.dn)}">${fmt(d.dn)}${getBar(d.dn, 150000)}</td><td class="${fC(t)}" style="font-weight:800; font-size:14px;">${fmt(t)}</td><td class="${ncCls}">${d.nc}</td></tr>`}).join('');
  document.getElementById('tbYearly').innerHTML = yearlyData.map(d => {const t=d.fn+d.dn; return `<tr><td style="color:var(--t1); font-weight:800; font-size:15px;">${d.y}</td><td class="${fC(d.fn)}">${fmt(d.fn)}${getBar(d.fn, 400000)}</td><td class="${fC(d.dn)}">${fmt(d.dn)}${getBar(d.dn, 800000)}</td><td class="${fC(t)}" style="font-weight:800;">${fmt(t)}</td><td style="color:var(--t3); font-weight:700;">${d.fn<0&&d.dn>0? (d.dn/Math.abs(d.fn)).toFixed(2)+'x' : 'N/A'}</td></tr>`}).join('');

  // ── Phase 8: Populate Matrices Summary Stats ──
  const el = id => document.getElementById(id);
  if (el('mx-sessions')) el('mx-sessions').innerText = dailyData.length;
  const avgFII = dailyData.reduce((a,d) => a + d.fn, 0) / dailyData.length;
  const avgDII = dailyData.reduce((a,d) => a + d.dn, 0) / dailyData.length;
  if (el('mx-avg-fii')) { el('mx-avg-fii').innerText = fmt(Math.round(avgFII)); el('mx-avg-fii').style.color = avgFII >= 0 ? 'var(--green)' : 'var(--red)'; }
  if (el('mx-avg-dii')) { el('mx-avg-dii').innerText = fmt(Math.round(avgDII)); el('mx-avg-dii').style.color = avgDII >= 0 ? 'var(--green)' : 'var(--red)'; }
  const bloodbathDays = dailyData.filter(d => d.fn < -5000).length;
  if (el('mx-bloodbath')) el('mx-bloodbath').innerText = bloodbathDays;

  renderCommandCenter();
}

function getFlowScore(data, days = 5) {
  if (!data || data.length < 2) return { score: 50, label: 'NEUTRAL', color: 'var(--t3)' };
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const slice = data.slice(0, Math.min(days, data.length));
  const fiiAvg = slice.reduce((sum, d) => sum + d.fn, 0) / slice.length;
  const diiAvg = slice.reduce((sum, d) => sum + d.dn, 0) / slice.length;
  const netAvg = slice.reduce((sum, d) => sum + d.fn + d.dn, 0) / slice.length;
  const raw = 50 + clamp(fiiAvg / 500, -25, 25) + clamp(diiAvg / 300, -15, 15) + clamp(netAvg / 600, -10, 10);
  const score = Math.round(clamp(raw, 0, 100));
  if (score >= 70) return { score, label: 'BULL REGIME', color: 'var(--green)' };
  if (score >= 55) return { score, label: 'MILD BULLISH', color: 'var(--green)' };
  if (score >= 45) return { score, label: 'NEUTRAL ZONE', color: 'var(--t3)' };
  if (score >= 30) return { score, label: 'MILD BEARISH', color: 'var(--red)' };
  return { score, label: 'BEAR REGIME', color: 'var(--red)' };
}

function getStockScore(data) {
  if (!data || data.length < 2) return { score: 50, label: 'NEUTRAL', color: 'var(--t3)' };
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const slice = data.slice(0, Math.min(10, data.length));
  const fiiAvg = slice.reduce((sum, d) => sum + d.fn, 0) / slice.length;
  const diiAvg = slice.reduce((sum, d) => sum + d.dn, 0) / slice.length;
  const posDays = slice.filter(d => d.fn + d.dn > 0).length;
  const momPct = (posDays / slice.length) * 100;
  const latest = data[0];
  const absorption = latest.fn < 0 ? latest.dn / Math.abs(latest.fn || 1) : null;
  let raw = 50 + clamp(fiiAvg / 400, -25, 25) + clamp(diiAvg / 280, -15, 15) + clamp((momPct - 50) / 5, -10, 10);
  if (absorption !== null) raw += clamp((absorption - 0.8) * 5, -5, 5);
  const score = Math.round(clamp(raw, 0, 100));
  if (score >= 80) return { score, label: 'STRONG BULL', color: 'var(--green)' };
  if (score >= 65) return { score, label: 'BULLISH', color: 'var(--green)' };
  if (score >= 50) return { score, label: 'MILD BULLISH', color: '#84CC16' };
  if (score >= 40) return { score, label: 'NEUTRAL', color: '#F59E0B' };
  if (score >= 25) return { score, label: 'MILD BEARISH', color: '#F97316' };
  return { score, label: 'BEAR REGIME', color: 'var(--red)' };
}

function getFnoSentiment(latestFno) {
  if (!latestFno || latestFno.fii_idx_fut_long === undefined) {
    return { score: '--', label: 'NO F&O DATA', color: 'var(--t3)' };
  }
  const futNet = latestFno.fii_idx_fut_long - latestFno.fii_idx_fut_short;
  const callNet = latestFno.fii_idx_call_long - latestFno.fii_idx_call_short;
  const putNet = latestFno.fii_idx_put_long - latestFno.fii_idx_put_short;
  let score = 0;
  if (futNet > 10000) score++;
  if (futNet < -10000) score--;
  if (callNet > 50000) score++;
  if (callNet < -50000) score--;
  if (putNet > 50000) score--;
  if (putNet < -50000) score++;
  if (score >= 2) return { score, label: 'HIGHLY BULLISH', color: 'var(--green)' };
  if (score === 1) return { score, label: 'MILDLY BULLISH', color: 'var(--green)' };
  if (score === 0) return { score, label: 'NEUTRAL', color: 'var(--t3)' };
  if (score === -1) return { score, label: 'MILDLY BEARISH', color: 'var(--red)' };
  return { score, label: 'HIGHLY BEARISH', color: 'var(--red)' };
}

function pressureRow(label, longVal, shortVal, bearishLong = false) {
  const longNum = Number(longVal || 0);
  const shortNum = Number(shortVal || 0);
  const total = longNum + shortNum;
  const pct = total > 0 ? Math.round((longNum / total) * 100) : 50;
  const net = longNum - shortNum;
  const color = bearishLong ? (net >= 0 ? 'var(--red)' : 'var(--green)') : (net >= 0 ? 'var(--green)' : 'var(--red)');
  return `<div class="pressure-row">
    <span>${label}</span>
    <strong style="color:${color}">${net >= 0 ? '+' : ''}${net.toLocaleString('en-IN')}</strong>
    <div title="Long ${pct}% / Short ${100 - pct}%"><i style="width:${pct}%; background:${color};"></i></div>
  </div>`;
}

function renderSectorTape() {
  const target = document.getElementById('cmd-sector-tape');
  if (!target) return;
  if (!SECTOR_DATA || !SECTOR_DATA.length) {
    target.innerHTML = `<div><span>Sector Data</span><strong>Loading</strong><em>Waiting for NSDL feed</em></div>`;
    return;
  }
  const byInflow = [...SECTOR_DATA].sort((a, b) => b.fortnightCr - a.fortnightCr);
  const byAum = [...SECTOR_DATA].sort((a, b) => b.aumPct - a.aumPct);
  const byYear = [...SECTOR_DATA].sort((a, b) => b.oneYearCr - a.oneYearCr);
  const outflow = byInflow[byInflow.length - 1];
  const items = [
    ['Top Inflow', byInflow[0].name, _fmtCr(byInflow[0].fortnightCr), 'var(--green)'],
    ['Top Outflow', outflow.name, _fmtCr(outflow.fortnightCr), 'var(--red)'],
    ['AUM Leader', byAum[0].name, `${byAum[0].aumPct.toFixed(1)}%`, 'var(--t1)'],
    ['1Y Leader', byYear[0].name, _fmtCr(byYear[0].oneYearCr), 'var(--green)']
  ];
  target.innerHTML = items.map(([label, name, value, color]) => `<div><span>${label}</span><strong title="${name}">${name}</strong><em style="color:${color}">${value}</em></div>`).join('');
}

/* One-sentence read of FII index-futures positioning, ranked against the loaded history */
function renderFnoRead(f, real) {
  const el = document.getElementById('fnoRead'); if (!el) return;
  if (!real) { el.hidden = true; return; }
  const L = Number(f.fii_idx_fut_long || 0), S = Number(f.fii_idx_fut_short || 0);
  if (!L && !S) { el.hidden = true; return; }
  const ratio = S ? L / S : Infinity;
  const hist = dailyData.filter(d => (d.fii_idx_fut_long || 0) > 0 && (d.fii_idx_fut_short || 0) > 0).map(d => d.fii_idx_fut_long / d.fii_idx_fut_short);
  const below = hist.filter(r => r < ratio).length, pct = hist.length ? Math.round(100 * below / hist.length) : null;
  const net = L - S, side = net >= 0 ? 'net long' : 'net short';
  const tone = ratio >= 1.5 ? 'firmly bullish' : ratio >= 1 ? 'mildly bullish' : ratio >= 0.5 ? 'cautious, hedged' : 'heavily hedged, bearish';
  // Rank is relative; the tone above is absolute. Word the rank so the two
  // never contradict each other ("bearish … among the most bullish readings").
  const n = hist.length;
  const where = pct == null || n < 20 ? ''
    : pct <= 20 ? (ratio < 1 ? `, among the most bearish readings in the last ${n} sessions` : `, though one of the least long readings in the last ${n} sessions`)
    : pct >= 80 ? (ratio >= 1 ? `, among the most bullish readings in the last ${n} sessions` : `, though the short bias is among the lightest in the last ${n} sessions`)
    : ` (${pct}th percentile of the last ${n} sessions)`;
  const asOf = fnoLag(f) > 0 ? `As of ${escapeHtml(f.d)}: ` : '';
  el.innerHTML = `${asOf}FIIs are <b>${side} ${Math.abs(net).toLocaleString('en-IN')}</b> index-futures contracts (${L.toLocaleString('en-IN')} long vs ${S.toLocaleString('en-IN')} short). Long/short ratio <b>${isFinite(ratio) ? ratio.toFixed(2) : '∞'}</b>: <b>${tone}</b>${escapeHtml(where)}.`;
  el.hidden = false;
}

function renderCommandCenter() {
  if (!dailyData || !dailyData.length) return;
  const latest = dailyData[0];
  // Most recent session with REAL F&O (newest day may be cash-only until NSE
  // publishes participant-OI later in the evening)
  const latestFno = dailyData.find(d => (d.fii_idx_fut_long || 0) !== 0 || (d.fii_idx_fut_short || 0) !== 0) || latest;
  const market = getFlowScore(dailyData, 5);
  const stock = getStockScore(dailyData);
  const fno = getFnoSentiment(latestFno);
  const set = (id, text, color) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    if (color) el.style.color = color;
  };
  const net = latest.fn + latest.dn;
  set('cmd-session-date', latest.d || 'Latest session');
  set('cmd-market-state', net >= 0 ? 'LIQUIDITY INJECTION' : 'LIQUIDITY DRAIN', net >= 0 ? 'var(--green)' : 'var(--red)');
  set('cmd-market-score', market.score, market.color);
  set('cmd-market-label', market.label, market.color);
  set('cmd-stock-score', stock.score, stock.color);
  set('cmd-stock-label', stock.label, stock.color);
  // A positioning read that is several sessions old is context, not a signal
  const _fnoLag = fnoLag(latestFno), _fnoStale = _fnoLag > 2;
  set('cmd-fno-score', fno.score, _fnoStale ? 'var(--t4)' : fno.color);
  set('cmd-fno-label', _fnoStale ? `STALE · ${fno.label} AS OF ${latestFno.d}` : fno.label, _fnoStale ? 'var(--t3)' : fno.color);
  // Position each score on its scale (0–100 for flow scores, −3…+3 for F&O)
  const gauge = (id, pct, color) => {
    const g = document.getElementById(id); if (!g) return;
    g.style.left = `${Math.max(0, Math.min(100, pct))}%`;
    g.style.background = color;
  };
  gauge('cmd-market-gauge', market.score, market.color);
  gauge('cmd-stock-gauge', stock.score, stock.color);
  gauge('cmd-fno-gauge', typeof fno.score === 'number' ? ((fno.score + 3) / 6) * 100 : 50, _fnoStale ? 'var(--t4)' : fno.color);
  set('cmd-ai-regime', document.getElementById('ai-active-regime')?.innerText || '--');
  set('cmd-ai-desc', document.getElementById('ai-regime-desc')?.innerText || 'Optional signal');

  const bloodbath = dailyData.filter(d => d.fn < -5000).length;
  const absorption = dailyData.filter(d => d.dn > 5000).length;
  const divergence = dailyData.filter(d => d.fn < -8000 && d.dn > 8000).length;
  set('cmd-anomaly-counts', `${bloodbath} / ${absorption}`);
  set('cmd-divergence-count', `Divergence ${divergence}`);

  const _fnoReal = latestFno && ((latestFno.fii_idx_fut_long || 0) !== 0 || (latestFno.fii_idx_fut_short || 0) !== 0);
  set('cmd-fno-date', !_fnoReal ? 'F&O data pending' : (latestFno.d !== latest.d ? (_fnoStale ? `Stale: F&O last seen ${latestFno.d} (${_fnoLag} sessions behind)` : `F&O: ${latestFno.d} (${latest.d} pending)`) : `F&O data: ${latestFno.d}`));
  const signedContracts = (value) => `${Number(value || 0) >= 0 ? '+' : ''}${Number(value || 0).toLocaleString('en-IN')}`;
  const futNet = Number(latestFno.fii_idx_fut_long || 0) - Number(latestFno.fii_idx_fut_short || 0);
  const callNet = Number(latestFno.fii_idx_call_long || 0) - Number(latestFno.fii_idx_call_short || 0);
  const putNet = Number(latestFno.fii_idx_put_long || 0) - Number(latestFno.fii_idx_put_short || 0);
  set('cmd-fno-direction', _fnoStale ? `${fno.label} (stale)` : fno.label, _fnoStale ? 'var(--t3)' : fno.color);
  // Net long calls = bullish, net long puts = bearish — so the bullish tilt is call MINUS put
  set('cmd-fno-callput', `${signedContracts(callNet)} / ${signedContracts(putNet)}`, callNet - putNet >= 0 ? 'var(--green)' : 'var(--red)');
  set('cmd-fno-net', signedContracts(futNet), futNet >= 0 ? 'var(--green)' : 'var(--red)');
  const fnoTarget = document.getElementById('cmd-fno-pressure');
  if (fnoTarget) {
    fnoTarget.innerHTML = [
      pressureRow('FII Futures', latestFno.fii_idx_fut_long, latestFno.fii_idx_fut_short),
      pressureRow('FII Calls', latestFno.fii_idx_call_long, latestFno.fii_idx_call_short),
      pressureRow('FII Puts', latestFno.fii_idx_put_long, latestFno.fii_idx_put_short, true),
      pressureRow('DII Futures', latestFno.dii_idx_fut_long, latestFno.dii_idx_fut_short)
    ].join('');
  }

  renderSectorTape();
  renderFnoRead(latestFno, _fnoReal);

  const recentBody = document.getElementById('cmd-recent-body');
  if (recentBody) {
    recentBody.innerHTML = dailyData.slice(0, 12).map(d => {
      const total = d.fn + d.dn;
      const score = getFlowScore([d, d], 1);
      return `<tr onclick="openSession('${escapeHtml(d.d)}')" title="Open this session in Flow Analytics">
        <td>${d.d}</td>
        <td class="${fC(d.fn)}">${fmt(d.fn)}</td>
        <td class="${fC(d.dn)}">${fmt(d.dn)}</td>
        <td class="${fC(total)}">${fmt(total)}</td>
        <td><span class="signal-pill os-badge ${score.label.includes('BULL') ? 'bull sig-bull' : score.label.includes('BEAR') ? 'bear sig-bear' : 'neutral sig-neutral'}" title="Bullish = positive flow score, Bearish = negative flow score, Neutral = balanced"><i class="os-dot"></i>${score.label}</span></td>
      </tr>`;
    }).join('');
  }
}

/* ── MARKET STRENGTH ── */
function renderMarketStrength() {
  if (!dailyData || dailyData.length < 2) return;

  const CR = 50; // ₹ Cr scale normaliser for Score

  // ── helpers ──────────────────────────────────────────────
  const clamp = (v,lo,hi) => Math.max(lo, Math.min(hi, v));

  // ── 5-day slice ──────────────────────────────────────────
  const slice5 = dailyData.slice(0, 5);
  const fii5   = slice5.map(d => d.fn);
  const dii5   = slice5.map(d => d.dn);
  const fiiSum = fii5.reduce((a,b)=>a+b, 0);
  const diiSum = dii5.reduce((a,b)=>a+b, 0);
  const fiiAvg = fiiSum / 5;
  const diiAvg = diiSum / 5;
  const netliq5 = slice5.map(d => d.fn + d.dn);
  const netAvg  = netliq5.reduce((a,b)=>a+b,0) / 5;

  // Cumulative net liq over available data
  const cumNet  = dailyData.reduce((a,d)=>a+d.fn+d.dn, 0);

  // ── Flow Score (0–100) ───────────────────────────────────
  // DII > 0 is bullish (+), FII > 0 is bullish (+), FII selling offset by DII
  let rawScore = 50;
  rawScore += clamp(fiiAvg / 500, -25, 25);    // FII component  (-25 to +25)
  rawScore += clamp(diiAvg / 300, -15, 15);    // DII component  (-15 to +15)
  rawScore += clamp(netAvg / 600, -10, 10);    // Net liquidity  (-10 to +10)
  const score = Math.round(clamp(rawScore, 0, 100));

  // ── Update gauge ─────────────────────────────────────────
  const arc = document.getElementById('ms-gauge-arc');
  const scoreEl = document.getElementById('ms-score');
  const labelEl = document.getElementById('ms-score-label');
  if (arc && scoreEl) {
    // Full arc length ~157; offset 157=empty, 0=full. Scale 0‒100 → 157‒0
    const offset = 157 - Math.round((score / 100) * 157);
    const gColor = score >= 60 ? 'var(--green)' : score >= 40 ? '#F59E0B' : 'var(--red)';
    arc.setAttribute('stroke-dashoffset', offset);
    arc.setAttribute('stroke', gColor);
    scoreEl.innerText = score;
    scoreEl.style.color = gColor;
  }
  if (labelEl) {
    if      (score >= 70) { labelEl.innerText = 'BULL REGIME';    labelEl.style.color='var(--green)'; }
    else if (score >= 55) { labelEl.innerText = 'MILD BULLISH';   labelEl.style.color='var(--green)'; }
    else if (score >= 45) { labelEl.innerText = 'NEUTRAL ZONE';   labelEl.style.color='var(--t3)'; }
    else if (score >= 30) { labelEl.innerText = 'MILD BEARISH';   labelEl.style.color='var(--red)'; }
    else                  { labelEl.innerText = 'BEAR REGIME';    labelEl.style.color='var(--red)'; }
  }

  // ── FII 5-Day Trend ──────────────────────────────────────
  const fiiTrendEl   = document.getElementById('ms-fii-trend');
  const fiiStreakEl  = document.getElementById('ms-fii-streak');
  const fiiBuyDays   = fii5.filter(v=>v>0).length;
  const fiiSellDays  = fii5.filter(v=>v<0).length;
  let fiiArr, fiiColor;
  if (fiiBuyDays >= 4)       { fiiArr='▲▲▲'; fiiColor='var(--green)'; }
  else if (fiiBuyDays === 3) { fiiArr='▲▲'; fiiColor='var(--green)'; }
  else if (fiiSellDays >= 4) { fiiArr='▼▼▼'; fiiColor='var(--red)'; }
  else if (fiiSellDays === 3){ fiiArr='▼▼'; fiiColor='var(--red)'; }
  else                       { fiiArr='◀▶'; fiiColor='var(--t3)'; }
  if (fiiTrendEl) { fiiTrendEl.innerText=fiiArr; fiiTrendEl.style.color=fiiColor; }
  if (fiiStreakEl) fiiStreakEl.innerText = `${fiiBuyDays}B / ${fiiSellDays}S  |  Avg: ${fmt(fiiAvg)}`;

  // ── DII 5-Day Trend ──────────────────────────────────────
  const diiTrendEl  = document.getElementById('ms-dii-trend');
  const diiStreakEl = document.getElementById('ms-dii-streak');
  const diiBuyDays  = dii5.filter(v=>v>0).length;
  const diiSellDays = dii5.filter(v=>v<0).length;
  let diiArr, diiColor;
  if (diiBuyDays >= 4)       { diiArr='▲▲▲'; diiColor='var(--green)'; }
  else if (diiBuyDays === 3) { diiArr='▲▲'; diiColor='var(--green)'; }
  else if (diiSellDays >= 4) { diiArr='▼▼▼'; diiColor='var(--red)'; }
  else if (diiSellDays === 3){ diiArr='▼▼'; diiColor='var(--red)'; }
  else                       { diiArr='◀▶'; diiColor='var(--t3)'; }
  if (diiTrendEl) { diiTrendEl.innerText=diiArr; diiTrendEl.style.color=diiColor; }
  if (diiStreakEl) diiStreakEl.innerText = `${diiBuyDays}B / ${diiSellDays}S  |  Avg: ${fmt(diiAvg)}`;

  // ── Net Liquidity ─────────────────────────────────────────
  const nlEl  = document.getElementById('ms-netliq');
  const nlCum = document.getElementById('ms-netliq-cum');
  if (nlEl)  { nlEl.innerText = fmt(netAvg); nlEl.style.color = netAvg>=0?'var(--green)':'var(--red)'; }
  if (nlCum) { nlCum.innerText = fmt(cumNet); nlCum.style.color = cumNet>=0?'var(--green)':'var(--red)'; }

  // ── Signal Cards ─────────────────────────────────────────
  // Regime Signal
  const regimeEl = document.getElementById('ms-regime');
  if (regimeEl) {
    const txt = score>=65?' Bull – Accumulate':score>=50?' Mild Bull – Cautious':score>=35?' Neutral – Wait':score>=20?' Bear – Defend':' Deep Bear – Exit';
    regimeEl.innerText = txt;
    regimeEl.style.color = score>=50?'var(--green)':score>=35?'#F59E0B':'var(--red)';
  }

  // FII/DII Divergence
  const divEl = document.getElementById('ms-diverge');
  if (divEl) {
    const fiiSelling = fiiAvg < -3000;
    const diiBuying  = diiAvg >  3000;
    if (fiiSelling && diiBuying) { divEl.innerText='⚡ FII Dumping / DII Absorbing'; divEl.style.color='#F59E0B'; }
    else if (!fiiSelling && !diiBuying && fiiAvg>3000&&diiAvg>3000) { divEl.innerText='✅ Both Buying'; divEl.style.color='var(--green)'; }
    else if (fiiSelling && !diiBuying) { divEl.innerText=' FII Selling / DII Weak'; divEl.style.color='var(--red)'; }
    else if (fiiAvg>0 && diiAvg>0) { divEl.innerText=' Both Positive'; divEl.style.color='var(--green)'; }
    else { divEl.innerText=' Mixed Signals'; divEl.style.color='var(--t3)'; }
  }

  // FII Pressure
  const fpEl = document.getElementById('ms-fii-pressure');
  if (fpEl) {
    const p = Math.abs(fiiAvg);
    const txt = p>15000?' Extreme':p>7000?' High':p>2000?'Moderate':'Low / Neutral';
    const isPos = fiiAvg >= 0;
    fpEl.innerText = isPos ? `Buying | ${txt}` : `Selling | ${txt}`;
    fpEl.style.color = isPos ? 'var(--green)' : 'var(--red)';
  }

  // DII Absorption
  const daEl = document.getElementById('ms-dii-abs');
  if (daEl) {
    const ratio = fiiAvg < 0 ? Math.abs(diiAvg / (fiiAvg||1)) : null;
    if (ratio === null) { daEl.innerText = 'FII Not Selling'; daEl.style.color='var(--t3)'; }
    else if (ratio >= 1.5) { daEl.innerText=`Full Cover: ${ratio.toFixed(2)}x`; daEl.style.color='var(--green)'; }
    else if (ratio >= 0.8) { daEl.innerText=`Partial: ${ratio.toFixed(2)}x`; daEl.style.color='#F59E0B'; }
    else { daEl.innerText=`Weak: ${ratio.toFixed(2)}x`; daEl.style.color='var(--red)'; }
  }

  // ── 10-Session Table ──────────────────────────────────────
  const tbody = document.getElementById('ms-table-body');
  if (tbody) {
    const rows = dailyData.slice(0, 10).map(d => {
      const nl  = d.fn + d.dn;
      const rs  = Math.round(clamp(50 + (d.fn/500) + (d.dn/300) + (nl/600), 0, 100));
      const sig = rs>=65?'<span style="color:var(--green);font-weight:800;">BULL</span>'
                  :rs>=50?'<span style="color:#84CC16;font-weight:700;">MILD +</span>'
                  :rs>=35?'<span style="color:#F59E0B;font-weight:700;">NEUTRAL</span>'
                         :'<span style="color:var(--red);font-weight:800;">BEAR</span>';
      const rc   = i => i>=0 ? 'color:var(--green)' : 'color:var(--red)';
      return `<tr style="border-bottom:1px solid var(--sep2);">
        <td style="padding:8px 10px;color:var(--t2);white-space:nowrap;">${d.d}</td>
        <td style="padding:8px 10px;text-align:right;${rc(d.fn)};font-weight:700;">${fmt(d.fn)}</td>
        <td style="padding:8px 10px;text-align:right;${rc(d.dn)};font-weight:700;">${fmt(d.dn)}</td>
        <td style="padding:8px 10px;text-align:right;${rc(nl)};">${fmt(nl)}</td>
        <td style="padding:8px 10px;text-align:center;">${sig}</td>
      </tr>`;
    }).join('');
    tbody.innerHTML = rows;
  }
  renderStockStrengthMeter();
  renderHeatmaps();
  initTables();
}

/* ── STOCK STRENGTH METER ── */
function renderStockStrengthMeter() {
  if (!dailyData || dailyData.length < 2) return;

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const CAP = 15000; // ₹Cr cap for bar normalisation

  // 10-day slice
  const slice10 = dailyData.slice(0, Math.min(10, dailyData.length));
  const fiiCash10 = slice10.map(d => d.fn);
  const diiCash10 = slice10.map(d => d.dn);
  const fiiAvg10  = fiiCash10.reduce((a, b) => a + b, 0) / slice10.length;
  const diiAvg10  = diiCash10.reduce((a, b) => a + b, 0) / slice10.length;

  // Momentum: how many of the 10 days had net (fn+dn) > 0
  const posDays   = slice10.filter(d => (d.fn + d.dn) > 0).length;
  const momPct    = (posDays / slice10.length) * 100; // 0–100

  // Absorption: DII / |FII| when FII < 0 (last day)
  const latest    = dailyData[0];
  const absRatio  = latest.fn < 0 ? (latest.dn / Math.abs(latest.fn || 1)) : null;

  // Cumulative net
  const cumNet    = dailyData.reduce((a, d) => a + d.fn + d.dn, 0);

  // ── Score computation (0–100) ──
  let raw = 50;
  raw += clamp(fiiAvg10 / 400, -25, 25);  // FII cash: ±25
  raw += clamp(diiAvg10 / 280, -15, 15);  // DII cash: ±15
  raw += clamp((momPct - 50) / 5, -10, 10); // Momentum: ±10 (>50%=bull)
  if (absRatio !== null) raw += clamp((absRatio - 0.8) * 5, -5, 5); // Absorption nudge
  const score = Math.round(clamp(raw, 0, 100));

  // ── Needle angle: score 0→-90°, 50→0°, 100→+90° ──
  const deg = -90 + (score / 100) * 180;
  const needle = document.getElementById('ssm-needle');
  if (needle) needle.setAttribute('transform', `rotate(${deg}, 160, 160)`);

  // ── Score: text + colour ──
  const gColor = score >= 65 ? '#00D09E' : score >= 50 ? '#84CC16' : score >= 35 ? '#F59E0B' : score >= 20 ? '#F97316' : '#EF4444';
  const scoreText = document.getElementById('ssm-score-text');
  if (scoreText) { scoreText.textContent = score; scoreText.setAttribute('fill', gColor); }

  // ── Label + signal ──
  let label, signal;
  if      (score >= 80) { label = ' STRONG BULL';   signal = 'Broad institutional buying across FII & DII. Accumulation environment. High confidence for longs.'; }
  else if (score >= 65) { label = '📈 BULLISH';       signal = 'FII returning + DII supporting. Net flows clearly positive. Favorable for equity longs.'; }
  else if (score >= 50) { label = ' MILD BULLISH';  signal = 'Marginal net buying bias. DII providing support. Watch for FII follow-through before high-conviction entries.'; }
  else if (score >= 40) { label = ' NEUTRAL';       signal = 'Mixed institutional signals. No clear directional edge from flows. Wait for confirmation.'; }
  else if (score >= 25) { label = ' MILD BEARISH';  signal = 'FII selling outpacing DII absorption. Cautious approach advised. Reduce fresh long exposure.'; }
  else                  { label = ' BEAR REGIME';   signal = 'Sustained FII outflows with weak DII support. Distribution in progress. Defensive positioning recommended.'; }

  const labelEl  = document.getElementById('ssm-label');
  const signalEl = document.getElementById('ssm-signal');
  if (labelEl)  { labelEl.textContent = label; labelEl.style.color = gColor; }
  if (signalEl) { signalEl.textContent = signal; }

  // ── Badge ──
  const badge = document.getElementById('ssm-badge');
  if (badge) {
    badge.textContent = score >= 65 ? 'BULLISH' : score >= 40 ? 'NEUTRAL' : 'BEARISH';
    badge.style.color = gColor;
    badge.style.background = `${gColor}22`;
  }

  // ── FII Cash bar (bi-directional from center) ──
  const fiiBg = fiiAvg10 >= 0 ? '#00D09E' : '#EF4444';
  const fiiW   = Math.min(Math.abs(fiiAvg10) / CAP * 50, 50); // max 50% of width
  const fiiBar = document.getElementById('ssm-fii-bar');
  const fiiVal = document.getElementById('ssm-fii-val');
  if (fiiBar) {
    fiiBar.style.background = fiiBg;
    if (fiiAvg10 >= 0) { fiiBar.style.left = '50%'; fiiBar.style.width = fiiW + '%'; }
    else               { fiiBar.style.left = (50 - fiiW) + '%'; fiiBar.style.width = fiiW + '%'; }
  }
  if (fiiVal) { fiiVal.textContent = fmt(Math.round(fiiAvg10)); fiiVal.style.color = fiiBg; }

  // ── DII Cash bar ──
  const diiBg = diiAvg10 >= 0 ? '#00D09E' : '#EF4444';
  const diiW   = Math.min(Math.abs(diiAvg10) / CAP * 50, 50);
  const diiBar = document.getElementById('ssm-dii-bar');
  const diiVal = document.getElementById('ssm-dii-val');
  if (diiBar) {
    diiBar.style.background = diiBg;
    if (diiAvg10 >= 0) { diiBar.style.left = '50%'; diiBar.style.width = diiW + '%'; }
    else               { diiBar.style.left = (50 - diiW) + '%'; diiBar.style.width = diiW + '%'; }
  }
  if (diiVal) { diiVal.textContent = fmt(Math.round(diiAvg10)); diiVal.style.color = diiBg; }

  // ── Momentum bar (left-to-right 0–100%) ──
  const momColor = momPct >= 60 ? '#00D09E' : momPct >= 40 ? '#F59E0B' : '#EF4444';
  const momBar   = document.getElementById('ssm-mom-bar');
  const momVal   = document.getElementById('ssm-mom-val');
  if (momBar) { momBar.style.width = momPct + '%'; momBar.style.background = momColor; }
  if (momVal) { momVal.textContent = `${posDays} / ${slice10.length} days`; momVal.style.color = momColor; }

  // ── Absorption mini-stats ──
  const absEl    = document.getElementById('ssm-abs');
  const cumEl    = document.getElementById('ssm-cum');
  const latestEl = document.getElementById('ssm-latest');
  if (absEl) {
    if (absRatio === null) { absEl.textContent = 'N/A (FII +ve)'; absEl.style.color = 'var(--green)'; }
    else if (absRatio >= 1.5) { absEl.textContent = `Full ${absRatio.toFixed(2)}x`; absEl.style.color = '#00D09E'; }
    else if (absRatio >= 0.8) { absEl.textContent = `Part ${absRatio.toFixed(2)}x`; absEl.style.color = '#F59E0B'; }
    else { absEl.textContent = `Weak ${absRatio.toFixed(2)}x`; absEl.style.color = '#EF4444'; }
  }
  if (cumEl)  { cumEl.textContent = fmt(cumNet); cumEl.style.color = cumNet >= 0 ? 'var(--green)' : 'var(--red)'; }
  if (latestEl) {
    const ld = latest.fn + latest.dn;
    latestEl.textContent = fmt(ld);
    latestEl.style.color = ld >= 0 ? 'var(--green)' : 'var(--red)';
  }
}

/* track active quick-filter so date-range can co-operate */
let _activeFilter = 'all';
let _activeBtnEl  = null;

// Pagination state
let currPageDaily = 1;
let pageSizeDaily = 20;
let _dailySort = { key: null, dir: 'desc' };
const DAILY_KEYS = ['d', 'fb', 'fs', 'fn', 'db', 'ds', 'dn', 'liq'];
function applyDailySort(arr) {
  const k = _dailySort.key; if (!k) return arr;
  const dir = _dailySort.dir === 'asc' ? 1 : -1;
  const val = d => k === 'd' ? (parseNSEDate(d.d) || 0) : k === 'liq' ? d.fn + d.dn : k === 'fs' ? -d.fs : k === 'ds' ? -d.ds : d[k];
  return [...arr].sort((a, b) => (val(a) - val(b)) * dir);
}
function sortDaily(key) {
  if (_dailySort.key === key) _dailySort.dir = _dailySort.dir === 'asc' ? 'desc' : 'asc';
  else { _dailySort.key = key; _dailySort.dir = key === 'd' ? 'desc' : 'desc'; }
  if (_dailySort.key === 'd' && _dailySort.dir === 'desc') _dailySort.key = null;
  paginatedFilteredData = applyDailySort(window._lastFilteredDailyData || dailyData);
  currPageDaily = 1; renderDailyTable();
}
function setPageSize(n) { pageSizeDaily = Math.max(5, parseInt(n, 10) || 20); currPageDaily = 1; try { localStorage.setItem('mc_pagesize', String(pageSizeDaily)); } catch (e) {} renderDailyTable(); }
try { const ps = parseInt(localStorage.getItem('mc_pagesize') || '', 10); if (ps > 0) pageSizeDaily = ps; } catch (e) {}
let paginatedFilteredData = [];
window._lastFilteredDailyData = []; // Ensure it exists early

function filterDaily(type, btn) {
  if (type && type !== 'daterange') {
    document.querySelectorAll('#matrix-table-container .mc-filters .filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    _activeFilter = type;
    _activeBtnEl  = btn;
  }

  const from = document.getElementById('drFrom') ? parseNSEDate(dateInputToNSE(document.getElementById('drFrom').value)) : null;
  const to   = document.getElementById('drTo')   ? parseNSEDate(dateInputToNSE(document.getElementById('drTo').value))   : null;

  /* filter on quick-filter type first, then date range */
  let filteredData = dailyData.filter((d) => {
    let pass = true;
    if (_activeFilter === 'fii_sell')   pass = d.fn < -5000;
    else if (_activeFilter === 'dii_buy')    pass = d.dn > 5000;
    else if (_activeFilter === 'divergence') pass = d.fn < -8000 && d.dn > 8000;
    
    if (pass && (from || to)) {
      const dt = parseNSEDate(d.d);
      if (dt) {
        if (from && dt < from) pass = false;
        if (to   && dt > to)   pass = false;
      }
    }
    return pass;
  });

  window._lastFilteredDailyData = filteredData;
  paginatedFilteredData = applyDailySort(filteredData);
  currPageDaily = 1; // reset to page 1 on filter
  
  renderDailyTable();
}

function changePage(dir) {
  const maxPages = Math.ceil(paginatedFilteredData.length / pageSizeDaily);
  currPageDaily += dir;
  if (currPageDaily < 1) currPageDaily = 1;
  if (currPageDaily > maxPages) currPageDaily = maxPages;
  renderDailyTable();
}

function renderDailyTable() {
  const tb = document.getElementById('tbDaily');
  if (!paginatedFilteredData.length) {
    tb.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:24px; color:var(--t4);">No matching records found.</td></tr>';
    document.getElementById('pag-start').innerText = 0;
    document.getElementById('pag-end').innerText = 0;
    document.getElementById('pag-total').innerText = 0;
    document.getElementById('pag-pages').innerHTML = '';
    renderDailyTotals(paginatedFilteredData);
    return;
  }

  const maxPages = Math.ceil(paginatedFilteredData.length / pageSizeDaily);
  if (currPageDaily > maxPages) currPageDaily = maxPages;

  const startIdx = (currPageDaily - 1) * pageSizeDaily;
  const endIdx = Math.min(startIdx + pageSizeDaily, paginatedFilteredData.length);
  const pageData = paginatedFilteredData.slice(startIdx, endIdx);

  // Generate HTML for current page
  const html = pageData.map((d, indexInPage) => {
    const actIdx = startIdx + indexInPage; // use real index for IDs
    const totalLiq = d.fn + d.dn;
    const dotClass = d.fn < -5000 ? 'hot' : d.fn < -2000 ? 'warm' : d.fn > 2000 ? 'cool' : 'neutral';
    
    // Check if real timestamp exists (from backfill/history), else use general
    const tsStr = (d._source || '') !== '' ? `<div style="font-size:9px; color:var(--t4); margin-top:2px;">🕒 ${d._source === 'live-fetch' ? 'Live' : 'Estimated Data'}</div>` : '';

    const mainRow = `<tr class="row-expandable" data-row-idx="${actIdx}" onclick="toggleRowDetail(${actIdx})">` +
      `<td style="color:var(--t2)">` +
        `<div style="display:flex; align-items:center; gap:6px;">` +
          `<span class="sparkdot ${dotClass}"></span>` +
          `<div><div style="font-weight:700;">${d.d}</div>${tsStr}</div>` +
        `</div>` +
      `</td>` +
      (d.p ? NA_CELL : `<td class="pos" style="opacity:0.6">${fmt(d.fb)}</td><td class="neg" style="opacity:0.6">${fmt(-d.fs)}</td>`) +
      `<td class="${fC(d.fn)}" style="font-weight:800">${fmt(d.fn)}${getBar(d.fn, 20000)}</td>` +
      (d.p ? NA_CELL : `<td class="pos" style="opacity:0.6">${fmt(d.db)}</td><td class="neg" style="opacity:0.6">${fmt(-d.ds)}</td>`) +
      `<td class="${fC(d.dn)}" style="font-weight:800">${fmt(d.dn)}${getBar(d.dn, 20000)}</td>` +
      `<td class="${fC(totalLiq)}">${fmt(totalLiq)}</td>` +
      `</tr>`;
    
    // Flag holes in the archive so adjacent rows are not read as consecutive sessions
    const _di = dailyData.indexOf(d);
    const gapRow = (_di >= 0 && gapAfter(_di) && paginatedFilteredData[actIdx + 1] === dailyData[_di + 1])
      ? `<tr class="row-gap"><td colspan="8">No data for the sessions between ${escapeHtml(dailyData[_di + 1].d)} and ${escapeHtml(d.d)}</td></tr>` : '';
    const detailRow = `<tr class="row-detail-panel" id="detail-${actIdx}"><td colspan="8">` +
      `<div class="row-detail-inner">` +
        `<div class="detail-chart-wrap"><canvas id="detailChart-${actIdx}"></canvas></div>` +
        `<div class="detail-stat-grid">` +
          `<div class="detail-stat"><div class="ds-label">FII Buy/Sell Ratio</div><div class="ds-value ${d.p ? '' : (d.fb > d.fs ? 't-green' : 't-red')}">${d.p ? 'n/a' : d.fs > 0 ? (d.fb/d.fs).toFixed(2) + 'x' : '—'}</div></div>` +
          `<div class="detail-stat"><div class="ds-label">DII Buy/Sell Ratio</div><div class="ds-value ${d.p ? '' : (d.db > d.ds ? 't-green' : 't-red')}">${d.p ? 'n/a' : d.ds > 0 ? (d.db/d.ds).toFixed(2) + 'x' : '—'}</div></div>` +
          `<div class="detail-stat"><div class="ds-label">FII Gross Turnover</div><div class="ds-value" style="color:var(--t2)">${d.p ? 'n/a' : fmt(d.fb + d.fs)}</div></div>` +
          `<div class="detail-stat"><div class="ds-label">Net Liquidity</div><div class="ds-value ${fC(totalLiq)}">${fmt(totalLiq)}</div></div>` +
        `</div>` +
      `</div>` +
      `</td></tr>`;
    
    return mainRow + detailRow + gapRow;
  });

  tb.innerHTML = html.join('');
  document.querySelectorAll('#tblDailyArchive th.sortable').forEach(th => { const on = th.dataset.key === _dailySort.key; th.classList.toggle('sorted', on); th.classList.toggle('asc', on && _dailySort.dir === 'asc'); th.setAttribute('aria-sort', on ? (_dailySort.dir === 'asc' ? 'ascending' : 'descending') : 'none'); });
  const psSel = document.getElementById('pageSize'); if (psSel && String(pageSizeDaily) !== psSel.value) psSel.value = String(pageSizeDaily);

  // Update pagination UI
  document.getElementById('pag-start').innerText = startIdx + 1;
  document.getElementById('pag-end').innerText = endIdx;
  document.getElementById('pag-total').innerText = paginatedFilteredData.length;
  
  // Page dots
  let dots = '';
  // Show up to 5 dots max to avoid overflow
  let pStart = Math.max(1, currPageDaily - 2);
  let pEnd = Math.min(maxPages, pStart + 4);
  if (pEnd - pStart < 4) pStart = Math.max(1, pEnd - 4);
  
  for (let p = pStart; p <= pEnd; p++) {
    dots += `<button class="filter-btn ${p === currPageDaily ? 'active' : ''}" onclick="currPageDaily=${p}; renderDailyTable();" style="padding:4px 8px; font-size:10px; font-weight:700;">${p}</button>`;
  }
  document.getElementById('pag-pages').innerHTML = dots;

  document.getElementById('btnPrevPage').disabled = currPageDaily === 1;
  document.getElementById('btnNextPage').disabled = currPageDaily >= maxPages;
  document.getElementById('btnPrevPage').style.opacity = currPageDaily === 1 ? '0.5' : '1';
  document.getElementById('btnNextPage').style.opacity = currPageDaily >= maxPages ? '0.5' : '1';

  renderDailyTotals(paginatedFilteredData);
}


/* convert yyyy-mm-dd (date input) → dd-Mon-yyyy (NSE format) for parseNSEDate */
function dateInputToNSE(val) {
  if (!val) return null;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const [y,m,d] = val.split('-');
  return `${d}-${months[parseInt(m,10)-1]}-${y}`;
}

/* Quick date presets for the daily archive: last N days or year-to-date, anchored on the latest session */
function setDatePreset(span, btn) {
  const latest = dailyData[0] && parseNSEDate(dailyData[0].d);
  if (!latest) return;
  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const from = new Date(latest);
  if (span === 'ytd') { from.setMonth(0, 1); } else { from.setDate(from.getDate() - span); }
  const f = document.getElementById('drFrom'), t = document.getElementById('drTo');
  if (f) f.value = iso(from);
  if (t) t.value = iso(latest);
  document.querySelectorAll('.mc-preset').forEach(b => b.classList.toggle('active', b === btn));
  filterDaily('daterange', null);
}
function clearDateRange() {
  document.querySelectorAll('.mc-preset').forEach(b => b.classList.remove('active'));
  document.getElementById('drFrom').value = '';
  document.getElementById('drTo').value   = '';
  filterDaily(_activeFilter, _activeBtnEl);
}

function renderDailyTotals(data) {
  const tf = document.getElementById('tfDaily');
  if (!tf) return;
  if (!data.length) { tf.innerHTML = ''; return; }
  const sumFb = data.reduce((s,d)=>s+d.fb,0);
  const sumFs = data.reduce((s,d)=>s+d.fs,0);
  const sumFn = data.reduce((s,d)=>s+d.fn,0);
  const sumDb = data.reduce((s,d)=>s+d.db,0);
  const sumDs = data.reduce((s,d)=>s+d.ds,0);
  const sumDn = data.reduce((s,d)=>s+d.dn,0);
  const sumT  = sumFn + sumDn;
  const st = `style="`;
  tf.innerHTML = `<tr>
    <td ${st} color:var(--t2);" title="${data.some(d => d.p) ? 'Gross buy/sell totals exclude net-only sessions' : ''}">∑ ${data.length} days${data.some(d => d.p) ? ` · gross excl. ${data.filter(d => d.p).length} net-only` : ''}</td>
    <td ${st} color:var(--green);">${fmt(sumFb)}</td>
    <td ${st} color:var(--red);">${fmt(-sumFs)}</td>
    <td ${st} color:${sumFn>=0?'var(--green)':'var(--red)'};">${fmt(sumFn)}</td>
    <td ${st} color:var(--green);">${fmt(sumDb)}</td>
    <td ${st} color:var(--red);">${fmt(-sumDs)}</td>
    <td ${st} color:${sumDn>=0?'var(--green)':'var(--red)'};">${fmt(sumDn)}</td>
    <td ${st} color:${sumT>=0?'var(--green)':'var(--red)'};">${fmt(sumT)}</td>
  </tr>`;
}

function exportDailyCSV() {
  const data = window._lastFilteredDailyData || dailyData;
  const hdr = ['Date','FII Gross Buy (Cr)','FII Gross Sell (Cr)','FII Net (Cr)','DII Gross Buy (Cr)','DII Gross Sell (Cr)','DII Net (Cr)','Total Liquidity (Cr)'];
  const rows = data.map(d => [d.d, d.p ? '' : d.fb, d.p ? '' : -d.fs, d.fn, d.p ? '' : d.db, d.p ? '' : -d.ds, d.dn, d.fn+d.dn].join(','));
  const csv  = [hdr.join(','), ...rows].join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `FII_DII_Daily_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
}

function exportRollupCSV(kind) {
  const sets = { weekly: [weeklyData, 'w', 'Week Ending'], monthly: [monthlyData, 'm', 'Month'], yearly: [yearlyData, 'y', 'Year'] };
  const [data, key, label] = sets[kind] || sets.weekly;
  const rows = (data || []).map(d => [String(d[key]).replace(/,/g, ' '), d.fn, d.dn, d.fn + d.dn].join(','));
  const csv = [[label, 'FII Net (Cr)', 'DII Net (Cr)', 'Combined (Cr)'].join(','), ...rows].join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `FII_DII_${kind}_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
}

function _getShareText() {
  const d = dailyData[0];
  if (!d) return `📊 Track live FII/DII institutional flows: https://mrchartist.com/fii-dii-data\n\n#Nifty50 #FIIData #StockMarketIndia @mr_chartist`;
  const latestFn = fmt(d.fn);
  const latestDn = fmt(d.dn);
  const netLiq = fmt(d.fn + d.dn);
  const date = d.d;
  return `📊 FII/DII Institutional Flow Update (${date})\n\n🔴 FII Net: ${latestFn}\n🟢 DII Net: ${latestDn}\n💰 Net Liquidity: ${netLiq}\n\nTrack live: https://mrchartist.com/fii-dii-data\n\n#Nifty50 #FIIData #StockMarketIndia @mr_chartist`;
}

function toggleShareMenu() {
  const menu = document.getElementById('shareMenu');
  if (!menu) return;
  const isOpen = menu.style.display !== 'none';
  menu.style.display = isOpen ? 'none' : 'block';
  // Show native share button on supported devices
  if ('share' in navigator) {
    const ns = document.getElementById('btnNativeShare');
    if (ns) ns.style.display = 'flex';
  }
  // Close on outside click
  if (!isOpen) {
    setTimeout(() => {
      document.addEventListener('click', function closer(e) {
        if (!menu.contains(e.target) && e.target.id !== 'btnShare') {
          menu.style.display = 'none';
          document.removeEventListener('click', closer);
        }
      });
    }, 10);
  }
}

function shareToX() {
  const text = _getShareText();
  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
  document.getElementById('shareMenu').style.display = 'none';
}

function shareToWhatsApp() {
  const text = _getShareText();
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  document.getElementById('shareMenu').style.display = 'none';
}


function shareToLinkedIn() {
  window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent('https://mrchartist.com/fii-dii-data')}`, '_blank');
  document.getElementById('shareMenu').style.display = 'none';
}

function copyShareLink() {
  const text = _getShareText();
  navigator.clipboard.writeText(text).then(() => {
    const btn = event.target.closest('button');
    const orig = btn.innerHTML;
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--green)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied!';
    setTimeout(() => { btn.innerHTML = orig; }, 1500);
  });
}

async function nativeShare() {
  try {
    await navigator.share({
      title: 'FII & DII Data — Mr. Chartist',
      text: _getShareText(),
      url: 'https://mrchartist.com/fii-dii-data'
    });
  } catch (e) { /* user cancelled */ }
  document.getElementById('shareMenu').style.display = 'none';
}

// Share a specific KPI card
async function shareCard(element, label) {
  const text = element.innerText.replace(/Export|📷/g, '').trim();
  const shareText = `📊 ${label}\n\n${text}\n\nLive: https://mrchartist.com/fii-dii-data\n@mr_chartist #FIIData #Nifty50`;
  
  if ('share' in navigator) {
    try {
      await navigator.share({ title: label, text: shareText, url: 'https://mrchartist.com/fii-dii-data' });
      return;
    } catch(e) { /* fallback below */ }
  }
  // Fallback: copy to clipboard
  navigator.clipboard.writeText(shareText).then(() => (window.mcToast || alert)('Copied. Paste it anywhere to share.'));
}

function postToX() { shareToX(); }

/* ── LIVE AUTO-FETCH ── */
/** Smart refresh: 10 min during NSE publish window (5:30-8 PM IST, Mon-Fri), 30 min otherwise */
function getRefreshInterval() {
  const now = new Date();
  const istHour = (now.getUTCHours() + 5) % 24 + (now.getUTCMinutes() + 30) / 60;
  // Adjust for IST: UTC+5:30
  const h = Math.floor(istHour);
  const day = now.getUTCDay(); // 0=Sun, 6=Sat
  const isWeekday = day >= 1 && day <= 5;
  const isPublishWindow = isWeekday && istHour >= 17.5 && istHour <= 20; // 5:30 PM - 8:00 PM IST
  return isPublishWindow ? 10 * 60 * 1000 : 30 * 60 * 1000; // 10 min vs 30 min
}
let nextRefreshAt = 0;
let refreshTimer = null;

function scheduleNextRefresh() {
  if (refreshTimer) clearTimeout(refreshTimer);
  const interval = getRefreshInterval();
  nextRefreshAt = Date.now() + interval;
  refreshTimer = setTimeout(() => fetchLiveNSE(false), interval);
}

/* Live countdown ticker in the status pill */
function startCountdown() {
  setInterval(() => {
    const sTxt = document.getElementById('sTxt');
    if (!sTxt) return;
    const pill = document.getElementById('sPill');
    if (pill && pill.classList.contains('live')) {
      const sec = Math.max(0, Math.round((nextRefreshAt - Date.now()) / 1000));
      const mm = String(Math.floor(sec / 60)).padStart(2, '0');
      const ss = String(sec % 60).padStart(2, '0');
      sTxt.innerHTML = `LIVE &bull; REFRESH IN ${mm}:${ss}`;
    }
  }, 1000);
}

async function injectLiveRow(d) {
  const sPill = document.getElementById('sPill');
  const sTxt  = document.getElementById('sTxt');
  
  // Parse incoming date and compare with current latest
  const incomingDate = parseNSEDate(d.date);
  const currentDate  = parseNSEDate(dailyData[0].d);
  
  if (dailyData[0].d === d.date) {
    // Same date: update in-place
    dailyData[0] = { ...dailyData[0], d: d.date, fb: d.fii_buy, fs: d.fii_sell, fn: d.fii_net, db: d.dii_buy, ds: d.dii_sell, dn: d.dii_net };
  } else if (incomingDate && currentDate && incomingDate > currentDate) {
    // Incoming is NEWER: insert at front
    dailyData.unshift({ d: d.date, fb: d.fii_buy, fs: d.fii_sell, fn: d.fii_net, db: d.dii_buy, ds: d.dii_sell, dn: d.dii_net });
  } else {
    // Incoming is OLDER or same: find and update existing entry, or ignore
    const existingIdx = dailyData.findIndex(row => row.d === d.date);
    if (existingIdx >= 0) {
      dailyData[existingIdx] = { ...dailyData[existingIdx], d: d.date, fb: d.fii_buy, fs: d.fii_sell, fn: d.fii_net, db: d.dii_buy, ds: d.dii_sell, dn: d.dii_net };
    }
    // Don't re-render for older data
    return;
  }

  if (sPill) sPill.className = 'status-pill live';
  if (sTxt)  sTxt.innerHTML  = `LIVE &bull; ${new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}`;
  renderDashboard();
}

async function fetchLiveNSE(isManual = false) {
  const btn = document.getElementById('btnRefresh');
  if (isManual && btn) {
    btn.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite"><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> Syncing...`;
    btn.style.opacity = '0.7';
  }

  let success = false;

  /* ── Helper: check if a date string is "today" in IST ── */
  function isToday(dateStr) {
    if (!dateStr) return false;
    const parsed = parseNSEDate(dateStr);
    if (!parsed) return false;
    const now = new Date();
    // IST offset: UTC+5:30 — compare with local getters on `parsed` because
    // parseNSEDate returns a LOCAL-midnight date (UTC getters shift it a day
    // for any viewer east of UTC, including the IST audience)
    const istNow = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    return parsed.getFullYear() === istNow.getUTCFullYear() &&
           parsed.getMonth() === istNow.getUTCMonth() &&
           parsed.getDate() === istNow.getUTCDate();
  }

  /* ── TIER 0: Trigger server-side NSE fetch + read fresh data ── */
  try {
    // Step 1: Tell server to fetch fresh data from NSE
    const refreshRes = await fetch('/api/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(12000)
    });
    if (refreshRes.ok) {
      console.log('[SYNC] Server-side NSE fetch triggered');
    }

    // Step 2: Read the (now-updated) database
    const dataRes = await fetch(`/api/data?t=${Date.now()}`, { signal: AbortSignal.timeout(6000) });
    if (dataRes.ok) {
      const d = await dataRes.json();
      if (d.date && d.fii_net !== undefined) {
        await injectLiveRow(d);
        scheduleNextRefresh();
        success = true;
        console.log('[SYNC] ✅ Live data from server:', d.date, isToday(d.date) ? '(today)' : '(stale)');
      }
    }
  } catch (e) {
    console.log('[SYNC] Server fetch failed:', e.message);
  }

  /* (A former tier fetched NSE through public third-party CORS proxies from the
     visitor's browser. Removed: it routed visitors' requests through services
     we do not control and re-fetched NSE content outside the server.) */

  /* ── TIER 2: Static fallbacks (GitHub JSON) ── */
  if (!success) {
    const fallbacks = [
      './data/latest.json',
      'https://raw.githubusercontent.com/MrChartist/fii-dii-data/main/data/latest.json',
    ];
    for (const src of fallbacks) {
      try {
        const res = await fetch(`${src}?t=${Date.now()}`, { signal: AbortSignal.timeout(6000) });
        if (res.ok) {
          const d = await res.json();
          if (d.date && d.fii_net !== undefined) {
            await injectLiveRow(d);
            scheduleNextRefresh();
            success = true;
            console.log('[SYNC] ✅ Fallback data from:', src);
            break;
          }
        }
      } catch (e) { /* try next */ }
    }
  }

  /* ── FAIL ── */
  if (!success) {
    console.warn('[SYNC]  All sources failed — showing local archive.');
    const sPill = document.getElementById('sPill');
    const sTxt  = document.getElementById('sTxt');
    if (sPill) { sPill.className = 'status-pill err'; }
    const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    const failMsg = (isManual && isLocal) ? 'SERVER OFFLINE — Run: npm start' : 'LOCAL ARCHIVE';
    if (sTxt) { sTxt.innerHTML = failMsg; }
    scheduleNextRefresh();
  }

  if (isManual && btn) {
    btn.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"></path></svg> Force Sync`;
    btn.style.opacity = '1';
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  EXPANDABLE ROW DETAIL PANELS
 * ═══════════════════════════════════════════════════════════════════════════ */
 
let _activeDetailCharts = {};

function toggleRowDetail(idx) {
  const panel = document.getElementById(`detail-${idx}`);
  const mainRow = document.querySelector(`tr[data-row-idx="${idx}"]`);
  if (!panel || !mainRow) return;
  
  const isOpen = panel.classList.contains('open');
  
  // Close all other panels first
  document.querySelectorAll('.row-detail-panel.open').forEach(p => {
    p.classList.remove('open');
    const i = p.id.replace('detail-', '');
    const r = document.querySelector(`tr[data-row-idx="${i}"]`);
    if (r) r.classList.remove('expanded');
    if (_activeDetailCharts[i]) { _activeDetailCharts[i].destroy(); delete _activeDetailCharts[i]; }
  });
  
  if (isOpen) return; // Was already open, just close
  
  panel.classList.add('open');
  mainRow.classList.add('expanded');

  // Lazy-render the mini chart — idx points into the FILTERED dataset
  // (with a filter or date range active, dailyData[idx] is a different day)
  const d = paginatedFilteredData[idx] || dailyData[idx];
  if (d) renderDetailChart(idx, d);
}

function renderDetailChart(idx, d) {
  const canvas = document.getElementById(`detailChart-${idx}`);
  if (!canvas || typeof Chart === 'undefined') return;
  
  const ctx = canvas.getContext('2d');
  // Theme lives in data-theme on <html>, not a body class
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const textColor = isDark ? '#a0a0a0' : '#666';

  if (_activeDetailCharts[idx]) _activeDetailCharts[idx].destroy();
  
  _activeDetailCharts[idx] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['FII Buy', 'FII Sell', 'FII Net', 'DII Buy', 'DII Sell', 'DII Net', 'Net Liq.'],
      datasets: [{
        data: d.p ? [null, null, d.fn, null, null, d.dn, d.fn + d.dn] : [d.fb, -d.fs, d.fn, d.db, -d.ds, d.dn, d.fn + d.dn],
        backgroundColor: [
          'rgba(10,209,166,0.7)', 'rgba(239,68,68,0.7)', d.fn >= 0 ? 'rgba(10,209,166,0.9)' : 'rgba(239,68,68,0.9)',
          'rgba(10,209,166,0.7)', 'rgba(239,68,68,0.7)', d.dn >= 0 ? 'rgba(10,209,166,0.9)' : 'rgba(239,68,68,0.9)',
          (d.fn + d.dn) >= 0 ? 'rgba(10,209,166,0.95)' : 'rgba(239,68,68,0.95)'
        ],
        borderRadius: 4,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: {
        callbacks: { label: (ctx) => fmt(Math.abs(ctx.raw)) }
      }},
      scales: {
        x: { grid: { display: false }, ticks: { color: textColor, font: { size: 9, weight: '600' } } },
        y: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 9 }, callback: v => fmt(v) }, border: { display: false } }
      }
    }
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  MATRIX VIEW TOGGLE (Table vs Visual Chart)
 * ═══════════════════════════════════════════════════════════════════════════ */

let _matrixChart = null;

function setMatrixView(mode) {
  const tableCont = document.getElementById('matrix-table-container');
  const chartCont = document.getElementById('matrix-chart-container');
  const btnTable = document.getElementById('btnViewTable');
  const btnChart = document.getElementById('btnViewChart');
  
  if (mode === 'chart') {
    if (tableCont) tableCont.style.display = 'none';
    if (chartCont) chartCont.classList.add('visible');
    if (btnTable) btnTable.classList.remove('active');
    if (btnChart) btnChart.classList.add('active');
    renderMatrixChart();
  } else {
    if (tableCont) tableCont.style.display = '';
    if (chartCont) chartCont.classList.remove('visible');
    if (btnTable) btnTable.classList.add('active');
    if (btnChart) btnChart.classList.remove('active');
  }
}

function renderMatrixChart() {
  const canvas = document.getElementById('matrixChart');
  if (!canvas || !dailyData.length || typeof Chart === 'undefined') return;
  
  const ctx = canvas.getContext('2d');
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const textColor = isDark ? '#a0a0a0' : '#666';

  // Take the data in chronological order (reversed from descending)
  const data = [...dailyData].reverse();
  const labels = data.map(d => d.d);
  const fiiNet = data.map(d => d.fn);
  const diiNet = data.map(d => d.dn);
  const totalLiq = data.map(d => d.fn + d.dn);
  
  if (_matrixChart) _matrixChart.destroy();
  
  _matrixChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'FII Net',
          data: fiiNet,
          backgroundColor: fiiNet.map(v => v >= 0 ? 'rgba(10,209,166,0.75)' : 'rgba(239,68,68,0.75)'),
          borderRadius: 3,
          borderSkipped: false,
          barPercentage: 0.35,
          categoryPercentage: 0.8,
          order: 2,
        },
        {
          label: 'DII Net',
          data: diiNet,
          backgroundColor: diiNet.map(v => v >= 0 ? 'rgba(10,209,166,0.4)' : 'rgba(239,68,68,0.4)'),
          borderRadius: 3,
          borderSkipped: false,
          barPercentage: 0.35,
          categoryPercentage: 0.8,
          order: 3,
        },
        {
          label: 'Net Liquidity',
          data: totalLiq,
          type: 'line',
          borderColor: isDark ? 'rgba(240,112,32,0.9)' : 'rgba(240,112,32,0.8)',
          backgroundColor: 'transparent',
          borderWidth: 2.5,
          pointRadius: 4,
          pointBackgroundColor: totalLiq.map(v => v >= 0 ? '#0ad1a6' : '#ef4444'),
          pointBorderColor: 'transparent',
          tension: 0.3,
          order: 1,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          labels: { color: textColor, font: { size: 11, weight: '600' }, usePointStyle: true, pointStyle: 'rectRounded', padding: 16 }
        },
        tooltip: {
          backgroundColor: isDark ? 'rgba(10,15,28,0.95)' : 'rgba(255,255,255,0.95)',
          titleColor: isDark ? '#fff' : '#111',
          bodyColor: isDark ? '#ccc' : '#444',
          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 8,
          callbacks: { label: (ctx) => `${ctx.dataset.label}: ${fmt(ctx.raw)}` }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: textColor, font: { size: 9, weight: '600' }, maxRotation: 45 }
        },
        y: {
          grid: { color: gridColor },
          ticks: { color: textColor, font: { size: 10 }, callback: v => fmt(v) },
          border: { display: false }
        }
      }
    }
  });
}

window.toggleSectorChart = function() {
    const card = document.getElementById('sec-chart-card');
    const btn = document.getElementById('btnToggleSecChart');
    if (card.style.display === 'none') {
        card.style.display = 'block';
        btn.innerHTML = 'Hide Sector Chart';
        if (!chartSector) renderSectorChart();
        setTimeout(() => card.scrollIntoView({behavior: 'smooth', block: 'start'}), 100);
    } else {
        card.style.display = 'none';
        btn.innerHTML = 'View Interactive Sector Chart';
    }
};

window.toggleFnoChart = function() {
    const cont = document.getElementById('fno-chart-container');
    const btn = document.getElementById('btnToggleFnoChart');
    if (cont.style.display === 'none') {
        cont.style.display = 'block';
        btn.innerHTML = 'Hide Positioning Chart';
        renderFnoHistoryChart();
        setTimeout(() => cont.scrollIntoView({behavior: 'smooth', block: 'center'}), 100);
    } else {
        cont.style.display = 'none';
        btn.innerHTML = 'Show Historical Positioning Chart';
    }
};

window.addEventListener('DOMContentLoaded', async () => {
  // Show loading state
  const btn = document.getElementById('btnRefresh');
  if (btn) btn.innerHTML = `Loading Data...`;

  try {
    const res = await fetch('/api/history-full');
    if (res.ok) {
        const fullData = await res.json();
        if (fullData && fullData.length > 0) {
            dailyData = fullData;
            console.log('[INIT] ✅ Loaded full history from API');
        }
    }
  } catch (err) {
      console.error('[INIT] Failed to load history API', err);
  }

  // Ultimate fallback if API offline
  if (!dailyData || dailyData.length === 0) {
      try {
          const fallbackRes = await fetch('https://raw.githubusercontent.com/MrChartist/fii-dii-data/main/data/history.json');
          if (fallbackRes.ok) {
              const rawHistory = await fallbackRes.json();
              // new Date("10-Jun-2026") is Invalid Date in Safari/Firefox — use the NSE parser
              dailyData = rawHistory.sort((a,b) => parseNSEDate(b.date) - parseNSEDate(a.date)).slice(0, 800).map(h => ({
                  d: h.date, fb: h.fii_buy || 0, fs: h.fii_sell || 0, fn: h.fii_net || 0,
                  db: h.dii_buy || 0, ds: h.dii_sell || 0, dn: h.dii_net || 0,
                  fii_idx_fut_long: h.fii_idx_fut_long, fii_idx_fut_short: h.fii_idx_fut_short,
                  fii_idx_call_long: h.fii_idx_call_long, fii_idx_call_short: h.fii_idx_call_short,
                  fii_idx_put_long: h.fii_idx_put_long, fii_idx_put_short: h.fii_idx_put_short,
                  fii_stk_fut_long: h.fii_stk_fut_long, fii_stk_fut_short: h.fii_stk_fut_short,
                  dii_idx_fut_long: h.dii_idx_fut_long, dii_idx_fut_short: h.dii_idx_fut_short,
                  dii_stk_fut_long: h.dii_stk_fut_long, dii_stk_fut_short: h.dii_stk_fut_short,
                  pcr: h.pcr, sentiment_score: h.sentiment_score
              }));
              console.log('[INIT] ✅ Loaded fallback history from GitHub');
          }
      } catch (e) {
          console.error('[INIT] Fallback failed', e);
      }
  }

  // Fetch Sector Data sequentially so UI is hydrated on click
  try {
      const secRes = await fetch('/api/sectors');
      if (secRes.ok) {
          const sdata = await secRes.json();
          if (sdata && sdata.length > 0) {
              SECTOR_DATA = sdata;
              console.log('[INIT] ✅ Loaded backend sector data');
              // Automatically render if on sector tab
              if (document.getElementById('t-sector').classList.contains('active')) {
                  renderSectors();
              }
              renderCommandCenter();
          }
      }
  } catch(e) { console.error('[INIT] Sectors API failed', e); }

  // Fake skeleton if absolutely nothing loads so UI doesn't crash
  if (!dailyData || dailyData.length === 0) {
      dailyData = [{ d:"N/A", fb:0, fs:0, fn:0, db:0, ds:0, dn:0 }];
  }

  if (btn) btn.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"></path></svg> Force Sync`;

  renderDashboard();
  renderCommandCenter();
  initCharts();
  renderIsoMatrix3D(); // Standalone 3D matrix render

  // Set status pill to LIVE after successful data load
  const sPill = document.getElementById('sPill');
  const sTxt  = document.getElementById('sTxt');
  if (dailyData && dailyData.length > 0 && dailyData[0].d !== 'N/A') {
    if (sPill) sPill.className = 'status-pill live';
    // If the latest session isn't today's, tell users when fresh data lands
    // instead of leaving them wondering whether the site is broken
    const istHour = (new Date().getUTCHours() + 5.5) % 24;
    let pillText = `LIVE &bull; ${dailyData[0].d}`;
    try {
      const parsed = parseNSEDate(dailyData[0].d);
      const istNow = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
      const sameDay = parsed && parsed.getFullYear() === istNow.getUTCFullYear() &&
        parsed.getMonth() === istNow.getUTCMonth() && parsed.getDate() === istNow.getUTCDate();
      if (!sameDay && istHour >= 9 && istHour < 18.5) {
        pillText = `${dailyData[0].d} &bull; today's data ~6 PM IST`;
      }
    } catch {}
    if (sTxt) sTxt.innerHTML = pillText;
  } else {
    if (sPill) sPill.className = 'status-pill err';
    if (sTxt)  sTxt.innerHTML  = 'NSE publishes ~6 PM IST — retry later';
  }

  scheduleNextRefresh();
  startCountdown();
  switchMainTab('t-hero'); // activate default tab panel
  initTour();
});

/* ── First-visit tour (3 steps, skippable, shown once) ── */
function replayTour() { try { localStorage.removeItem('tour_done'); } catch (e) {} initTour(true); }
function initTour(force) {
  try { if (!force && localStorage.getItem('tour_done')) return; } catch { if (!force) return; }
  const steps = [
    { t: '👋 Welcome to FII & DII Data', p: 'Every evening after market close, this dashboard shows whether Foreign Institutional Investors (FII) were net buyers or sellers of Indian equities — and whether Domestic Institutions (DII) absorbed the move. Green = buying, red = selling.' },
    { t: '📊 Go deeper in two taps', p: 'The F&O tab shows how institutions are positioned in derivatives (futures & options), Flow Analytics holds the full daily/weekly/monthly archive with filters and CSV export, and Sectors tracks where foreign money rotates fortnight by fortnight.' },
    { t: '🔔 Never refresh manually', p: 'Enable push alerts to get cash-flow, F&O and sector updates the moment they publish — plus an AI-written daily brief. Everything is free.' }
  ];
  let idx = 0;
  const overlay = document.createElement('div');
  overlay.className = 'tour-overlay';
  const render = () => {
    const s = steps[idx];
    overlay.innerHTML = `<div class="tour-card">
      ${idx === 0 && window.MCBrand ? `<div class="mc-tour-logo">${MCBrand.lockup({size:'footer'}).replace(/<span class="mc-lockup__product">.*$/,'</span>')}</div>` : ''}
      <div class="tour-dots">${steps.map((_, i) => `<span class="${i <= idx ? 'on' : ''}"></span>`).join('')}</div>
      <h3>${s.t}</h3><p>${s.p}</p>
      <div class="tour-actions">
        <button class="tour-btn" id="tourSkip">Skip</button>
        <button class="tour-btn primary" id="tourNext">${idx === steps.length - 1 ? 'Start exploring' : 'Next'}</button>
      </div></div>`;
    overlay.querySelector('#tourSkip').onclick = done;
    overlay.querySelector('#tourNext').onclick = () => { if (idx === steps.length - 1) done(); else { idx++; render(); } };
  };
  const done = () => { overlay.remove(); try { localStorage.setItem('tour_done', '1'); } catch {} };
  render();
  setTimeout(() => document.body.appendChild(overlay), force ? 50 : 1200);
}

// 3. Charts Render & Theme Logic
let chartHistory = null;
let _historyChartMode = 'daily'; // Default to daily since the matrix defaults to daily flows
let _cumulativeView = false;
let _niftyHist = null; // [{date:'DD-MMM-YYYY', close}] — lazy-loaded

function initCharts() {
  switchHistoryChart('daily');
}

function switchHistoryChart(mode) {
  _historyChartMode = mode;
  renderHistoryChart();
}

function setFlowView(cumulative) {
  _cumulativeView = cumulative;
  const bF = document.getElementById('btnFlowView');
  const bC = document.getElementById('btnCumView');
  const rng = document.getElementById('cumRange');
  if (bF) bF.classList.toggle('active', !cumulative);
  if (bC) bC.classList.toggle('active', cumulative);
  if (rng) rng.style.display = cumulative ? '' : 'none';
  if (cumulative && !_niftyHist) {
    fetch('/api/nifty-history').then(r => r.ok ? r.json() : null).then(rows => {
      if (Array.isArray(rows)) _niftyHist = rows;
      renderHistoryChart();
    }).catch(() => renderHistoryChart());
  } else {
    renderHistoryChart();
  }
}

/* Cumulative FII/DII flows with NIFTY 50 overlay — the flows-vs-index view */
function renderCumulativeChart(ctx, isLight, gridCol, tickCol, labelCol) {
  const rangeN = parseInt(document.getElementById('cumRange')?.value || '90', 10);
  let rows = [...dailyData].reverse(); // oldest → newest
  if (rangeN > 0) rows = rows.slice(-rangeN);

  const niftyByDate = {};
  (_niftyHist || []).forEach(r => { niftyByDate[r.date] = r.close; });

  let cf = 0, cd = 0;
  const labels = [], cumFii = [], cumDii = [], nifty = [];
  let lastNifty = null;
  rows.forEach(r => {
    cf += r.fn || 0; cd += r.dn || 0;
    labels.push(r.d); cumFii.push(Math.round(cf)); cumDii.push(Math.round(cd));
    if (niftyByDate[r.d] != null) lastNifty = niftyByDate[r.d];
    nifty.push(lastNifty); // carry forward over gaps so the line stays continuous
  });

  const datasets = [
    { label: 'Cumulative FII', data: cumFii, borderColor: '#FB3640', backgroundColor: 'rgba(251,54,64,0.08)', fill: true, tension: .25, pointRadius: 0, borderWidth: 2, yAxisID: 'y' },
    { label: 'Cumulative DII', data: cumDii, borderColor: isLight ? '#004643' : '#00D09E', backgroundColor: 'rgba(0,208,158,0.08)', fill: true, tension: .25, pointRadius: 0, borderWidth: 2, yAxisID: 'y' }
  ];
  const hasNifty = nifty.some(v => v != null);
  if (hasNifty) {
    datasets.push({ label: 'NIFTY 50', data: nifty, borderColor: isLight ? '#2563EB' : '#60A5FA', borderDash: [6, 4], fill: false, tension: .25, pointRadius: 0, borderWidth: 2, yAxisID: 'y1' });
  }

  chartHistory = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: labelCol, font: { size: 11, weight: '600' }, boxWidth: 14 } },
        tooltip: { callbacks: { label: c => c.dataset.yAxisID === 'y1'
          ? ` NIFTY 50: ${c.raw == null ? '—' : c.raw.toLocaleString('en-IN')}`
          : ` ${c.dataset.label}: ${fmt(c.raw)}` } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: tickCol, font: { size: 9 }, maxTicksLimit: 10 } },
        y: { grid: { color: gridCol }, ticks: { color: tickCol, font: { size: 9 }, callback: v => fmt(v) },
             title: { display: true, text: '₹ Crore (cumulative)', color: tickCol, font: { size: 10 } } },
        ...(hasNifty ? { y1: { position: 'right', grid: { display: false }, ticks: { color: tickCol, font: { size: 9 } },
             title: { display: true, text: 'NIFTY 50', color: tickCol, font: { size: 10 } } } } : {})
      }
    }
  });
}

function renderHistoryChart() {
  if (typeof Chart === 'undefined') return; // chart lib failed to load — keep the page alive
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const gridCol = isLight ? 'rgba(0,15,8,0.05)' : 'rgba(240,237,229,0.05)';
  const tickCol = isLight ? 'rgba(0,15,8,0.5)' : 'rgba(240,237,229,0.5)';
  const labelCol = isLight ? 'rgba(0,15,8,0.8)' : 'rgba(240,237,229,0.8)';
  const fiiCol = isLight ? '#FB3640' : '#FB3640'; // Imperial Red
  const diiCol = isLight ? '#004643' : '#00D09E'; // Cyprus Green (light) / Mint (dark)
  const netCol = isLight ? '#2563EB' : '#60A5FA'; // Blue for net liquidity

  if (chartHistory) chartHistory.destroy();

  const canvasEl = document.getElementById('chHistory');
  if (!canvasEl) return;
  const ctx = canvasEl.getContext('2d');

  if (_cumulativeView) return renderCumulativeChart(ctx, isLight, gridCol, tickCol, labelCol);

  let sourceData = [];
  let lblKey = '';
  
  if (_historyChartMode === 'daily') {
    sourceData = [...dailyData].reverse();
    lblKey = 'd';
  } else if (_historyChartMode === 'weekly') {
    sourceData = [...weeklyData].reverse();
    lblKey = 'w';
  } else if (_historyChartMode === 'monthly') {
    sourceData = [...monthlyData].reverse();
    lblKey = 'm';
  } else if (_historyChartMode === 'annual') {
    sourceData = [...yearlyData].reverse();
    lblKey = 'y';
  }

  const lbls = sourceData.map(d => d[lblKey]);
  const fiiFlows = sourceData.map(d => d.fn);
  const diiFlows = sourceData.map(d => d.dn);
  const netFlows = sourceData.map(d => d.fn + d.dn);

  chartHistory = new Chart(ctx, {
    type: 'bar', // Mixed chart
    data: {
      labels: lbls,
      datasets: [
        {
          type: 'line',
          label: 'Net Liquidity',
          data: netFlows,
          borderColor: netCol,
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: netCol,
          tension: 0.3,
          yAxisID: 'y'
        },
        {
          type: 'bar',
          label: 'FII Net Flow',
          data: fiiFlows,
          backgroundColor: fiiCol,
          borderRadius: 4,
          borderSkipped: false,
          yAxisID: 'y'
        },
        {
          type: 'bar',
          label: 'DII Net Flow',
          data: diiFlows,
          backgroundColor: diiCol,
          borderRadius: 4,
          borderSkipped: false,
          yAxisID: 'y'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false }, // Using custom HTML legend above it
        tooltip: {
          callbacks: {
            label: ctx => {
              const sign = ctx.raw >= 0 ? '+' : '';
              return ` ${ctx.dataset.label}: ${sign}₹${Math.abs(ctx.raw).toLocaleString('en-IN')} Cr`;
            }
          }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: tickCol, maxTicksLimit: 14 } },
        y: {
          grid: { color: gridCol, drawBorder: false },
          ticks: { color: tickCol, callback: v => (v >= 0 ? '+' : '') + (v/1000).toFixed(0) + 'k' },
          title: { display: true, text: '₹ Crore', color: tickCol, font: { size: 10 } }
        }
      }
    }
  });
}

function toggleTheme() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  try { localStorage.setItem('theme', isDark ? 'light' : 'dark'); } catch {}
  document.getElementById('btnTheme').innerHTML = isDark
    ? `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg> Dark Mode`
    : `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path></svg> Light Mode`;
  renderHistoryChart();
  if (chartSector) renderSectorChart();
  renderCommandCenter();
}



/* ═══════════════════════════════════════════════════════════════════
   SECTOR FLOW  —  NSDL Fortnightly FPI Data (BSE ~22-Sector Classification)
   Source: NSDL fortnightly FPI sector-wise investment reports
   ═══════════════════════════════════════════════════════════════════ */

let SECTOR_DATA = [];

let _sectorSortKey = 'aum';

function _fmtCr(v) {
  const abs = Math.abs(v), sign = v >= 0 ? '+' : '-';
  return abs >= 1000 ? sign + '₹' + (abs / 1000).toFixed(1) + 'K Cr'
                     : sign + '₹' + abs.toLocaleString('en-IN') + ' Cr';
}

function renderSectors() {
  const grid = document.getElementById('sector-grid');
  if (!grid) return;
  const data = [...SECTOR_DATA];
  if (_sectorSortKey === 'aum')   data.sort((a, b) => b.aumPct - a.aumPct);
  if (_sectorSortKey === 'fort')  data.sort((a, b) => b.fortnightCr - a.fortnightCr);
  if (_sectorSortKey === '1y')    data.sort((a, b) => b.oneYearCr - a.oneYearCr);
  if (_sectorSortKey === 'alpha') data.sort((a, b) => a.name.localeCompare(b.name));

  grid.innerHTML = data.map((s, idx) => {
    const isBull = s.fortnightCr >= 0;
    const fortClass = isBull ? 'bull' : 'bear';
    const fortStr = (isBull ? '▲ ' : '▼ ') + Math.abs(s.fortnightCr).toLocaleString('en-IN') + ' Cr';
    const net1yStr = _fmtCr(s.oneYearCr);

    const origIdx = SECTOR_DATA.indexOf(s);
    // Both figures come straight from the NSDL reports
    const st = s.streak || 0, stN = Math.abs(st);
    const streakStr = stN >= 1 ? `${stN} fortnight${stN > 1 ? 's' : ''} of ${st > 0 ? 'inflow' : 'outflow'}` : 'no streak';
    const streakHtml = `<span class="sc-own" title="Consecutive fortnightly reports with net FPI ${st >= 0 ? 'inflow' : 'outflow'}"><b class="${st > 0 ? 't-green' : st < 0 ? 't-red' : ''}">${streakStr}</b></span>`;
    const fp = s.flowPctAuc;
    const intensityVal = (fp === null || fp === undefined)
      ? '<span style="color:var(--t4)">n/a</span>'
      : `<span class="${fp >= 0 ? 't-green' : 't-red'}">${fp >= 0 ? '+' : '−'}${Math.abs(fp).toFixed(2)}%</span>`;
    return `<div class="sector-card" role="button" tabindex="0" aria-label="${escapeHtml(s.name)}: ${s.aumPct.toFixed(1)}% of AUM, fortnight ${fortStr}" onclick="openSectorModal(${origIdx})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openSectorModal(${origIdx});}">
      <div class="sc-head">
        <div class="sc-name" title="${escapeHtml(s.name)}">${escapeHtml(s.name)}</div>
        <div class="sc-fortnight ${fortClass}" title="Net FPI flow this fortnight">${fortStr}</div>
      </div>
      <div class="sc-meta"><span class="sc-aum-pct">${s.aumPct.toFixed(1)}% of AUM</span>${streakHtml}</div>
      <div class="sc-chart-wrapper"><canvas id="sc-chart-${origIdx}" width="100%" height="45"></canvas></div>
      <div class="sc-foot">
        <div><div class="sc-k">1Y structural flow</div><div class="sc-v">${net1yStr.replace('+', '')}</div></div>
        <div class="sc-right"><div class="sc-k" title="This fortnight's net flow as a share of FPI holdings in the sector">Flow vs holdings</div><div class="sc-v">${intensityVal}</div></div>
      </div>
    </div>`;
  }).join('');

  filterSectorCards(document.getElementById('sectorSearch')?.value || '');
  renderSectorGlance();

  // Render the sparklines after injecting the DOM
  setTimeout(() => {
    data.forEach((s) => { // Use original index for canvas ID mapping
      const origIdx = SECTOR_DATA.indexOf(s);
      drawSectorSparkline(`sc-chart-${origIdx}`, s);
    });
  }, 50);
}

/* Rotation at a glance: the three biggest fortnight inflows and outflows, tap to open */
function renderSectorGlance() {
  const box = document.getElementById('sectorGlance'); if (!box || !SECTOR_DATA.length) return;
  const sorted = [...SECTOR_DATA].sort((a, b) => b.fortnightCr - a.fortnightCr);
  const chip = (s, dir) => `<button type="button" class="mc-chip capsule ${dir}" onclick="openSectorModal(${SECTOR_DATA.indexOf(s)})" title="${escapeHtml(s.name)}">${escapeHtml(s.name === 'Others' ? 'Unclassified' : s.name)} <b>${dir === 'bull' ? '+' : '−'}${_fmtCr(Math.abs(s.fortnightCr)).replace('+', '')}</b></button>`;
  const ins = sorted.filter(s => s.fortnightCr > 0).slice(0, 3), outs = sorted.filter(s => s.fortnightCr < 0).slice(-3).reverse();
  document.getElementById('glanceIn').innerHTML = ins.length ? ins.map(s => chip(s, 'bull')).join('') : '<span class="mc-note">None this fortnight</span>';
  document.getElementById('glanceOut').innerHTML = outs.length ? outs.map(s => chip(s, 'bear')).join('') : '<span class="mc-note">None this fortnight</span>';
  box.hidden = false;
}

/* Filter the sector cards by name (search box in the Sectors header) */
function filterSectorCards(q) {
  const grid = document.getElementById('sector-grid'); if (!grid) return;
  const needle = String(q || '').trim().toLowerCase();
  let shown = 0, total = 0;
  grid.querySelectorAll('.sector-card').forEach(card => {
    total++;
    const name = (card.querySelector('.sc-name')?.textContent || '').toLowerCase();
    const hit = !needle || name.includes(needle);
    card.hidden = !hit; if (hit) shown++;
  });
  let empty = grid.querySelector('.mc-sec-empty');
  if (!shown && total) {
    if (!empty) { empty = document.createElement('div'); empty.className = 'mc-sec-empty'; grid.appendChild(empty); }
    empty.textContent = `No sector matches "${q.trim()}".`;
  } else if (empty) empty.remove();
  const c = document.getElementById('sectorCount');
  if (c) c.textContent = total ? (needle ? `${shown} of ${total} sectors` : `${total} sectors`) : '';
}

let sectorZoomChartInstance = null;
function openSectorModal(origIdx) {
  const s = SECTOR_DATA[origIdx];
  if (!s) return;

  const modal = document.getElementById('sector-zoom-modal');
  document.getElementById('sz-title').innerText = s.name;
  try { history.replaceState(null, '', '#t-sector?s=' + encodeURIComponent(s.name)); } catch (e) {}
  
  const streakEl = document.getElementById('sz-alpha');
  const _st = s.streak || 0, _stN = Math.abs(_st);
  streakEl.innerText = _stN >= 1 ? `${_stN} fortnight${_stN > 1 ? 's' : ''} of net ${_st > 0 ? 'inflow' : 'outflow'}` : 'No flow streak';
  streakEl.className = 'sz-alpha ' + (_st > 0 ? 'out' : _st < 0 ? 'under' : '');

  // Populate stats row
  document.getElementById('sz-1ycr').innerText = _fmtCr(s.oneYearCr);
  document.getElementById('sz-1ycr').className = 'sz-stat-value ' + (s.oneYearCr >= 0 ? 't-green' : 't-red');
  document.getElementById('sz-aum').innerText = s.aumPct.toFixed(1) + '%';
  const _fpEl = document.getElementById('sz-fiiown');
  const _fp = s.flowPctAuc;
  _fpEl.innerText = (_fp === null || _fp === undefined) ? '—' : `${_fp >= 0 ? '+' : '−'}${Math.abs(_fp).toFixed(2)}%`;
  _fpEl.className = 'sz-stat-value ' + ((_fp || 0) >= 0 ? 't-green' : 't-red');
  _fpEl.title = "This fortnight's net flow as a share of FPI holdings in the sector";
  const fortEl = document.getElementById('sz-fortnight');
  fortEl.innerText = _fmtCr(s.fortnightCr);
  fortEl.className = 'sz-stat-value ' + (s.fortnightCr >= 0 ? 't-green' : 't-red');

  // Render chart
  const ctx = document.getElementById('sz-chart').getContext('2d');
  if (sectorZoomChartInstance) sectorZoomChartInstance.destroy();

  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const greenColor = isLight ? '#059669' : '#30b86a';
  const redColor = isLight ? '#DC2626' : '#d94848';

  // Use historyCr from backend if available, else generate visual fallback
  const points = 24;
  let chartData = s.historyCr ? [...s.historyCr] : [];
  if (!chartData.length) {
      for (let i = 0; i < points; i++) {
        const progress = (i+1)/points;
        const noise = (Math.random() - 0.5) * (Math.abs(s.oneYearCr) * 0.4);
        chartData.push(Math.round((s.oneYearCr * Math.pow(progress, 1.5)) + noise));
      }
      chartData[points-1] = s.oneYearCr;
  }

  sectorZoomChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
          labels: Array.from({length: chartData.length}, (_, i) => {
              const weeksAgo = chartData.length - i;
              return weeksAgo === 1 ? 'Latest' : `FN -${weeksAgo}`;
          }),
          datasets: [{
              label: 'Cumulative Flow (₹ Cr)',
              data: chartData,
              borderColor: greenColor,
              segment: {
                  borderColor: ctx => ctx.p1.parsed.y < 0 ? redColor : greenColor,
              },
              backgroundColor: greenColor + '40',
              fill: {
                  target: 'origin',
                  above: greenColor + '40',
                  below: redColor + '40'
              },
              borderWidth: 2.5,
              tension: 0.35,
              pointRadius: 3,
              pointHoverRadius: 7,
              pointBackgroundColor: ctx => ctx.raw < 0 ? redColor : greenColor,
              pointBorderColor: isLight ? '#fff' : '#1a1e27',
              pointBorderWidth: 2,
              pointHoverBorderWidth: 3,
              pointHoverBackgroundColor: '#fff',
              pointHoverBorderColor: ctx => ctx.raw < 0 ? redColor : greenColor
          }]
      },
      options: {
          responsive: true, maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: isLight ? 'rgba(255,255,255,0.97)' : 'rgba(20,24,32,0.98)',
                titleColor: isLight ? '#6b6158' : '#8B95A5',
                bodyColor: isLight ? '#1a1612' : '#FFFFFF',
                borderColor: isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.08)',
                borderWidth: 1, padding: 14, cornerRadius: 10,
                displayColors: false,
                titleFont: { family: "'Plus Jakarta Sans', sans-serif", size: 12, weight: '700' },
                bodyFont: { family: "'Inter', sans-serif", size: 15, weight: '800' },
                callbacks: {
                    title: (items) => items[0]?.label || '',
                    label: (ctx) => `Net Flow: ₹${Math.round(ctx.raw).toLocaleString('en-IN')} Cr`
                }
              }
          },
          scales: {
              x: {
                  grid: { display: false },
                  ticks: {
                      color: isLight ? 'rgba(0,15,8,0.4)' : 'rgba(240,237,229,0.35)',
                      font: { size: 10, weight: '600' },
                      maxRotation: 0, autoSkip: true, maxTicksLimit: 8
                  }
              },
              y: {
                  grid: { color: isLight ? 'rgba(0,15,8,0.05)' : 'rgba(240,237,229,0.05)', drawBorder: false },
                  ticks: {
                      color: isLight ? 'rgba(0,15,8,0.5)' : 'rgba(240,237,229,0.5)',
                      font: { size: 11, weight: 'bold' },
                      callback: v => (v>=0?'+':'') + (Math.abs(v)>=1000?(v/1000).toFixed(1)+'K':v)
                  }
              }
          }
      }
  });

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeSectorModal() {
  const modal = document.getElementById('sector-zoom-modal');
  if (!modal.classList.contains('active')) return;
  modal.classList.remove('active');
  document.body.style.overflow = '';
  try { if (/^#t-sector\?/.test(location.hash)) history.replaceState(null, '', '#t-sector'); } catch (e) {}
}
function copySectorLink() {
  const url = location.origin + location.pathname + location.hash;
  const done = () => (window.mcToast || alert)('Link copied. It opens straight to this sector.');
  if (navigator.clipboard) navigator.clipboard.writeText(url).then(done).catch(() => prompt('Copy this link', url)); else prompt('Copy this link', url);
}
/* open a sector from a shared link: /#t-sector?s=Financial%20Services */
const _initialHash = location.hash || '';
function openSectorFromHash() {
  const m = /^#t-sector\?s=(.+)$/.exec(_initialHash); if (!m) return;
  const name = decodeURIComponent(m[1]).toLowerCase();
  let tries = 0;
  const go = () => {
    const idx = SECTOR_DATA.findIndex(x => x.name.toLowerCase() === name);
    if (idx >= 0) { switchMainTab('t-sector'); try { renderSectors(); } catch (e) {} setTimeout(() => openSectorModal(idx), 350); }
    else if (++tries < 40) setTimeout(go, 250);
  };
  go();
}
window.addEventListener('load', () => setTimeout(openSectorFromHash, 500));

// Escape key to close modal
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeSectorModal();
});

let sectorSparklines = {};
function drawSectorSparkline(canvasId, sectorObj) {
  const ctx = document.getElementById(canvasId)?.getContext('2d');
  if (!ctx) return;
  
  if (sectorSparklines[canvasId]) {
    sectorSparklines[canvasId].destroy();
  }

  // Plot the REAL cumulative FPI flow from the per-fortnight history
  // (was previously a randomly simulated curve, regenerated on every render)
  const target = sectorObj.oneYearCr;
  const isPositive = target >= 0;
  let chartData = [];
  if (Array.isArray(sectorObj.historyCr) && sectorObj.historyCr.length) {
    let cum = 0;
    chartData = sectorObj.historyCr.map(v => { cum += (v || 0); return cum; });
  } else {
    chartData = [0, target]; // no history — straight line to the 1Y total
  }

  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const greenColor = isLight ? '#059669' : '#30b86a';
  const redColor = isLight ? '#DC3545' : '#FF5252';

  sectorSparklines[canvasId] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: Array.from({length: chartData.length}, (_, i) => i),
      datasets: [{
        data: chartData,
        borderColor: greenColor,
        segment: {
            borderColor: ctx => ctx.p1.parsed.y < 0 ? redColor : greenColor
        },
        borderWidth: 1.5,
        backgroundColor: greenColor + '40',
        fill: {
            target: 'origin',
            above: greenColor + '40',
            below: redColor + '40'
        },
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { 
        legend: { display: false }, 
        tooltip: { 
          enabled: true,
          displayColors: false,
          backgroundColor: isLight ? 'rgba(255,255,255,0.95)' : 'rgba(26,30,39,0.95)',
          titleColor: isLight ? '#8B95A5' : '#8B95A5',
          bodyColor: isLight ? '#1a1612' : '#FFFFFF',
          borderColor: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)',
          borderWidth: 1,
          padding: 10,
          cornerRadius: 8,
          titleFont: { family: "'Plus Jakarta Sans', sans-serif", size: 10, weight: 'bold' },
          bodyFont: { family: "'Inter', sans-serif", size: 14, weight: 'bold' },
          callbacks: {
            title: () => 'Cumulative Track',
            label: function(context) {
              const val = context.raw;
              const sign = val >= 0 ? '+' : '';
              return sign + '₹' + Math.abs(val).toLocaleString('en-IN', {maximumFractionDigits:0}) + ' Cr';
            }
          }
        } 
      },
      scales: {
        x: { display: false },
        y: { display: false } 
      },
      animation: { duration: 0 } 
    }
  });
}

function sortSectors(key) {
  _sectorSortKey = key;
  ['aum', 'fort', '1y', 'alpha'].forEach(k => {
    const b = document.getElementById('sec-sort-' + k);
    if (b) b.classList.toggle('active', k === key);
  });
  renderSectors();
}

/* ── SECTOR CHARTS ── */
let chartSector = null;
let _secMetric    = 'aum';
let _secChartType = 'bar';

const SEC_EXPLAIN = {
  aum:  `<strong style="color:var(--blue)">Portfolio Weight (AUM %)</strong> — Each bar shows a sector's share of the <em>total FPI equity AUM in India</em> (NSDL depository data). Financial Services dominates at ~29% because FPIs structurally overweight India's largest banks and NBFCs. Information Technology (~17%) is the second pillar, driven by global tech mandates. The long tail of small sectors below 3% are highly sensitive to FPI flows as even modest buying/selling can swing their weights significantly.`,
  fort: `<strong style="color:var(--blue)">Fortnight Net Flow (₹ Crore)</strong> — Net FPI inflows (+) and outflows (−) over the most recent 15-day NSDL reporting window. Green bars = FPIs added exposure. Red bars = FPIs reduced exposure. These short-term moves often reflect global risk-on/off sentiment rather than fundamental sector views. Large negative readings in Financial Services are common during global deleveraging episodes.`,
  '1y': `<strong style="color:var(--blue)">12-Month Net Flow (₹ Crore)</strong> — Cumulative FPI net flows by sector over the rolling 12-month period. This reveals <em>structural allocation shifts</em> — which sectors FPIs have been persistently building or trimming. A sector with a large negative 12-month flow but stable AUM% means DIIs/retail have been absorbing the FPI selling. IT and Healthcare typically see sustained inflows as they attract global tech and pharma mandates.`
};

function renderSectorChart() {
  const canvas = document.getElementById('chSector');
  if (!canvas) return;

  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const metric  = _secMetric;
  const ctype   = _secChartType;

  // Build sorted dataset — top 15 by absolute magnitude of selected metric
  let data = [...SECTOR_DATA];
  if (metric === 'aum')  data.sort((a, b) => b.aumPct - a.aumPct);
  if (metric === 'fort') data.sort((a, b) => Math.abs(b.fortnightCr) - Math.abs(a.fortnightCr));
  if (metric === '1y')   data.sort((a, b) => Math.abs(b.oneYearCr)   - Math.abs(a.oneYearCr));
  data = data.slice(0, 15);

  // Axis: bar chart → horizontal (better for long sector names); line → vertical
  const isHoriz = ctype === 'bar';

  // Labels: emoji + short name
  const labels = data.map(s => s.emoji + ' ' + (s.name.length > 18 ? s.name.slice(0, 16) + '…' : s.name));

  // Values and colours
  let values, bgColors, borderColors, chartLabel;

  const gBg  = isLight ? 'rgba(8,115,78,0.70)'   : 'rgba(13,212,164,0.70)';
  const rBg  = isLight ? 'rgba(196,29,41,0.70)'  : 'rgba(240,72,72,0.70)';
  const gBrd = isLight ? 'rgba(8,115,78,1)'      : 'rgba(13,212,164,1)';
  const rBrd = isLight ? 'rgba(196,29,41,1)'     : 'rgba(240,72,72,1)';
  const bBg  = isLight ? 'rgba(105, 91, 184, 0.70)'  : 'rgba(105, 91, 184, 0.70)';
  const bBrd = isLight ? 'rgba(105, 91, 184, 1)'     : 'rgba(105, 91, 184, 1)';

  let datasets = [];
  let chartOptions = {};

  // Theme-aware chart colours
  const gridCol  = isLight ? 'rgba(0,0,0,0.05)'        : 'rgba(255,255,255,0.05)';
  const tickCol  = isLight ? 'rgba(15,15,14,0.45)'     : 'rgba(239,242,247,0.45)';
  const labelCol = isLight ? 'rgba(15,15,14,0.70)'     : 'rgba(239,242,247,0.70)';

  if (ctype === 'scatter') {
    // Advanced Scatter/Bubble Chart: X=AUM, Y=1Y Flow, R=Fortnight Flow
    datasets = [{
      label: 'Sector Flow Matrix',
      data: data.map(s => ({
        x: s.aumPct,
        y: s.oneYearCr,
        r: Math.max(4, Math.sqrt(Math.abs(s.fortnightCr)) * 0.4), // Size bubbles by fortnight intensity
        sector: s
      })),
      backgroundColor: data.map(s => s.oneYearCr >= 0 ? gBg : rBg),
      borderColor: data.map(s => s.oneYearCr >= 0 ? gBrd : rBrd),
      borderWidth: 1.5,
      hoverRadius: 8
    }];

    chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: isLight ? 'rgba(255,255,255,0.95)' : 'rgba(26,30,39,0.95)',
          titleColor: isLight ? '#8B95A5' : '#8B95A5',
          bodyColor: isLight ? '#384051' : '#FFFFFF',
          borderColor: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)',
          borderWidth: 1, padding: 12, cornerRadius: 8,
          titleFont: { family: "'Plus Jakarta Sans', sans-serif", size: 12, weight: 'bold' },
          bodyFont: { family: "'Inter', sans-serif", size: 13, weight: '500' },
          displayColors: false,
          callbacks: {
            title: (items) => items[0].raw.sector.emoji + ' ' + items[0].raw.sector.name,
            label: (ctx) => {
              const s = ctx.raw.sector;
              return [
                `Weight: ${s.aumPct}% of FPI AUM`,
                `1Y Flow: ${_fmtCr(s.oneYearCr)}`,
                `15-Day Δ: ${_fmtCr(s.fortnightCr)}`
              ];
            }
          }
        }
      },
      scales: {
        x: { 
          title: { display: true, text: 'AUM Weight (%)', color: labelCol, font: {weight: 'bold'} },
          grid: { color: gridCol }, ticks: { color: tickCol } 
        },
        y: { 
          title: { display: true, text: 'Rolling 12M Net Flow (₹ Cr)', color: labelCol, font: {weight: 'bold'} },
          grid: { color: gridCol }, ticks: { color: tickCol, callback: v => (v >= 0 ? '+' : '') + (Math.abs(v) >= 1000 ? (v/1000).toFixed(1)+'K' : v) } 
        }
      }
    };
  } else {
    // Bar or Line Chart Logic
    if (metric === 'aum') {
      values      = data.map(s => s.aumPct);
      bgColors    = data.map(() => bBg);
      borderColors = data.map(() => bBrd);
      chartLabel  = 'FPI Portfolio Weight (%)';
    } else if (metric === 'fort') {
      values      = data.map(s => s.fortnightCr);
      bgColors    = data.map(s => s.fortnightCr >= 0 ? gBg : rBg);
      borderColors = data.map(s => s.fortnightCr >= 0 ? gBrd : rBrd);
      chartLabel  = 'Fortnight Net Flow (₹ Cr)';
    } else {
      values      = data.map(s => s.oneYearCr);
      bgColors    = data.map(s => s.oneYearCr >= 0 ? gBg : rBg);
      borderColors = data.map(s => s.oneYearCr >= 0 ? gBrd : rBrd);
      chartLabel  = '12-Month Net Flow (₹ Cr)';
    }

    datasets = [{
      label: chartLabel,
      data: values,
      backgroundColor: ctype === 'bar' ? bgColors : bgColors.map(c => c.replace(/[\d.]+\)$/, '0.12)')),
      borderColor: borderColors,
      borderWidth: ctype === 'line' ? 2.5 : 1,
      borderRadius: ctype === 'bar' ? 4 : 0,
      borderSkipped: false,
      pointRadius: ctype === 'line' ? 5 : 0,
      pointHoverRadius: ctype === 'line' ? 8 : 0,
      pointBackgroundColor: borderColors,
      pointBorderColor: '#fff',
      pointBorderWidth: 1.5,
      fill: ctype === 'line',
      tension: 0.35,
    }];

    chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: isHoriz ? 'y' : 'x',
      onClick(evt, elements) {
        if (!elements.length) return;
        const idx = elements[0].index;
        const s = data[idx];
        if (!s) return;
        const explainer = document.getElementById('sec-chart-explainer');
        if (explainer) {
          const fc  = s.fortnightCr >= 0 ? gBrd : rBrd;
          const yc  = s.oneYearCr   >= 0 ? gBrd : rBrd;
          explainer.innerHTML = `
            <strong style="color:var(--blue)">${s.emoji} ${s.name}</strong>
            &nbsp;—&nbsp;AUM <strong>${s.aumPct.toFixed(1)}%</strong> of FPI portfolio
            &nbsp;·&nbsp;Fortnight: <strong style="color:${fc}">${_fmtCr(s.fortnightCr)}</strong>
            &nbsp;·&nbsp;12-Month: <strong style="color:${yc}">${_fmtCr(s.oneYearCr)}</strong>
            <span style="float:right; font-size:10px; opacity:0.6;">📅 ${s.lastDate}</span>`;
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: isLight ? 'rgba(255,255,255,0.95)' : 'rgba(26,30,39,0.95)',
          titleColor: isLight ? '#8B95A5' : '#8B95A5',
          bodyColor: isLight ? '#384051' : '#FFFFFF',
          borderColor: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 8,
          titleFont: { family: "'Plus Jakarta Sans', sans-serif", size: 11, weight: 'bold' },
          bodyFont: { family: "'Inter', sans-serif", size: 14, weight: 'bold' },
          displayColors: false,
          callbacks: {
            label(ctx) {
              const v = ctx.raw;
              if (metric === 'aum') return `  ${v.toFixed(1)}% of FPI portfolio`;
              return `  ${v >= 0 ? '+' : ''}₹${Math.abs(v).toLocaleString('en-IN')} Cr`;
            },
            title(items) { return items[0].label.replace(/^.{1,2}\s/, ''); }
          }
        }
      },
      scales: isHoriz ? {
        x: {
          grid: { color: gridCol, drawBorder: false },
          ticks: { color: tickCol, font: { size: 12, weight: '600' } },
        },
        y: {
          grid: { display: false },
          ticks: { color: labelCol, font: { size: 13, weight: '700' }, mirror: false },
        }
      } : {
        x: {
          grid: { display: false },
          ticks: { color: tickCol, font: { size: 12, weight: '600' }, maxRotation: 40, minRotation: 30 },
        },
        y: {
          grid: { color: gridCol, drawBorder: false },
          ticks: {
            color: tickCol, font: { size: 13, weight: '700' },
            callback(v) {
              if (metric === 'aum') return v + '%';
              return (v >= 0 ? '+' : '') + (Math.abs(v) >= 1000 ? (v/1000).toFixed(1)+'K' : v);
            }
          },
        }
      }
    };
  }

  // Dynamic canvas height - ZOOMED IN
  const wrap = document.getElementById('sec-chart-wrap');
  if (wrap && ctype !== 'scatter') wrap.style.height = isHoriz ? Math.max(450, data.length * 42) + 'px' : '450px';
  if (wrap && ctype === 'scatter') wrap.style.height = '550px';

  if (chartSector) { chartSector.destroy(); chartSector = null; }

  const ctx = canvas.getContext('2d');
  chartSector = new Chart(ctx, {
    type: ctype === 'scatter' ? 'bubble' : ctype,
    data: {
      labels: ctype === 'scatter' ? [] : labels,
      datasets: datasets
    },
    options: chartOptions
  });

  // Update explainer text (metric-level explanation)
  const explainer = document.getElementById('sec-chart-explainer');
  if (ctype !== 'scatter' && explainer && !explainer.innerHTML.includes('strong style="color:var(--blue)">' + data[0]?.emoji)) {
    explainer.innerHTML = SEC_EXPLAIN[metric] || '';
  } else if (ctype === 'scatter' && explainer) {
    explainer.innerHTML = `<strong style="color:var(--primary)">Scatter Math Matrix</strong> — Visualizing flow magnitudes vs AUM weight mapping. Bubble size represents 15-day flow intensity.`;
  }
}

function switchSectorMetric(m) {
  _secMetric = m;
  ['aum', 'fort', '1y'].forEach(k => {
    const el = document.getElementById('sc-m-' + k);
    if (el) el.classList.toggle('active', k === m);
  });
  // Reset explainer to metric-level text on metric switch
  const explainer = document.getElementById('sec-chart-explainer');
  if (explainer && _secChartType !== 'scatter') explainer.innerHTML = SEC_EXPLAIN[m] || '';
  renderSectorChart();
}

function switchSectorChartType(t) {
  _secChartType = t;
  ['bar', 'line', 'scatter'].forEach(k => {
    const el = document.getElementById('sc-t-' + k);
    if (el) el.classList.toggle('active', k === t);
  });
  renderSectorChart();
}

let fnoHistoryChart = null;
let _fnoHistoryMode = 'fii-fut';

/* ── FII long-short ratio time series with percentile bands ── */
let _lsRatioChart = null;
function renderLsRatioChart() {
  const canvas = document.getElementById('chLsRatio');
  if (!canvas || !dailyData.length || typeof Chart === 'undefined') return;

  // Build the ratio series from sessions that have futures OI (oldest → newest)
  const rows = [...dailyData].reverse().filter(d => (d.fii_idx_fut_long || 0) > 0 && (d.fii_idx_fut_short || 0) > 0);
  if (rows.length < 5) return;
  const labels = rows.map(d => d.d);
  const ratios = rows.map(d => Math.round((d.fii_idx_fut_long / d.fii_idx_fut_short) * 100) / 100);

  // 10th / 90th percentile of the series' own history
  const sorted = [...ratios].sort((a, b) => a - b);
  const pct = q => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(q * (sorted.length - 1))))];
  const p10 = pct(0.10), p90 = pct(0.90);

  const nowEl = document.getElementById('lsRatioNow');
  if (nowEl) {
    const cur = ratios[ratios.length - 1];
    const zone = cur >= p90 ? 'top 10% of readings, unusually long' : cur <= p10 ? 'bottom 10% of readings, unusually short' : 'within normal band';
    nowEl.textContent = `Now: ${cur} (${zone})`;
  }

  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const tickCol = isLight ? 'rgba(0,15,8,0.5)' : 'rgba(240,237,229,0.5)';
  const gridCol = isLight ? 'rgba(0,15,8,0.05)' : 'rgba(240,237,229,0.05)';

  if (_lsRatioChart) _lsRatioChart.destroy();
  _lsRatioChart = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Long-Short Ratio', data: ratios, borderColor: isLight ? '#7c3aed' : '#a78bfa', backgroundColor: 'rgba(139,92,246,0.08)', fill: true, tension: .25, pointRadius: 0, borderWidth: 2 },
        { label: '90th pctile', data: labels.map(() => p90), borderColor: 'rgba(239,68,68,0.45)', borderDash: [4, 4], pointRadius: 0, borderWidth: 1, fill: false },
        { label: '10th pctile', data: labels.map(() => p10), borderColor: 'rgba(10,209,166,0.45)', borderDash: [4, 4], pointRadius: 0, borderWidth: 1, fill: '-1', backgroundColor: isLight ? 'rgba(0,15,8,0.03)' : 'rgba(240,237,229,0.03)' }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${c.raw}` } } },
      scales: {
        x: { grid: { display: false }, ticks: { color: tickCol, font: { size: 9 }, maxTicksLimit: 10 } },
        y: { grid: { color: gridCol }, ticks: { color: tickCol, font: { size: 9 } }, title: { display: true, text: 'Long ÷ Short', color: tickCol, font: { size: 10 } } }
      }
    }
  });
}

function renderFnoHistoryChart(mode = _fnoHistoryMode) {
  _fnoHistoryMode = mode;
  
  // Update toggle UI
  const tabs = ['fii-fut', 'fii-call', 'fii-put', 'dii-fut'];
  tabs.forEach(t => {
    const el = document.getElementById('fno-tab-' + t);
    if(el) el.classList.toggle('active', t === mode);
  });

  const canvas = document.getElementById('chFnoHistory');
  if(!canvas) return;
  
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const gridCol = isLight ? 'rgba(0,15,8,0.05)' : 'rgba(240,237,229,0.05)';
  const tickCol = isLight ? 'rgba(0,15,8,0.5)'  : 'rgba(240,237,229,0.5)';
  const labelCol= isLight ? 'rgba(0,15,8,0.8)'  : 'rgba(240,237,229,0.8)';
  
  // Use exact theme dynamic variables
  const getVar = c => getComputedStyle(document.documentElement).getPropertyValue(c).trim();
  const brandGreen = getVar('--green') || '#059669';
  const brandRed   = getVar('--red') || '#DC2626';

  // Load up to 252 sessions; the range selector (mc-ranges.js) picks the visible window
  const slicedData = dailyData.filter(d => d.fii_idx_fut_long !== undefined).slice(0, 252).reverse();
  const labels = slicedData.map(d => {
    const p = d.d.split('-');
    return p.length >= 2 ? `${p[0]} ${p[1]}` : d.d;
  });
  
  let longData, shortData, titleLong, titleShort;
  
  if (mode === 'fii-fut') {
    longData  = slicedData.map(d => d.fii_idx_fut_long);
    shortData = slicedData.map(d => d.fii_idx_fut_short);
    titleLong = 'FII Long Futures'; titleShort = 'FII Short Futures';
  } else if (mode === 'fii-call') {
    longData  = slicedData.map(d => d.fii_idx_call_long);
    shortData = slicedData.map(d => d.fii_idx_call_short);
    titleLong = 'FII Long Calls'; titleShort = 'FII Short Calls';
  } else if (mode === 'fii-put') {
    longData  = slicedData.map(d => d.fii_idx_put_long);
    shortData = slicedData.map(d => d.fii_idx_put_short);
    titleLong = 'FII Long Puts'; titleShort = 'FII Short Puts';
  } else if (mode === 'dii-fut') {
    longData  = slicedData.map(d => d.dii_idx_fut_long);
    shortData = slicedData.map(d => d.dii_idx_fut_short);
    titleLong = 'DII Long Futures'; titleShort = 'DII Short Futures';
  }

  const netData = longData.map((l, i) => l - shortData[i]);

  const datasets = [
    {
      type: 'line',
      label: titleLong,
      data: longData,
      borderColor: brandGreen,
      backgroundColor: brandGreen,
      borderWidth: 3,
      tension: 0.3,
      pointRadius: 4,
      pointHoverRadius: 6,
      fill: false,
      order: 1
    },
    {
      type: 'line',
      label: titleShort,
      data: shortData,
      borderColor: brandRed,
      backgroundColor: brandRed,
      borderWidth: 3,
      tension: 0.3,
      pointRadius: 4,
      pointHoverRadius: 6,
      fill: false,
      order: 2
    },
    {
      type: 'bar',
      label: 'Net Positioning',
      data: netData,
      backgroundColor: netData.map(v => v >= 0 ? (isLight ? 'rgba(5, 150, 105, 0.2)' : 'rgba(5, 150, 105, 0.3)') : (isLight ? 'rgba(220, 38, 38, 0.2)' : 'rgba(220, 38, 38, 0.3)')),
      borderColor: netData.map(v => v >= 0 ? brandGreen : brandRed),
      borderWidth: 1,
      borderRadius: 4,
      barPercentage: 0.6,
      order: 3
    }
  ];
  
  if(fnoHistoryChart) fnoHistoryChart.destroy();
  
  const ctx = canvas.getContext('2d');
  fnoHistoryChart = new Chart(ctx, {
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: true, position: 'bottom', labels: { color: labelCol, font: {size: 11, family: "'Plus Jakarta Sans', sans-serif", weight: 'bold'}, usePointStyle: true, boxWidth: 8 } },
        tooltip: {
          backgroundColor: isLight ? 'rgba(255,255,255,0.95)' : 'rgba(26,30,39,0.98)',
          titleColor: isLight ? '#8B95A5' : '#8B95A5',
          bodyColor: isLight ? '#384051' : '#FFFFFF',
          borderColor: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)',
          borderWidth: 1, padding: 12, cornerRadius: 8,
          titleFont: { family: "'Plus Jakarta Sans', sans-serif", size: 12, weight: 'bold' },
          bodyFont: { family: "'Inter', sans-serif", size: 13, weight: 'bold' },
          callbacks: {
            label: (ctx) => {
              const sign = ctx.raw >= 0 ? '+' : '';
              return ` ${ctx.dataset.label}: ${sign}${ctx.raw.toLocaleString('en-IN')} Cont.`;
            }
          }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: tickCol, font: {size:11, weight:'bold'} } },
        y: { 
          grid: { color: gridCol, drawBorder: false },
          ticks: { color: tickCol, font: {size:11, weight:'bold'}, callback: v => (v>=0?'+':'')+(v>=1000||v<=-1000?(v/1000).toFixed(0)+'k':v) }
        }
      }
    }
  });
}

