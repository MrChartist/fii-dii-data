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

  /* ---- 2. Move the old header controls into the single navbar (elements are moved, not recreated) ---- */
  var movedLive = null;
  function mergeHeader() {
    var src = $('#hdrControls'), navA = $('.tabs-wrap .nav-actions'), pop = $('#navMore .os-menu-pop');
    var chips = $$('[data-os-live]');
    if (!src) { chips.forEach(function (c) { c.parentNode.removeChild(c); }); return; }
    var pill = $('#sPill'), theme = $('#btnTheme');
    chips.forEach(function (c) { c.parentNode.removeChild(c); });
    if (theme && navA) { theme.className = 'nav-icon-btn'; theme.title = 'Toggle theme'; theme.setAttribute('aria-label', 'Toggle theme'); navA.insertBefore(theme, navA.firstChild); var old = $('.tabs-wrap .nav-actions > .nav-icon-btn:not(#btnTheme)'); if (old && !old.classList.contains('os-menu-btn')) old.parentNode.removeChild(old); }
    if (pill && navA) { pill.classList.add('os-live-pill'); navA.insertBefore(pill, navA.firstChild); movedLive = pill; }
    var order = ['#btnInstall', '#btnNotify', '#btnRefresh'];
    var labels = { '#btnInstall': 'Install app', '#btnNotify': 'Get alerts', '#btnRefresh': 'Force sync' };
    order.forEach(function (sel) { var b = $(sel); if (b && pop) { b.classList.add('os-menu-item'); pop.insertBefore(b, pop.firstChild ? $('.nav-tg-btn', pop) : null); } });
    var snap = $('#hdrControls button[onclick^="exportDOM"]'); if (snap && pop) { snap.classList.add('os-menu-item'); snap.removeAttribute('style'); pop.insertBefore(snap, $('.nav-tg-btn', pop)); }
    var share = $('#btnShare'); if (share && pop) { var wrap = share.parentNode; wrap.className = 'os-share-wrap'; wrap.removeAttribute('style'); share.classList.add('os-menu-item'); share.removeAttribute('style'); pop.insertBefore(wrap, $('.nav-tg-btn', pop)); }
    if (src.parentNode) src.parentNode.removeChild(src);
  }
  mergeHeader();

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

  /* ---- 4. Dock: Customise into the More menu (charts.js creates it later); on phones the menu and live pill sit in the top bar ---- */
  var mq = window.matchMedia('(max-width: 768px)');
  function dockMenu() {
    var more = $('#navMore'), top = $('.os-topbar'), navA = $('.tabs-wrap .nav-actions');
    if (!more || !top || !navA) return;
    if (mq.matches) { if (more.parentNode !== top) top.insertBefore(more, $('.os-cta', top)); if (movedLive && movedLive.parentNode !== top) top.insertBefore(movedLive, $('.os-round-btn', top)); }
    else { if (more.parentNode !== navA) navA.insertBefore(more, $('.os-cta', navA)); if (movedLive && movedLive.parentNode !== navA) navA.insertBefore(movedLive, navA.firstChild); }
    dockCust();
  }
  function dockCust() {
    var b = $('.os27-cust-btn'); if (!b) return false;
    var more = $('#navMore'); if (!more) return false;
    if (b.parentNode !== more.parentNode || b.nextSibling !== more) more.parentNode.insertBefore(b, more);
    b.classList.add('os-docked'); return true;
  }
  function watchDock() {
    dockMenu(); if (mq.addEventListener) mq.addEventListener('change', dockMenu);
    if (dockCust()) return;
    var n = 0, t = setInterval(function () { if (dockCust() || ++n > 40) clearInterval(t); }, 250);
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', watchDock); else watchDock();

  /* ---- 5. Info popovers: generic, reusable ---- */
  var infoSeq = 0, openInfo = null;
  function closeInfo() { if (!openInfo) return; openInfo.pop.hidden = true; openInfo.root.appendChild(openInfo.pop); openInfo.btn.setAttribute('aria-expanded', 'false'); openInfo.root.classList.remove('open'); var bd = $('.os-info-backdrop'); if (bd) bd.hidden = true; openInfo = null; }
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
      doc.body.appendChild(pop); /* portal: cards clip overflow and create containing blocks */
      pop.hidden = false; btn.setAttribute('aria-expanded', 'true'); root.classList.add('open');
      var sheet = window.matchMedia('(max-width: 640px)').matches;
      var bd = $('.os-info-backdrop'); if (bd && sheet) bd.hidden = false;
      openInfo = { btn: btn, pop: pop, root: root };
      if (sheet) { pop.style.left = pop.style.top = ''; pop.classList.add('sheet'); }
      else {
        pop.classList.remove('sheet');
        var br = btn.getBoundingClientRect(), pw = Math.min(380, innerWidth - 32);
        var left = Math.max(16, Math.min(br.left, innerWidth - pw - 16));
        var top = br.bottom + 8, maxH = innerHeight - top - 16;
        if (maxH < 180) { top = Math.max(16, br.top - 8 - Math.min(460, br.top - 24)); maxH = br.top - 24; }
        pop.style.left = left + 'px'; pop.style.top = top + 'px'; pop.style.maxHeight = Math.max(160, maxH) + 'px';
      }
    });
    $('.os-info-x', head).addEventListener('click', function () { closeInfo(); btn.focus(); });
    return root;
  }
  window.OSUI = window.OSUI || {}; window.OSUI.info = makeInfo;
  doc.addEventListener('click', function (e) { if (openInfo && !openInfo.root.contains(e.target)) closeInfo(); });
  doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && openInfo) { var b = openInfo.btn; closeInfo(); b.focus(); } });

  function textOf(e) { return (e.textContent || '').replace(/\s+/g, ' ').trim(); }
  function makeText(label, title, text) {
    var p = doc.createElement('p'); p.textContent = text; p.style.margin = '0';
    return makeInfo(p, { label: 'About ' + title, title: title, into: label });
  }
  /* one info button per title; further content merges into the same popover */
  function attach(target, into, label, title) {
    if (!target || !into) return;
    var host = $('.os-info', into);
    if (host) { var pop = $('.os-info-pop', host); var sep = doc.createElement('div'); sep.style.cssText = 'margin-top:12px;padding-top:12px;border-top:1px solid var(--os-hairline, rgb(128 128 128 / .25))'; sep.appendChild(target); pop.appendChild(sep); return; }
    makeInfo(target, { label: label, title: title, into: into });
  }
  var LIQ = 'Net of FII and DII cash flows for the session. A negative value means institutions together took money out of the market; a positive value means they added money.';
  var TEXTS = {
    'Market Strength': 'Overall reading of institutional buying against selling. A higher score means stronger buying support.',
    'Stock Strength': 'Reading of stock-level participation. A higher score means healthier participation.',
    'F&O Sentiment': 'Direction of derivatives positioning. A negative value leans bearish and a positive value leans bullish.',
    'Combined Liquidity': LIQ, 'Combined Liquidity Drain': LIQ, 'Combined Liquidity Support': LIQ,
    'FII Streak': 'Number of sessions in a row in which FIIs were net sellers or net buyers.',
    'DII Streak': 'Number of sessions in a row in which DIIs were net sellers or net buyers.',
    '5D FII Velocity': 'Total FII net flow over the last five sessions, with the daily average.',
    'Bloodbath / Absorb': 'Bloodbath days are sessions where FII net selling was worse than ₹5,000 Cr. Absorb days are sessions where DII net buying was above ₹5,000 Cr.',
    'Call / Put Net': 'Net FII position in index call options against put options. More calls than puts leans bullish.',
    'Bias': 'Overall direction taken from FII index-futures and options positioning.',
    'Futures Net': 'Net FII index-futures contracts: long minus short.'
  };
  var PREFIX = [
    ['FII Long-Short Ratio', 'FII index-futures long contracts divided by short contracts. Above 1 means net long (bullish positioning). Extremes against its own history matter more than a single reading.'],
    ['Historical Institutional Positioning', 'Net contracts held by FIIs and DIIs over time. Use it to see whether positioning is building or unwinding.']
  ];
  function lookup(k) { if (TEXTS[k]) return TEXTS[k]; for (var i = 0; i < PREFIX.length; i++) if (k.indexOf(PREFIX[i][0]) === 0) return PREFIX[i][1]; return null; }
  function scanTexts() {
    $$('#t-hero span, #t-hero div, #t-fno span, #t-fno div').forEach(function (e) {
      if (e.children.length > 0 || e.closest('.os-info-pop') || e.closest('.os-info')) return;
      var k = textOf(e), t = k.length < 60 && lookup(k);
      if (!t) return;
      var host = e.classList.contains('gloss') ? e.parentNode : e;
      if (!$('.os-info', host)) makeText(host, k.replace(/ \(.*\)$/, ''), t);
    });
  }
  function initInfos() {
    var bd = doc.createElement('div'); bd.className = 'os-info-backdrop'; bd.hidden = true; bd.addEventListener('click', closeInfo); doc.body.appendChild(bd);
    var sec = $('#t-sector h2');
    attach($('.methodology-banner'), sec, 'How is sector data calculated', 'How is this data calculated?');
    var lg = null; $$('#t-sector > .card > div').forEach(function (d) { if (/Net Inflow \(fortnight\)/.test(d.textContent) && d.children.length === 3) lg = d; });
    attach(lg, sec, 'Legend and update schedule', 'Legend');
    attach($('#sec-chart-explainer'), $('#sec-chart-card > div > div > div'), 'About this chart', 'About this chart');
    ['#t-matrix', '#t-fno'].forEach(function (p) { attach($(p + ' .hero-banner-subtitle'), $(p + ' .hero-banner-title'), 'About this page', 'About this page'); });
    var lg1 = $$('.os-legend'), hm = $$('.heatmap-legend');
    attach(lg1[0], $('#cmd-cash-tape .terminal-label'), 'Colour guide', 'Colour guide');
    var ft = $$('#t-hero .c-title');
    var fiiT = ft.filter(function (e) { return /FII 45-Day/.test(e.textContent); })[0], diiT = ft.filter(function (e) { return /DII 45-Day/.test(e.textContent); })[0];
    attach(lg1[1], fiiT, 'Colour guide', 'Colour guide'); attach(hm[0], fiiT, 'Heatmap scale', 'Heatmap scale');
    attach(hm[1], diiT, 'Heatmap scale', 'Heatmap scale');
    var cv = $('#btnFlowView'); attach($('.chart-legend'), cv && cv.parentNode, 'Chart legend', 'Chart legend');
    scanTexts();
    var t = null; new MutationObserver(function () { clearTimeout(t); t = setTimeout(scanTexts, 250); }).observe(doc.body, { childList: true, subtree: true });
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', initInfos); else initInfos();

  /* ---- 6. Live quotes: single shared poll for Nifty 50, Sensex and India VIX (same ids as the original ticker) ---- */
  function initTicker() {
    if (!$('#marketTicker')) return;
    var KEY = 'os27-quotes', last = 0, timer = null, prev = {}, inflight = false;
    function fmt(n) { return Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
    function ist() { var n = new Date(); return new Date(n.getTime() + 5.5 * 3600e3 + n.getTimezoneOffset() * 60e3); }
    function live() { var d = ist(), m = d.getHours() * 60 + d.getMinutes(), w = d.getDay(); return w > 0 && w < 6 && m >= 540 && m <= 945; }
    function zone(v) { return v < 14 ? ['Low Fear', 'low'] : v < 20 ? ['Normal', 'normal'] : v < 30 ? ['Elevated', 'elevated'] : ['High Fear', 'high']; }
    function flash(el, dir) { if (!el) return; el.classList.remove('tick-up', 'tick-down'); void el.offsetWidth; el.classList.add(dir > 0 ? 'tick-up' : 'tick-down'); setTimeout(function () { el.classList.remove('tick-up', 'tick-down'); }, 1000); }
    function put(k, q, pe, ce, invert) {
      var p = $(pe), c = $(ce); if (!q || !p || !c || !isFinite(q.price)) return;
      p.textContent = fmt(q.price);
      if (prev[k] != null && prev[k] !== q.price) flash(p, q.price > prev[k] ? 1 : -1);
      prev[k] = q.price;
      var pct = Number(q.pct) || 0, band = invert ? 0.5 : 0.05;
      c.textContent = (pct >= 0 ? '▲ +' : '▼ ') + pct.toFixed(2) + '%';
      c.className = 'ticker-change ' + (invert ? (pct > band ? 'down' : pct < -band ? 'up' : 'flat') : (pct > band ? 'up' : pct < -band ? 'down' : 'flat'));
    }
    function render(d, cached) {
      put('n', d.nifty, '#tickerNiftyPrice', '#tickerNiftyChange', false);
      put('s', d.sensex, '#tickerSensexPrice', '#tickerSensexChange', false);
      put('v', d.vix, '#tickerVixPrice', '#tickerVixChange', true);
      if (d.vix) { var z = zone(d.vix.price), ze = $('#tickerVixZone'); if (ze) { ze.textContent = z[0]; ze.className = 'vix-zone ' + z[1]; } }
      var ts = $('#tickerUpdatedAt'), dot = $('#tickerDot');
      if (ts) { var t = new Date(d.ts || Date.now()); ts.textContent = 'Updated ' + t.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) + (d.stale ? ' (delayed)' : ''); ts.classList.toggle('cached', !!cached); }
      if (dot) dot.className = 'ticker-live-dot' + (cached || d.stale ? ' stale' : '');
    }
    function schedule() { clearTimeout(timer); if (doc.hidden) return; timer = setTimeout(poll, live() ? 15000 : 300000); }
    function poll() {
      if (inflight || doc.hidden) { schedule(); return; }
      inflight = true; last = Date.now();
      var ac = window.AbortController ? new AbortController() : null, to = setTimeout(function () { if (ac) ac.abort(); }, 8000);
      fetch('/api/market', { cache: 'no-store', signal: ac ? ac.signal : undefined })
        .then(function (r) { if (!r.ok) throw new Error('bad'); return r.json(); })
        .then(function (d) { render(d, false); try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} })
        .catch(function () {
          var ts = $('#tickerUpdatedAt'), dot = $('#tickerDot'); if (dot) dot.className = 'ticker-live-dot stale';
          if (!ts) return;
          if (/Updated/.test(ts.textContent)) { if (!/\(delayed\)$/.test(ts.textContent)) ts.textContent += ' (delayed)'; } else ts.textContent = 'Market data unavailable';
        })
        .then(function () { clearTimeout(to); inflight = false; schedule(); });
    }
    try { var c = JSON.parse(localStorage.getItem(KEY) || 'null'); if (c && (c.nifty || c.vix)) render(c, true); } catch (e) {}
    doc.addEventListener('visibilitychange', function () { if (doc.hidden) clearTimeout(timer); else if (Date.now() - last > 3000) poll(); else schedule(); });
    poll();
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', initTicker); else initTicker();
})();
