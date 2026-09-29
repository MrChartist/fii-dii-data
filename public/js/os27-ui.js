/* os27-ui: shared chrome (navbar + footer), info popovers, menus, docking. Additive: no app logic is altered. */
(function () {
  'use strict';
  var NAV = `  <!-- TOP BAR (mobile) -->
  <div class="os-topbar" role="banner">
    <a href="/" class="os-topbar-brand">Mr. Chartist<i class="os-dot-accent"></i></a>
    <span class="os-live-chip" data-os-live><i></i><span>Live</span></span>
    <button type="button" class="os-round-btn" onclick="toggleTheme()" aria-label="Toggle theme"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg></button>
    <a class="os-cta os-cta-sm" href="https://mrchartist.com" target="_blank" rel="noopener">Explore</a>
  </div>

  <!-- TABS (FLOATING ISLAND NAV) -->
  <nav class="tabs-wrap" role="navigation" aria-label="Dashboard sections">
    <a href="/" class="nav-brand" title="FII &amp; DII Data - Institutional Analytics">
      <span class="nav-logo-text">Mr. Chartist</span><i class="os-dot-accent" aria-hidden="true"></i>
    </a>
    <div class="nav-divider"></div>
    <div class="tab active" data-tab="t-hero" onclick="switchMainTab('t-hero')">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12"/><path d="M6 8h12"/><path d="m6 13 8.5 8"/><path d="M6 13h3"/><path d="M9 13c6.667 0 6.667-10 0-10"/></svg> <span class="tab-txt">FII/DII</span>
    </div>
    <div class="tab" data-tab="t-fno" onclick="switchMainTab('t-fno')">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19v-5.5l-5-3-4.03 2.42Z"/><path d="m7 16.5-4.74-2.85"/><path d="m7 16.5 5-3"/><path d="M7 16.5v5.17"/><path d="M12 13.5V19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L17 10.5l-5 3Z"/><path d="m17 16.5-5-3"/><path d="m17 16.5 4.74-2.85"/><path d="M17 16.5v5.17"/><path d="M7.97 4.42A2 2 0 0 0 7 6.13v4.37l5 3 5-3V6.13a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0l-3 1.8Z"/><path d="M12 8 7.26 5.15"/><path d="m12 8 4.74-2.85"/><path d="M12 13.5V8"/></svg> <span class="tab-txt">F&amp;O</span>
    </div>
    <div class="tab" data-tab="t-matrix" onclick="switchMainTab('t-matrix')">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/></svg> <span class="tab-txt">Analytics</span>
    </div>
    <div class="tab" data-tab="t-sector" onclick="switchMainTab('t-sector'); renderSectors(); renderSectorChart();">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg> <span class="tab-txt">Sectors</span>
    </div>
    <a class="tab" data-tab="deals" href="/deals.html">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 3h16v18l-3-2-2.5 2L12 19l-2.5 2L7 19l-3 2z"/><path d="M8 8h8M8 12h8M8 16h4"/></svg> <span class="tab-txt">Deals</span>
    </a>

    <div class="nav-divider"></div>
    <div class="nav-actions">
      <span class="os-live-chip" data-os-live title="Data status"><i></i><span>Live</span></span>
      <button onclick="toggleTheme()" class="nav-icon-btn" title="Toggle theme" aria-label="Toggle theme">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>
      </button>
      <div class="os-menu" id="navMore">
        <button type="button" class="nav-icon-btn os-menu-btn" aria-haspopup="true" aria-expanded="false" aria-label="More: alerts, channel, data and API" title="More">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>
        </button>
        <div class="os-menu-pop" role="menu" hidden>
          <a role="menuitem" href="https://t.me/fiidiidatalivebot" target="_blank" rel="noopener" class="nav-tg-btn" id="navTgBtn" title="Get Telegram Alerts"><svg viewBox="0 0 24 24" width="14" height="14" fill="#fff"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"></path></svg>Alerts on Telegram</a>
          <a role="menuitem" href="https://t.me/official_mrchartist" target="_blank" rel="noopener" class="nav-channel-btn" id="navChannelBtn" title="Join our Telegram Channel for market updates"><svg viewBox="0 0 24 24" width="14" height="14" fill="#fff"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"></path></svg>Telegram Channel</a>
          <a role="menuitem" href="/data-api.html" class="os-menu-link">Data &amp; API</a>
          <a role="menuitem" href="/api/agents/docs" target="_blank" rel="noopener" class="os-menu-link">Agent API Docs</a>
        </div>
      </div>
      <a class="os-cta" href="https://mrchartist.com" target="_blank" rel="noopener">Explore Products</a>
    </div>
  </nav>`;
  var FOOT = `<footer class="os-footer">
  <div class="os-footer-card">
    <div class="os-footer-grid">
      <div class="os-fbrand">
        <div class="os-fbrand-name">Mr. Chartist<i class="os-dot-accent" aria-hidden="true"></i></div>
        <p>India's most comprehensive real-time tracker for FII and DII institutional money flows. Updated daily with data from NSE, NSDL, and F&amp;O derivatives archives.</p>
      </div>
      <div class="os-fcol"><h4 class="os-fhead"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 3 8l9 5 9-5z"/><path d="m3 13 9 5 9-5"/></svg>Products</h4><ul><li><a href="https://mrchartist.com" target="_blank" rel="noopener">Explore the ecosystem</a></li><li><a href="https://mrchartist.com" target="_blank" rel="noopener">Investology</a></li><li><a href="https://mrchartist.com" target="_blank" rel="noopener">Candlestick Book</a></li><li><a href="https://mrchartist.com" target="_blank" rel="noopener">Scanner Pro</a></li><li><a href="/">FII/DII Data</a></li><li><a href="https://mrchartist.com" target="_blank" rel="noopener">IPO Decode</a></li><li><a href="https://mrchartist.com" target="_blank" rel="noopener">OptionsDesk</a></li><li><a href="https://mrchartist.com" target="_blank" rel="noopener">TradeBook</a></li><li><a href="https://mrchartist.com" target="_blank" rel="noopener">NISM Exams</a></li><li><a href="https://mrchartist.com" target="_blank" rel="noopener">FundaDesk</a></li></ul></div><div class="os-fcol"><h4 class="os-fhead"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4v16M9 4v16M14 6v14M19 8v12"/></svg>Resources</h4><ul><li><a href="https://mrchartist.com" target="_blank" rel="noopener">Research Hub</a></li><li><a href="https://mrchartist.com" target="_blank" rel="noopener">ChartBook Archive</a></li><li><a href="https://mrchartist.com" target="_blank" rel="noopener">Sector Reports</a></li><li><a href="https://mrchartist.com" target="_blank" rel="noopener">Free Tools &amp; Calculators</a></li><li><a href="https://github.com/MrChartist" target="_blank" rel="noopener">Open Source Tools</a></li></ul></div><div class="os-fcol"><h4 class="os-fhead"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/></svg>Data</h4><ul><li><a href="https://www.nseindia.com/reports-indices-fii-dii-trading-activity" target="_blank" rel="noopener">NSE India</a></li><li><a href="https://www.nseindia.com/all-reports" target="_blank" rel="noopener">NSE F&amp;O Archives</a></li><li><a href="https://www.fpi.nsdl.co.in" target="_blank" rel="noopener">NSDL FPI Monitor</a></li><li><a href="/data-api.html">Data &amp; API</a></li><li><a href="/api/agents/docs" target="_blank" rel="noopener">Agent API Docs</a></li></ul></div><div class="os-fcol"><h4 class="os-fhead"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v18M5 8h14M5 8l-3 7a3 3 0 0 0 6 0zM19 8l-3 7a3 3 0 0 0 6 0z"/></svg>Legal</h4><ul><li><a href="https://mrchartist.com" target="_blank" rel="noopener">SEBI Registration</a></li><li><a href="https://mrchartist.com" target="_blank" rel="noopener">Disclaimer</a></li><li><a href="https://mrchartist.com" target="_blank" rel="noopener">Privacy Policy</a></li><li><a href="https://mrchartist.com" target="_blank" rel="noopener">Terms of Service</a></li></ul></div><div class="os-fcol"><h4 class="os-fhead"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12z"/></svg>Connect</h4><ul><li><a href="https://twitter.com/mr_chartist" target="_blank" rel="noopener">Twitter / X</a></li><li><a href="https://mrchartist.com" target="_blank" rel="noopener">YouTube</a></li><li><a href="https://mrchartist.com" target="_blank" rel="noopener">Instagram</a></li><li><a href="https://mrchartist.com" target="_blank" rel="noopener">LinkedIn</a></li><li><a href="https://mrchartist.com" target="_blank" rel="noopener">TradingView</a></li><li><a href="https://github.com/MrChartist" target="_blank" rel="noopener">GitHub</a></li></ul></div>
    </div>
    <div class="os-wordmark" aria-hidden="true">Mr. Chartist.</div>
    <section class="os-sebi" aria-label="SEBI registration">
      <h3><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6z"/><path d="m9 12 2 2 4-4"/></svg>SEBI Registered Research Analyst &mdash; INH000015297</h3>
      <div class="os-sebi-grid">
        <dl><div><dt>Trade Name:</dt><dd>INVESTOLOGY</dd></div><div><dt>Registration No:</dt><dd>INH000015297</dd></div><div><dt>Validity:</dt><dd>Mar 01, 2024 &mdash; Perpetual</dd></div></dl>
        <dl><div class="os-addr"><dt>Office Address:</dt><dd>Office No. 19, 1st Floor Poonam Estate Cluster II, BLDG NO.7, 8, 9 OPP. SURYA SHOPPING CENTER MIRA ROAD EAST, THANE, MAHARASHTRA, 401107</dd></div></dl>
      </div>
    </section>
    <div class="os-fbottom">
      <p>&copy; 2024&ndash;2026 Mr. Chartist (Investology). All rights reserved.</p>
      <p class="os-fnote">Built with conviction. For traders, by a trader.</p>
    </div>
  </div>
</footer>`;
  var doc = document;
  function $(s, r) { return (r || doc).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); }
  function html(str) { var t = doc.createElement('template'); t.innerHTML = str.trim(); return t.content; }

  /* ---- 1. Shared chrome, mounted once per page ---- */
  function mountChrome() {
    var nm = $('#os-nav-mount'), fm = $('#os-footer-mount');
    var active = nm ? (nm.getAttribute('data-active') || 't-hero') : 't-hero';
    var onHome = active !== 'deals';
    if (nm) {
      var frag = html(NAV);
      $$('.tab', frag).forEach(function (t) {
        var id = t.getAttribute('data-tab');
        t.classList.toggle('active', id === active);
        if (id !== 'deals') { t.setAttribute('role', 'button'); t.tabIndex = 0; }
        if (!onHome && id !== 'deals') {
          var go = function () { location.href = '/#' + id; };
          t.removeAttribute('onclick'); t.addEventListener('click', go);
          t.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
        } else if (id !== 'deals') {
          t.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); t.click(); } });
        }
      });
      $$('.tab[data-tab="deals"]', frag).forEach(function (t) { if (active === 'deals') t.setAttribute('aria-current', 'page'); });
      nm.parentNode.insertBefore(frag, nm); nm.parentNode.removeChild(nm);
    }
    if (fm) { fm.parentNode.insertBefore(html(FOOT), fm); fm.parentNode.removeChild(fm); }
  }
  mountChrome();

  /* deep links: /#t-fno etc. */
  function deepLink() {
    var id = (location.hash || '').replace('#', '');
    if (!/^t-(hero|fno|matrix|sector)$/.test(id) || typeof window.switchMainTab !== 'function') return;
    window.switchMainTab(id);
    if (id === 't-sector') { try { window.renderSectors(); window.renderSectorChart(); } catch (e) {} }
  }
  window.addEventListener('load', function () { setTimeout(deepLink, 400); });

  /* theme fallback for pages without the dashboard script */
  if (typeof window.toggleTheme !== 'function') {
    window.toggleTheme = function () {
      var h = doc.documentElement, d = h.getAttribute('data-theme') === 'dark';
      h.setAttribute('data-theme', d ? 'light' : 'dark');
      try { localStorage.setItem('theme', d ? 'light' : 'dark'); } catch (e) {}
    };
  }

  /* ---- 2. Live chip mirrors the existing status pill text ---- */
  function syncLive() {
    var src = $('#sTxt'), pill = $('#sPill');
    var chips = $$('[data-os-live]');
    if (!chips.length) return;
    if (!src) return;
    function upd() {
      var t = (src.textContent || '').replace(/\s+/g, ' ').trim();
      var label = /REFRESH IN/i.test(t) ? 'Live' : t.replace(/^LIVE\s*[\u2022•]\s*/i, 'Live \u00b7 ');
      if (/^loading/i.test(t)) label = 'Connecting';
      if (label.length > 26) label = label.slice(0, 25) + '\u2026';
      var bad = pill && /err/.test(pill.className);
      chips.forEach(function (c) { c.querySelector('span').textContent = label; c.classList.toggle('err', !!bad); c.title = t; });
    }
    new MutationObserver(upd).observe(src, { childList: true, characterData: true, subtree: true });
    if (pill) new MutationObserver(upd).observe(pill, { attributes: true, attributeFilter: ['class'] });
    upd();
  }
  syncLive();

  /* ---- 3. Dropdown menu in navbar ---- */
  function initMenu() {
    $$('.os-menu').forEach(function (m) {
      var b = $('.os-menu-btn', m), p = $('.os-menu-pop', m);
      function close() { p.hidden = true; b.setAttribute('aria-expanded', 'false'); }
      b.addEventListener('click', function (e) { e.stopPropagation(); var o = p.hidden; p.hidden = !o; b.setAttribute('aria-expanded', String(o)); });
      doc.addEventListener('click', function (e) { if (!m.contains(e.target)) close(); });
      doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !p.hidden) { close(); b.focus(); } });
    });
  }
  initMenu();

  /* ---- 4. Dock the Customise button (created later by os27-charts.js) ---- */
  var mq = window.matchMedia('(max-width: 900px)');
  function dock() {
    var b = $('.os27-cust-btn'); if (!b) return false;
    var host = mq.matches ? $('.os-topbar') : $('#navMore .os-menu-pop');
    if (!host || b.parentNode === host) return true;
    if (mq.matches) host.insertBefore(b, $('.os-cta', host)); else host.insertBefore(b, host.firstChild);
    b.classList.add('os-docked');
    return true;
  }
  function watchDock() {
    if (dock()) { if (mq.addEventListener) mq.addEventListener('change', dock); return; }
    var n = 0, t = setInterval(function () { if (dock() || ++n > 40) { clearInterval(t); if (mq.addEventListener) mq.addEventListener('change', dock); } }, 250);
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', watchDock); else watchDock();

  /* ---- 5. Info popovers: generic, reusable ---- */
  var infoSeq = 0, openInfo = null;
  function closeInfo() { if (!openInfo) return; openInfo.pop.hidden = true; openInfo.btn.setAttribute('aria-expanded', 'false'); openInfo.root.classList.remove('open'); var bd = $('.os-info-backdrop'); if (bd) bd.hidden = true; openInfo = null; }
  function makeInfo(target, opts) {
    if (!target || target.closest('.os-info-pop')) return null;
    opts = opts || {};
    var id = 'os-info-' + (++infoSeq);
    var root = doc.createElement('span'); root.className = 'os-info';
    var btn = doc.createElement('button'); btn.type = 'button'; btn.className = 'os-info-btn';
    btn.setAttribute('aria-label', opts.label || 'More information'); btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-controls', id);
    btn.innerHTML = '<span aria-hidden="true">i</span>';
    var pop = doc.createElement('div'); pop.className = 'os-info-pop'; pop.id = id; pop.hidden = true; pop.setAttribute('role', 'note');
    var head = doc.createElement('div'); head.className = 'os-info-head';
    head.innerHTML = '<strong></strong><button type="button" class="os-info-x" aria-label="Close">&times;</button>';
    head.firstChild.textContent = opts.title || opts.label || 'Guide';
    pop.appendChild(head);
    if (opts.into) { opts.into.appendChild(root); } else { target.parentNode.insertBefore(root, target); }
    root.appendChild(btn); root.appendChild(pop);
    pop.appendChild(target);
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (openInfo && openInfo.btn === btn) { closeInfo(); return; }
      closeInfo();
      pop.hidden = false; btn.setAttribute('aria-expanded', 'true'); root.classList.add('open');
      var bd = $('.os-info-backdrop'); if (bd && window.matchMedia('(max-width: 640px)').matches) bd.hidden = false;
      openInfo = { btn: btn, pop: pop, root: root };
      var r = pop.getBoundingClientRect();
      root.classList.toggle('flip-x', r.right > innerWidth - 8);
      if (r.left < 8) root.classList.add('flip-l');
    });
    $('.os-info-x', head).addEventListener('click', function () { closeInfo(); btn.focus(); });
    return root;
  }
  window.OSUI = window.OSUI || {}; window.OSUI.info = makeInfo;
  doc.addEventListener('click', function (e) { if (openInfo && !openInfo.root.contains(e.target)) closeInfo(); });
  doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && openInfo) { var b = openInfo.btn; closeInfo(); b.focus(); } });

  function initInfos() {
    var bd = doc.createElement('div'); bd.className = 'os-info-backdrop'; bd.hidden = true; bd.addEventListener('click', closeInfo); doc.body.appendChild(bd);
    var sec = $('#t-sector h2');
    var mb = $('.methodology-banner'); if (mb && sec) makeInfo(mb, { label: 'How is sector data calculated', title: 'How is this data calculated?', into: sec });
    var ex = $('#sec-chart-explainer');
    if (ex) { var ttl = $('#sec-chart-card > div > div > div'); makeInfo(ex, { label: 'About this chart', title: 'About this chart', into: ttl || null }); }
    ['#t-matrix', '#t-fno'].forEach(function (p) {
      var sub = $(p + ' .hero-banner-subtitle'), tt = $(p + ' .hero-banner-title');
      if (sub && tt) makeInfo(sub, { label: 'About this page', title: 'About this page', into: tt });
    });
    $$('.os-legend').forEach(function (l) { makeInfo(l, { label: 'Colour guide', title: 'Colour guide' }); });
    $$('.heatmap-legend').forEach(function (l) { makeInfo(l, { label: 'Heatmap scale', title: 'Heatmap scale' }); });
    var cl = $('.chart-legend'); if (cl) makeInfo(cl, { label: 'Chart legend', title: 'Chart legend' });
    $$('#t-sector > .card > div').forEach(function (d) {
      if (/Net Inflow \(fortnight\)/.test(d.textContent) && d.children.length === 3) makeInfo(d, { label: 'Legend and update schedule', title: 'Legend' });
    });
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', initInfos); else initInfos();
})();
