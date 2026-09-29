/* os27-charts: additive Chart.js theming + customisation sheet. No app logic is altered. */
(function () {
  'use strict';
  var root = document.documentElement;
  var PREF_KEY = 'os27-prefs';

  /* ---------- helpers ---------- */
  function cssVar(name, fb) {
    var v = '';
    try { v = getComputedStyle(root).getPropertyValue(name).trim(); } catch (e) {}
    return v || fb;
  }
  var _cv = null;
  function rgbOf(c) {           // -> [r,g,b,a] or null
    try {
      _cv = _cv || document.createElement('canvas'); _cv.width = _cv.height = 1;
      var x = _cv.getContext('2d', { willReadFrequently: true });
      x.clearRect(0, 0, 1, 1); x.fillStyle = '#000'; x.fillStyle = c; x.fillRect(0, 0, 1, 1);
      var d = x.getImageData(0, 0, 1, 1).data;
      return [d[0], d[1], d[2], d[3] / 255];
    } catch (e) { return null; }
  }
  function withAlpha(rgb, a) { return 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + a + ')'; }
  function isDark() { return root.getAttribute('data-theme') !== 'light'; }
  function reduced() { return root.getAttribute('data-motion') === 'reduced'; }

  function tokens() {
    var dark = isDark();
    return {
      label: cssVar('--t2', dark ? 'rgba(235,235,245,.86)' : 'rgba(60,60,67,.88)'),
      hair: cssVar('--os-hairline', dark ? 'rgba(255,255,255,.10)' : 'rgba(60,60,67,.14)'),
      glass: cssVar('--os-glass-solid', dark ? '#2C2C2E' : '#FFFFFF'),
      text: cssVar('--t1', dark ? '#fff' : '#000'),
      font: cssVar('--font-body', "-apple-system,BlinkMacSystemFont,'SF Pro Text',Inter,system-ui,sans-serif"),
      bull: cssVar('--os-bull', dark ? '#30D158' : '#248A3D'),
      bear: cssVar('--os-bear', dark ? '#FF453A' : '#D70015'),
      accent: cssVar('--os-accent', '#007AFF')
    };
  }

  /* ---------- Chart.js defaults + plugin ---------- */
  var origMap = new WeakMap();   // dataset -> {key:{orig,set}}
  var bullRGB = [48, 209, 88], bearRGB = [255, 69, 58];

  function classify(rgb) {       // 'bull' | 'bear' | null
    var r = rgb[0], g = rgb[1], b = rgb[2];
    if (g > r + 40 && g >= b - 10 && g > 90) return 'bull';   // green / teal-green
    if (r > g + 80 && r > b + 60) return 'bear';              // red
    return null;
  }
  function remap(str) {
    if (typeof str !== 'string') return str;
    if (!/^(#|rgb|hsl)/i.test(str)) return str;
    var c = rgbOf(str); if (!c || c[3] === 0) return str;
    var k = classify(c); if (!k) return str;
    return withAlpha(k === 'bull' ? bullRGB : bearRGB, Math.round(c[3] * 100) / 100);
  }
  function remapAny(v) { return Array.isArray(v) ? v.map(remap) : remap(v); }
  function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

  function applyDefaults() {
    if (!window.Chart) return;
    var t = tokens(), D = Chart.defaults;
    var b = rgbOf(t.bull), r = rgbOf(t.bear);
    if (b) bullRGB = b; if (r) bearRGB = r;
    D.font.family = t.font; D.font.size = 11;
    D.color = t.label; D.borderColor = t.hair;
    D.devicePixelRatio = Math.min(3, Math.max(2, window.devicePixelRatio || 1));
    D.animation = D.animation || {};
    D.animation.duration = reduced() ? 0 : 450;
    D.animation.easing = 'easeOutBack';
    if (D.transitions && D.transitions.active) D.transitions.active.animation = { duration: reduced() ? 0 : 200 };
    D.elements.bar.borderRadius = 6;
    D.elements.line.tension = 0.35;
    D.elements.line.borderWidth = 2;
    D.elements.point.hoverRadius = 5;
    ['x', 'y'].forEach(function () {});
    if (D.scale && D.scale.grid) { D.scale.grid.color = t.hair; D.scale.grid.tickColor = 'transparent'; }
    if (D.scale && D.scale.ticks) D.scale.ticks.color = t.label;
    var P = D.plugins;
    P.legend.labels.usePointStyle = true; P.legend.labels.pointStyle = 'circle';
    P.legend.labels.boxWidth = 8; P.legend.labels.boxHeight = 8; P.legend.labels.color = t.label;
    Object.assign(P.tooltip, {
      backgroundColor: t.glass, titleColor: t.text, bodyColor: t.label,
      borderColor: t.hair, borderWidth: 1, cornerRadius: 14, padding: 12,
      boxPadding: 4, usePointStyle: true, displayColors: false,
      titleFont: { weight: '600' }
    });
  }

  var plugin = {
    id: 'os27theme',
    beforeUpdate: function (chart) {
      var t = tokens();
      try {
        var sc = chart.options && chart.options.scales;
        if (sc) Object.keys(sc).forEach(function (k) {
          var s = sc[k]; if (!s) return;
          if (s.ticks && typeof s.ticks.color === 'string') s.ticks.color = t.label;
          if (s.grid && typeof s.grid.color === 'string' && s.grid.display !== false) s.grid.color = t.hair;
          if (s.border && s.border.display !== false && typeof s.border.color === 'string') s.border.color = t.hair;
        });
        var pl = chart.options.plugins;
        if (pl && pl.legend && pl.legend.labels && typeof pl.legend.labels.color === 'string') pl.legend.labels.color = t.label;
        var cfgTip = chart.config.options && chart.config.options.plugins && chart.config.options.plugins.tooltip;
        if (pl && pl.tooltip && (!cfgTip || cfgTip.displayColors === undefined)) {
          pl.tooltip.displayColors = chart.data.datasets.length > 1;
        }
        chart.data.datasets.forEach(function (ds) {
          var rec = origMap.get(ds); if (!rec) { rec = {}; origMap.set(ds, rec); }
          ['backgroundColor', 'borderColor', 'hoverBackgroundColor'].forEach(function (key) {
            var cur = ds[key];
            if (cur === undefined || typeof cur === 'function') return;
            if (!rec[key] || !same(rec[key].set, cur)) rec[key] = { orig: cur, set: cur };
            var next = remapAny(rec[key].orig);
            rec[key].set = next; ds[key] = next;
          });
        });
      } catch (e) { /* theming must never break the app */ }
    },
    afterDraw: function (chart) {
      try {
        var ds = chart.data.datasets;
        if (!ds || !ds.length) return;
        var any = ds.some(function (d) { return d.data && d.data.length; });
        if (any || chart.config.type === 'doughnut' || chart.config.type === 'pie') return;
        var a = chart.chartArea, c = chart.ctx; if (!a) return;
        c.save(); c.fillStyle = tokens().label; c.globalAlpha = 0.7; c.textAlign = 'center';
        c.font = '500 13px ' + tokens().font;
        c.fillText('No data available', (a.left + a.right) / 2, (a.top + a.bottom) / 2);
        c.restore();
      } catch (e) {}
    }
  };

  var pending = 0;
  function retheme() {
    if (!window.Chart) return;
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(function () {
      pending = requestAnimationFrame(function () {
        applyDefaults();
        try { Object.values(Chart.instances).forEach(function (c) { c.update('none'); }); } catch (e) {}
      });
    });
  }

  if (window.Chart) {
    Chart.register(plugin);
    applyDefaults();
    retheme();
  }
  new MutationObserver(function () { retheme(); reapplyOverrides(); })
    .observe(root, { attributes: true, attributeFilter: ['data-theme', 'data-motion', 'data-density'] });
  try {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    (mq.addEventListener ? mq.addEventListener.bind(mq, 'change') : mq.addListener.bind(mq))(function () { onSystemChange(); retheme(); });
  } catch (e) {}

  /* ---------- preferences ---------- */
  var ACCENTS = {
    blue:   { l: '#007AFF', d: '#0A84FF', n: 'Blue' },
    indigo: { l: '#5856D6', d: '#5E5CE6', n: 'Indigo' },
    teal:   { l: '#1C9DB5', d: '#40C8E0', n: 'Teal' },
    orange: { l: '#E07B00', d: '#FF9F0A', n: 'Orange' },
    pink:   { l: '#E0224F', d: '#FF375F', n: 'Pink' }
  };
  var PALETTES = {
    gr: null,
    bo: { l: ['#0060DF', '#B85000'], d: ['#4DA3FF', '#FF9F0A'] }
  };
  var DEF = { theme: 'manual', accent: 'blue', density: 'comfortable', motion: 'full', palette: 'gr' };
  var prefs = Object.assign({}, DEF);

  function load() {
    try { var s = JSON.parse(localStorage.getItem(PREF_KEY) || 'null'); if (s && typeof s === 'object') Object.assign(prefs, s); } catch (e) {}
  }
  function save() { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch (e) {} }

  function setProps(map) {
    Object.keys(map).forEach(function (k) {
      if (map[k] === null) root.style.removeProperty(k); else root.style.setProperty(k, map[k]);
    });
  }
  function hexA(h, a) { var n = parseInt(h.slice(1), 16); return 'rgb(' + (n >> 16) + ' ' + ((n >> 8) & 255) + ' ' + (n & 255) + ' / ' + a + ')'; }

  function applyAccent() {
    var a = ACCENTS[prefs.accent];
    if (!a || prefs.accent === 'blue') { setProps({ '--os-accent': null, '--os-accent-bg': null }); return; }
    var c = isDark() ? a.d : a.l;
    setProps({ '--os-accent': c, '--os-accent-bg': hexA(c, isDark() ? 0.22 : 0.12) });
  }
  function applyPalette() {
    var p = PALETTES[prefs.palette];
    if (!p) { setProps({ '--os-bull': null, '--os-bear': null, '--os-bull-bg': null, '--os-bear-bg': null, '--green': null, '--red': null }); return; }
    var v = isDark() ? p.d : p.l;
    setProps({
      '--os-bull': v[0], '--os-bear': v[1], '--green': v[0], '--red': v[1],
      '--os-bull-bg': hexA(v[0], 0.18), '--os-bear-bg': hexA(v[1], 0.18)
    });
  }
  function applyDensity() { root.setAttribute('data-density', prefs.density); }
  function applyMotion() { root.setAttribute('data-motion', prefs.motion); }
  function reapplyOverrides() { applyAccent(); applyPalette(); }

  /* theme: reuse the app's own toggleTheme() and 'theme' storage key */
  function sysTheme() { try { return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'; } catch (e) { return 'dark'; } }
  function setTheme(mode) {                       // 'auto' | 'light' | 'dark'
    var want = mode === 'auto' ? sysTheme() : mode;
    if (root.getAttribute('data-theme') !== want) {
      if (typeof window.toggleTheme === 'function') {
        try { window.toggleTheme(); } catch (e) {}
      }
      if (root.getAttribute('data-theme') !== want) root.setAttribute('data-theme', want);
    }
    try {
      if (mode === 'auto') localStorage.removeItem('theme'); else localStorage.setItem('theme', want);
    } catch (e) {}
  }
  function onSystemChange() { if (prefs.theme === 'auto') setTheme('auto'); }
  function themeMode() { return prefs.theme === 'auto' ? 'auto' : (isDark() ? 'dark' : 'light'); }

  /* ---------- UI ---------- */
  var btn, sheet, backdrop, lastFocus;
  var GROUPS = [
    { key: 'theme', label: 'Appearance', opts: [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']] },
    { key: 'accent', label: 'Accent colour', swatches: true, opts: Object.keys(ACCENTS).map(function (k) { return [k, ACCENTS[k].n]; }) },
    { key: 'density', label: 'Density', opts: [['comfortable', 'Comfortable'], ['compact', 'Compact']] },
    { key: 'motion', label: 'Motion', opts: [['full', 'Full'], ['reduced', 'Reduced']] },
    { key: 'palette', label: 'Gain and loss colours', opts: [['gr', 'Green and red'], ['bo', 'Blue and orange']], hint: 'Blue and orange is easier to tell apart for colour-blind users.' }
  ];

  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }

  function build() {
    btn = el('button', 'os27-cust-btn'); btn.type = 'button';
    btn.setAttribute('aria-label', 'Customise appearance'); btn.setAttribute('aria-haspopup', 'dialog'); btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2.2"/><circle cx="8" cy="17" r="2.2"/></svg><span>Customise</span>';
    btn.addEventListener('click', function () { sheet.hidden ? open() : close(); });

    backdrop = el('div', 'os27-cust-backdrop'); backdrop.hidden = true;
    backdrop.addEventListener('click', close);

    sheet = el('div', 'os27-cust-sheet'); sheet.hidden = true;
    sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true'); sheet.setAttribute('aria-labelledby', 'os27-cust-title');
    sheet.tabIndex = -1;
    var head = el('div', 'os27-cust-head');
    var h = el('h2', 'os27-cust-title', 'Customise'); h.id = 'os27-cust-title';
    var x = el('button', 'os27-cust-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Close'); x.addEventListener('click', close);
    head.appendChild(el('span', 'os27-cust-grab')); head.appendChild(h); head.appendChild(x);
    sheet.appendChild(head);

    GROUPS.forEach(function (g) {
      var sec = el('div', 'os27-cust-sec');
      var lab = el('div', 'os27-cust-label', g.label); lab.id = 'os27-l-' + g.key; sec.appendChild(lab);
      var seg = el('div', 'os27-seg' + (g.swatches ? ' os27-seg-sw' : '')); seg.setAttribute('role', 'radiogroup'); seg.setAttribute('aria-labelledby', lab.id);
      seg.dataset.key = g.key;
      g.opts.forEach(function (o) {
        var b = el('button', 'os27-seg-b'); b.type = 'button'; b.setAttribute('role', 'radio'); b.dataset.val = o[0];
        if (g.swatches) { var s = el('i', 'os27-dot'); s.style.background = ACCENTS[o[0]].d; b.appendChild(s); }
        b.appendChild(el('span', null, o[1]));
        b.addEventListener('click', function () { choose(g.key, o[0]); });
        seg.appendChild(b);
      });
      sec.appendChild(seg);
      if (g.hint) sec.appendChild(el('div', 'os27-cust-hint', g.hint));
      sheet.appendChild(sec);
    });
    var rs = el('button', 'os27-cust-reset', 'Reset to defaults'); rs.type = 'button'; rs.addEventListener('click', reset);
    sheet.appendChild(rs);

    sheet.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var f = sheet.querySelectorAll('button:not([disabled])'); if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !sheet.hidden) close(); });
    document.body.appendChild(btn); document.body.appendChild(backdrop); document.body.appendChild(sheet);
  }

  function sync() {
    var cur = { theme: themeMode(), accent: prefs.accent, density: prefs.density, motion: prefs.motion, palette: prefs.palette };
    sheet.querySelectorAll('.os27-seg').forEach(function (seg) {
      seg.querySelectorAll('.os27-seg-b').forEach(function (b) {
        var on = b.dataset.val === cur[seg.dataset.key];
        b.setAttribute('aria-checked', on ? 'true' : 'false'); b.classList.toggle('on', on); b.tabIndex = on ? 0 : -1;
      });
    });
  }
  function choose(key, val) {
    if (key === 'theme') { prefs.theme = val === 'auto' ? 'auto' : 'manual'; setTheme(val); }
    else { prefs[key] = val; }
    if (key === 'accent') applyAccent();
    if (key === 'density') applyDensity();
    if (key === 'motion') { applyMotion(); retheme(); }
    if (key === 'palette') { applyPalette(); retheme(); }
    save(); sync();
  }
  function reset() {
    var wasAuto = prefs.theme === 'auto';
    prefs = Object.assign({}, DEF);
    applyAccent(); applyPalette(); applyDensity(); applyMotion();
    if (wasAuto) { try { localStorage.removeItem('theme'); } catch (e) {} }
    save(); retheme(); sync();
  }
  function open() {
    lastFocus = document.activeElement; sync();
    backdrop.hidden = false; sheet.hidden = false; btn.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(function () { sheet.classList.add('show'); backdrop.classList.add('show'); });
    var on = sheet.querySelector('.os27-seg-b.on') || sheet; on.focus();
  }
  function close() {
    sheet.classList.remove('show'); backdrop.classList.remove('show'); btn.setAttribute('aria-expanded', 'false');
    setTimeout(function () { sheet.hidden = true; backdrop.hidden = true; }, reduced() ? 0 : 220);
    if (lastFocus && lastFocus.focus) lastFocus.focus(); else btn.focus();
  }

  function init() {
    load();
    applyDensity(); applyMotion();
    if (prefs.theme === 'auto') setTheme('auto');
    reapplyOverrides();
    if (!document.getElementById('os27-cust-title')) build();
    retheme();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
