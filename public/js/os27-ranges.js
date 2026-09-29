/* os27-ranges: additive trading-style range selector + empty-data state for Chart.js time-series charts.
   Pure plugin: never mutates chart data, only scales.x.min/max (and y display while empty). */
(function () {
  'use strict';
  if (typeof Chart === 'undefined' || !Chart.register) return;

  var RANGES = [['1M', 21], ['3M', 63], ['6M', 126], ['1Y', 252], ['All', 0]];
  var DEFAULT_K = 63, MIN_POINTS = 31, SKEY = 'os27.range.';
  var state = {}; // canvas id -> k (0 = all)
  var MON = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

  function sget(id) { try { var v = sessionStorage.getItem(SKEY + id); return v == null ? null : parseInt(v, 10); } catch (e) { return null; } }
  function sset(id, k) { try { sessionStorage.setItem(SKEY + id, String(k)); } catch (e) {} }

  function eligible(chart) {
    var t = chart.config.type, o = chart.options || {};
    if (!chart.canvas || !chart.canvas.id) return false;
    if (t && /^(pie|doughnut|polarArea|radar|scatter|bubble)$/.test(t)) return false;
    if (o.indexAxis === 'y') return false;
    var l = chart.data && chart.data.labels;
    return !!(l && l.length >= MIN_POINTS);
  }
  function emptyOK(chart) { // empty-state also applies to short category charts (e.g. 20-session F&O chart)
    var t = chart.config.type, o = chart.options || {}, w = chart.canvas && chart.canvas.parentElement;
    if (!w || !chart.canvas.id) return false;
    if (t && /^(pie|doughnut|polarArea|radar|scatter|bubble)$/.test(t)) return false;
    if (o.indexAxis === 'y') return false;
    var l = chart.data && chart.data.labels;
    return !!(l && l.length >= 2 && w.clientHeight >= 150);
  }
  function parseLabel(s) {
    s = String(s);
    var m = /(\d{1,2})[ \-\/]([A-Za-z]{3})[a-z]*(?:[ \-\/,]+(\d{4}))?/.exec(s);
    if (m) return { t: Date.UTC(m[3] ? +m[3] : 2000, MON[m[2].toLowerCase()] || 0, +m[1]), y: !!m[3] };
    var t = Date.parse(s);
    return isNaN(t) ? null : { t: t, y: true };
  }
  function newestFirst(labels) {
    var a = parseLabel(labels[0]), b = parseLabel(labels[labels.length - 1]);
    return !!(a && b && a.y && b.y && a.t > b.t);
  }
  function kFor(id, n) {
    var k = state[id];
    if (k == null) { k = sget(id); if (k == null || isNaN(k)) k = n > DEFAULT_K ? DEFAULT_K : 0; state[id] = k; }
    return (k > 0 && k >= n) ? 0 : k;
  }
  function windowOf(chart, k) { // -> [lo, hi] inclusive indexes
    var n = chart.data.labels.length;
    if (!k || k >= n) return [0, n - 1];
    return newestFirst(chart.data.labels) ? [0, k - 1] : [n - k, n - 1];
  }
  function hasData(chart, lo, hi) {
    var ds = chart.data.datasets, i, j, v, any = false;
    for (i = 0; i < ds.length; i++) {
      if (chart.isDatasetVisible && !chart.isDatasetVisible(i)) continue;
      var d = ds[i].data || [];
      for (j = lo; j <= hi && j < d.length; j++) {
        v = d[j]; if (v && typeof v === 'object') v = v.y;
        if (v != null && v !== 0 && !isNaN(v)) return true;
      }
      any = true;
    }
    return false;
  }
  function latestDataIndexFromEnd(chart) { // distance (in candles) from newest end to the newest non-zero point
    var n = chart.data.labels.length, nf = newestFirst(chart.data.labels), i;
    for (var s = 0; s < n; s++) { i = nf ? s : n - 1 - s; if (hasData(chart, i, i)) return s + 1; }
    return 0;
  }

  /* ---------- DOM ---------- */
  function find(sel, root) { return (root || document).querySelector(sel); }
  function ensureUI(chart) {
    var cv = chart.canvas, id = cv.id, grp = document.querySelector('.os27-range[data-for="' + id + '"]');
    if (grp && document.body.contains(grp)) return grp;
    grp = document.createElement('div');
    grp.className = 'os27-range'; grp.setAttribute('role', 'group'); grp.setAttribute('data-for', id);
    grp.setAttribute('aria-label', 'Chart range');
    RANGES.forEach(function (r) {
      var b = document.createElement('button');
      b.type = 'button'; b.textContent = r[0]; b.setAttribute('data-k', r[1]);
      b.addEventListener('click', function () { setRange(id, r[1]); });
      grp.appendChild(b);
    });
    // place: header row that precedes the chart wrapper, else above the wrapper
    var wrap = cv.parentElement, head = null, p = wrap.previousElementSibling, hops = 0;
    while (p && hops < 3 && !head) {
      if (!p.querySelector('canvas') && getComputedStyle(p).display === 'flex') head = p;
      p = p.previousElementSibling; hops++;
    }
    if (head) { grp.classList.add('os27-range--inline'); head.appendChild(grp); }
    else { grp.classList.add('os27-range--block'); wrap.parentNode.insertBefore(grp, wrap); }
    return grp;
  }
  function ensureOverlay(chart) {
    var wrap = chart.canvas.parentElement, o = wrap.querySelector(':scope > .os27-empty');
    if (o) return o;
    if (getComputedStyle(wrap).position === 'static') wrap.style.position = 'relative';
    o = document.createElement('div'); o.className = 'os27-empty'; o.hidden = true; o.setAttribute('role', 'status');
    o.innerHTML = '<p class="os27-empty__msg"></p><div class="os27-empty__acts"></div>';
    wrap.appendChild(o);
    return o;
  }
  function subject(chart) {
    var l = (chart.data.datasets[0] && chart.data.datasets[0].label) || '';
    l = l.replace(/\b(Long|Short|Net)\b\s*/gi, '').trim();
    if (!l) return 'data';
    return l.split(/\s+/).map(function (w, i) { return (w === w.toUpperCase() || i === 0) ? w : w.toLowerCase(); }).join(' ');
  }
  function act(label, fn, primary) {
    var b = document.createElement('button'); b.type = 'button'; b.textContent = label;
    b.className = 'os27-empty__btn' + (primary ? ' is-primary' : ''); b.addEventListener('click', fn); return b;
  }
  function chartFor(id) { var c = document.getElementById(id); return c && Chart.getChart(c); }
  function setRange(id, k) {
    state[id] = k; sset(id, k);
    var ch = chartFor(id); if (ch) ch.update('none');
  }

  function syncUI(chart, k) {
    var grp = ensureUI(chart), n = chart.data.labels.length;
    grp.hidden = false;
    [].forEach.call(grp.children, function (b) {
      var bk = +b.getAttribute('data-k'), on = bk === k, dis = bk > 0 && bk >= n;
      b.classList.toggle('active', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.disabled = dis && !on;
      b.title = bk ? bk + ' trading sessions' + (dis ? ' (more than available)' : '') : 'All ' + n + ' trading sessions';
    });
  }
  function syncEmpty(chart, k, empty) {
    var o = ensureOverlay(chart);
    if (!empty) { o.hidden = true; return; }
    var n = chart.data.labels.length, all = hasData(chart, 0, n - 1), acts = o.querySelector('.os27-empty__acts'), id = chart.canvas.id;
    o.querySelector('.os27-empty__msg').textContent = all
      ? 'No ' + subject(chart) + ' data reported for this period — try All'
      : 'No ' + subject(chart) + ' data reported yet (last ' + n + ' sessions)';
    acts.textContent = '';
    if (all && k) {
      var need = latestDataIndexFromEnd(chart), pick = 0;
      for (var i = 0; i < RANGES.length - 1; i++) if (RANGES[i][1] >= need && RANGES[i][1] < n) { pick = RANGES[i][1]; break; }
      if (pick && pick !== k) acts.appendChild(act('Jump to latest data', function () { setRange(id, pick); }, true));
      acts.appendChild(act('Show All', function () { setRange(id, 0); }, !acts.children.length));
    }
    o.hidden = false;
  }

  /* ---------- plugin ---------- */
  Chart.register({
    id: 'os27ranges',
    afterInit: function (chart) { try { if (eligible(chart)) ensureUI(chart); } catch (e) {} },
    beforeUpdate: function (chart) {
      var id = chart.canvas && chart.canvas.id, grp = id && document.querySelector('.os27-range[data-for="' + id + '"]');
      var o = chart.canvas && chart.canvas.parentElement && chart.canvas.parentElement.querySelector(':scope > .os27-empty');
      try {
        var sc = chart.options.scales || (chart.options.scales = {});
        var xo = sc.x || (sc.x = {}), yo = sc.y;
        var raw = chart.config.options || (chart.config.options = {});
        raw.scales = raw.scales || {}; var xr = raw.scales.x || (raw.scales.x = {}), yr = raw.scales.y;
        var ranged = eligible(chart);
        if (!ranged) { // e.g. app switched to weekly/monthly: hide selector, release window
          if (grp) grp.hidden = true;
          if (chart._os27 && chart._os27.ranged) { xo.min = undefined; xo.max = undefined; xr.min = undefined; xr.max = undefined; }
          if (!emptyOK(chart)) {
            if (o) o.hidden = true;
            if (chart._os27) { if (yo && chart._os27.yd !== undefined) { yo.display = chart._os27.yd; if (yr) yr.display = yo.display; } chart._os27 = null; }
            return;
          }
        }
        var n = chart.data.labels.length, k = ranged ? kFor(id, n) : 0, w = windowOf(chart, k);
        chart._os27 = chart._os27 || { yd: yo ? yo.display : undefined };
        chart._os27.ranged = ranged;
        if (ranged) { if (k) { xo.min = xr.min = w[0]; xo.max = xr.max = w[1]; } else { xo.min = xr.min = undefined; xo.max = xr.max = undefined; } }
        var empty = !hasData(chart, w[0], w[1]);
        chart._os27.empty = empty; chart._os27.k = k; chart._os27.win = (ranged && k) ? w : null;
        if (yo) { yo.display = empty ? false : chart._os27.yd; if (yr) yr.display = yo.display; }
        if (ranged) syncUI(chart, k); syncEmpty(chart, k, empty);
      } catch (e) {}
    },
    beforeLayout: function (chart) { // scales are initialised before beforeUpdate on some paths: sync the visible window
      var st = chart._os27, xs = chart.scales && chart.scales.x;
      if (!st || !st.ranged || !xs) return;
      var mn = st.win ? st.win[0] : undefined, mx = st.win ? st.win[1] : undefined;
      xs._userMin = mn == null ? NaN : mn; xs._userMax = mx == null ? NaN : mx;
      xs.options.min = mn; xs.options.max = mx;
    },
    beforeDatasetsDraw: function (chart) { if (chart._os27 && chart._os27.empty) return false; }
  });

  // charts created before this script registered are not covered (script loads before app code)
})();
