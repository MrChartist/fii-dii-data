/* os27-motion: additive motion layer. Observers + classes only; never touches app logic. */
(function () {
  'use strict';
  try {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var raf = window.requestAnimationFrame.bind(window);

    /* Chart.js default tweak (additive) */
    function chartDefaults() {
      try {
        if (!reduce && window.Chart && Chart.defaults) {
          Chart.defaults.animation = Object.assign({}, Chart.defaults.animation || {}, { duration: 700, easing: 'easeOutQuart' });
        }
      } catch (e) {}
    }

    /* ── Sliding capsule ─────────────────────────────── */
    var hosts = new Set();
    function place(host) {
      try {
        var pill = host.__osPill;
        var act = host.querySelector(':scope > .tab.active, :scope > .s-tab.active, :scope > button.active');
        if (!pill || !act || !act.offsetWidth) { if (pill && pill.classList.contains('os-ready')) pill.classList.remove('os-ready'); if (host.classList.contains('os-pill-on')) host.classList.remove('os-pill-on'); return; }
        var first = !pill.classList.contains('os-ready');
        if (first && pill.classList.contains('os-anim')) pill.classList.remove('os-anim');
        pill.style.width = act.offsetWidth + 'px';
        pill.style.height = act.offsetHeight + 'px';
        pill.style.transform = 'translate(' + act.offsetLeft + 'px,' + act.offsetTop + 'px)';
        if (!pill.classList.contains('os-ready')) pill.classList.add('os-ready');
        if (!host.classList.contains('os-pill-on')) host.classList.add('os-pill-on');
        if (first && !reduce) raf(function () { raf(function () { pill.classList.add('os-anim'); }); });
      } catch (e) {}
    }
    function initHost(host, cls) {
      if (!host || host.__osPill) return;
      var pill = document.createElement('span');
      pill.className = 'os-pill ' + cls;
      pill.setAttribute('aria-hidden', 'true');
      if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
      host.insertBefore(pill, host.firstChild);
      host.__osPill = pill;
      host.classList.add('os-pill-host');
      hosts.add(host);
      var mo = new MutationObserver(function (ms) {
        for (var i = 0; i < ms.length; i++) {
          var t = ms[i].target;
          if (t === pill || t === host) continue; // our own class writes
          place(host); return;
        }
      });
      mo.observe(host, { attributes: true, attributeFilter: ['class'], subtree: true, childList: true });
      host.addEventListener('click', function () { raf(function () { place(host); }); setTimeout(function () { place(host); }, 60); });
      place(host);
    }
    function scanHosts(root) {
      root = root || document;
      try {
        root.querySelectorAll('.tabs-wrap').forEach(function (h) { initHost(h, ''); });
        root.querySelectorAll('.sub-tabs, .view-toggle').forEach(function (h) { initHost(h, 's-tab-pill'); });
      } catch (e) {}
    }
    var rzT;
    function relayout() { clearTimeout(rzT); rzT = setTimeout(function () { hosts.forEach(function (h) { if (h.isConnected) place(h); }); }, 60); }

    /* ── Scroll reveal / bars ───────────────────────── */
    var CARD_SEL = '.card, .terminal-panel, .sector-card';
    var BAR_SEL = '.fno-3d-cube, .td-bar';
    var vh = function () { return window.innerHeight || 800; };
    var seen = new WeakSet();
    var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
      var idx = 0;
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target; io.unobserve(el);
        if (el.classList.contains('os-pre')) {
          el.style.setProperty('--os-d', Math.min(idx++, 6) * 60 + 'ms');
          el.classList.remove('os-pre'); el.classList.add('os-in');
          setTimeout(function () { el.classList.remove('os-in'); el.style.removeProperty('--os-d'); }, 1200);
        } else if (el.dataset.osBar) {
          el.classList.add('os-grow');
          setTimeout(function () { el.classList.remove('os-grow'); }, 1100);
        }
      });
    }, { threshold: 0.08 }) : null;
    function prepCard(el) {
      if (!io || reduce || seen.has(el)) return; seen.add(el);
      var r = el.getBoundingClientRect();
      if (r.width && r.top > vh()) { el.classList.add('os-pre'); io.observe(el); setTimeout(function () { el.classList.remove('os-pre'); }, 5000); }
    }
    function prepBar(el) {
      if (!io || reduce || seen.has(el)) return; seen.add(el);
      el.dataset.osBar = '1'; io.observe(el);
    }

    /* ── Count-up ───────────────────────────────────── */
    var NUM_SEL = '.num-xl, .num-m, .num-s, .terminal-value, .sz-stat-value, .fno-3d-value, .ticker-value, .hero-num, .kpi-value';
    var RE = /^(\D{0,4}?)(\d[\d,]*)(\.\d+)?(\D{0,10})$/;
    var st = new WeakMap(); // textNode -> {last, raf, val}
    function parse(s) {
      var m = RE.exec(s); if (!m) return null;
      var dec = m[3] ? m[3].length - 1 : 0;
      return { pre: m[1], val: parseFloat(m[2].replace(/,/g, '') + (m[3] || '')), dec: dec, suf: m[4],
        comma: m[2].indexOf(',') > -1, indian: /\d,\d\d,\d{3}/.test(m[2]) || /^\d{1,2},\d\d$/.test('x'), raw: m[2] };
    }
    function fmt(v, p) {
      var s = Math.abs(v).toFixed(p.dec), parts = s.split('.'), i = parts[0];
      if (p.comma) {
        if (p.indian && i.length > 3) i = i.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + i.slice(-3);
        else i = i.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      }
      return p.pre + i + (parts[1] ? '.' + parts[1] : '') + p.suf;
    }
    function animateText(node) {
      var s = st.get(node) || {};
      var txt = node.data;
      if (s.wrote && s.wrote.has(txt)) return;   // our own write
      if (s.raf) { cancelAnimationFrame(s.raf); s.raf = 0; }
      var p = parse(txt.trim());
      var lead = txt.match(/^\s*/)[0], trail = txt.match(/\s*$/)[0];
      if (!p || !isFinite(p.val) || Math.abs(p.val) > 1e12) { st.set(node, { val: null }); return; }
      var from = s.val != null && isFinite(s.val) ? s.val : 0;
      var to = p.val;
      s = { raf: 0, val: to, wrote: new Set([txt]) };
      st.set(node, s);
      if (reduce || from === to || !document.body.contains(node) || document.hidden) return;
      var t0 = performance.now(), D = 600;
      (function step(now) {
        var t = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - t, 3);
        if (!node.isConnected) return;
        if (t >= 1) { node.data = txt; s.raf = 0; return; }
        var w = lead + fmt(from + (to - from) * e, p) + trail;
        s.wrote.add(w); node.data = w;
        s.raf = raf(step);
      })(t0);
    }
    function countEl(el) {
      if (!el || el.nodeType !== 1) return;
      if (el.childElementCount === 0 && el.firstChild && el.firstChild.nodeType === 3 && el.childNodes.length === 1) animateText(el.firstChild);
    }

    /* ── Badge pop ──────────────────────────────────── */
    var BADGE_SEL = '.os-badge, .signal-pill, .badge, .pill';
    function pop(el) {
      if (reduce || !el.isConnected) return;
      el.classList.remove('os-popping'); void el.offsetWidth; el.classList.add('os-popping');
      setTimeout(function () { el.classList.remove('os-popping'); }, 600);
    }

    /* ── Global observer ────────────────────────────── */
    function scan(root) {
      if (!root || root.nodeType !== 1) return;
      if (root.matches(CARD_SEL)) prepCard(root);
      if (root.matches(BAR_SEL)) prepBar(root);
      root.querySelectorAll && root.querySelectorAll(CARD_SEL + ',' + BAR_SEL).forEach(function (el) { el.matches(BAR_SEL) ? prepBar(el) : prepCard(el); });
    }
    function closestMatch(node, sel) { var el = node.nodeType === 1 ? node : node.parentElement; return el && el.closest ? el.closest(sel) : null; }

    function init() {
      chartDefaults();
      scanHosts();
      scan(document.body);
      // initial numbers: from 0
      document.querySelectorAll(NUM_SEL).forEach(countEl);
      var mo = new MutationObserver(function (muts) {
        var nums = new Set(), badges = new Set();
        muts.forEach(function (m) {
          if (m.type === 'characterData') {
            var n = closestMatch(m.target, NUM_SEL); if (n) nums.add(n);
            var b = closestMatch(m.target, BADGE_SEL); if (b && m.target.data !== m.oldValue) badges.add(b);
          } else if (m.type === 'childList') {
            m.addedNodes.forEach(function (a) {
              if (a.nodeType === 3) { var t = closestMatch(a, NUM_SEL); if (t) nums.add(t); var b2 = closestMatch(a, BADGE_SEL); if (b2) badges.add(b2); return; }
              if (a.nodeType !== 1 || a.classList.contains('os-pill')) return;
              scan(a);
              if (a.matches(NUM_SEL)) nums.add(a);
              a.querySelectorAll(NUM_SEL).forEach(function (x) { nums.add(x); });
              var pb = closestMatch(a, BADGE_SEL); if (pb) badges.add(pb);
              if (a.matches(BADGE_SEL)) badges.add(a);
              if (a.matches('.sub-tabs, .view-toggle, .tabs-wrap') || a.querySelector('.sub-tabs, .view-toggle')) scanHosts(a.parentNode || document);
            });
            if (m.target.nodeType === 1) { var tn = closestMatch(m.target, NUM_SEL); if (tn) nums.add(tn); var tb = closestMatch(m.target, BADGE_SEL); if (tb) badges.add(tb); }
          }
        });
        nums.forEach(countEl);
        badges.forEach(pop);
      });
      mo.observe(document.body, { childList: true, characterData: true, subtree: true, characterDataOldValue: true });
      window.addEventListener('resize', relayout, { passive: true });
      window.addEventListener('orientationchange', relayout);
      window.addEventListener('load', relayout);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  } catch (e) { /* motion must never break the app */ }
})();
