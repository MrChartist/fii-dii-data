/* mc-footer: the Mr. Chartist ecosystem footer — one component for every product.
   Usage:  MCFooter.html({ product: { name, blurb, tagline, head, links: [[label, href], …] }, brand: '<lockup html>', note: 'extra line' })
   The ecosystem columns (Products, Resources, Legal, Connect) and the SEBI card live here so every project stays identical;
   a product only supplies its own column. Mirrors the structure of mrchartist.com. */
(function (root) {
  'use strict';
  var EXT = '<svg class="os-fext" viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>';
  var SITE = 'https://mrchartist.com';

  var ECOSYSTEM = {
    products: [
      ['All products', SITE + '/products'], ['Investology', 'https://investology.mrchartist.com/'], ['Trading Books', SITE + '/books'],
      ['Scanner Pro', 'https://scanner.mrchartist.com'], ['IPO Decode', 'https://ipodecode.mrchartist.com'], ['OptionsDesk', 'https://optionsdesk.mrchartist.com'],
      ['TradeBook', 'https://tradebook.mrchartist.com'], ['NISM Exams', SITE + '/nism-exams'], ['FundaDesk', 'https://funda.mrchartist.com']
    ],
    resources: [
      ['Market Academy', SITE + '/learn'], ['Research Hub', SITE + '/research'], ['Market Radar', SITE + '/market-radar'], ['ChartBook Archive', SITE + '/research/archive'],
      ['Free Tools', SITE + '/tools'], ['IPO Tracker', SITE + '/ipo'], ['Open Source Tools', SITE + '/open-source']
    ],
    legal: [
      ['SEBI registration', '/terms.html#regulatory'], ['Investor Charter', 'https://investology.mrchartist.com/compliance/investor-charter'],
      ['Grievance redressal', '/terms.html#grievance'], ['Disclaimer', '/terms.html#disclaimer'], ['Privacy policy', '/privacy.html'],
      ['Terms of service', '/terms.html'], ['About', '/about.html'], ['Contact', '/contact.html']
    ],
    social: [
      ['X', 'https://x.com/Mr_Chartist'], ['YouTube', 'https://www.youtube.com/mr_chartist'], ['Instagram', 'https://instagram.com/mrchartist'],
      ['LinkedIn', 'https://www.linkedin.com/in/rohit-mrchartist/'], ['TradingView', 'https://tradingview.com/u/MrChartist'],
      ['WhatsApp Channel', 'https://whatsapp.com/channel/0029VaDUeH159PwXDwq8yI1I'], ['GitHub', 'https://github.com/MrChartist']
    ]
  };

  var SEBI = {
    trade: 'INVESTOLOGY', reg: 'INH000015297', validity: 'Mar 01, 2024 &mdash; Perpetual',
    address: 'VO 872, WeWork NESCO IT Park, 10th Floor, Building 4, Western Express Highway, Goregaon (East), Mumbai, Maharashtra 400063',
    disclaimer: 'Investment in securities market are subject to market risks. Read all related documents carefully before investing. Registration granted by SEBI and certification from NISM in no way guarantee performance of the intermediary or provide any assurance of returns to investors. Educational material is distinct from regulated research. Read the applicable research disclosures and client terms before using a research service.'
  };

  function ico(path) { return '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + '</svg>'; }
  var SOCIAL_ICON = {
    'X': '<path d="M18 6 6 18M6 6l12 12"/>',
    'YouTube': '<path d="M2.5 17a24.1 24.1 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.6 49.6 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.1 24.1 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.5 49.5 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><path d="m10 15 5-3-5-3z"/>',
    'Instagram': '<rect width="20" height="20" x="2" y="2" rx="5"/><path d="M16 11.4A4 4 0 1 1 12.6 8 4 4 0 0 1 16 11.4z"/><path d="M17.5 6.5h.01"/>',
    'LinkedIn': '<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/>',
    'TradingView': '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    'WhatsApp Channel': '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z"/>',
    'GitHub': '<path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.1-1.25-.3-2.5-1-3.5.3-1.15.3-2.35 0-3.5 0 0-1 0-3 1.5-2.6-.5-5.4-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.4.5-.7 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.5 2-5-2-7-2"/>'
  };
  function isExternal(h) { return /^https?:/.test(h); }
  function col(title, icon, links, open) {
    return '<nav class="os-fcol' + (open ? ' open' : '') + '" aria-label="' + title + '"><h4 class="os-fhead" role="button" tabindex="0" aria-expanded="' + (open ? 'true' : 'false') + '">' + icon + '<span>' + title + '</span></h4><ul>' + links.map(function (l) {
      var ext = isExternal(l[1]), si = SOCIAL_ICON[l[0]];
      return '<li><a href="' + l[1] + '"' + (ext ? ' target="_blank" rel="noopener"' : '') + '>' + (si ? '<span class="os-fsoc">' + ico(si) + '</span>' : '') + l[0] + (ext && !si ? EXT : '') + '</a></li>';
    }).join('') + '</ul></nav>';
  }
  var I = {
    grid: ico('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'),
    box: ico('<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/>'),
    book: ico('<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M19 17H6a2 2 0 0 0-2 2"/>'),
    scale: ico('<path d="M12 3v18M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"/>'),
    chat: ico('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>')
  };

  function html(o) {
    o = o || {}; var p = o.product || {};
    return '<footer class="os-footer" aria-label="Site footer"><div class="os-footer-card">' +
      '<div class="os-fscene" aria-hidden="true"><svg class="os-fart" viewBox="0 0 1200 260" preserveAspectRatio="none" aria-hidden="true" focusable="false"><defs><linearGradient id="osfA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity=".30"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs><g class="os-fgrid"><path d="M0 65H1200M0 130H1200M0 195H1200"/></g><path class="os-fa-area" d="M0,170 C80,150 120,200 200,160 S320,90 400,130 S520,210 600,150 S720,60 800,110 S940,190 1020,120 S1130,60 1200,90 L1200,260 L0,260Z" fill="url(#osfA)"/><path class="os-fline os-fline--a" pathLength="1" d="M0,170 C80,150 120,200 200,160 S320,90 400,130 S520,210 600,150 S720,60 800,110 S940,190 1020,120 S1130,60 1200,90"/><path class="os-fline os-fline--b" pathLength="1" d="M0,200 C90,215 150,170 240,190 S360,230 440,185 S560,120 650,170 S780,230 860,175 S990,120 1080,150 S1160,190 1200,160"/></svg><span class="os-fglow os-fglow--a"></span><span class="os-fglow os-fglow--b"></span><span class="os-fglow os-fglow--c"></span><span class="os-fgrain"></span></div>' +
      '<div class="os-footer-grid">' +
        '<div class="os-fbrand">' +
          '<div class="os-fbrand-name">' + (o.brand || '') + '</div>' +
          '<p>' + (p.blurb || '') + '</p>' +
          '<p class="os-ftag">' + (p.tagline || '') + '</p>' +
          '<a class="os-fcta" href="' + SITE + '" target="_blank" rel="noopener">Visit mrchartist.com' + EXT + '</a>' +
        '</div>' +
        col(p.head || 'Product', I.grid, p.links || [], true) +
        col('Products', I.box, ECOSYSTEM.products) +
        col('Resources', I.book, ECOSYSTEM.resources) +
        col('Legal', I.scale, ECOSYSTEM.legal) +
        col('Connect', I.chat, ECOSYSTEM.social) +
      '</div>' +
      '<div class="os-wordmark" aria-hidden="true">' + (p.name || 'Mr. Chartist') + '<i>.</i></div>' +
      '<section class="os-sebi" aria-label="SEBI registration">' +
        '<h3>' + ico('<path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6z"/><path d="m9 12 2 2 4-4"/>').replace('width="14" height="14"', 'width="18" height="18"') + 'INVESTOLOGY &middot; SEBI Registered Research Analyst &mdash; ' + SEBI.reg + '</h3>' +
        '<div class="os-sebi-grid">' +
          '<dl><div><dt>Trade name:</dt><dd>' + SEBI.trade + '</dd></div><div><dt>Registration no:</dt><dd>' + SEBI.reg + '</dd></div><div><dt>Validity:</dt><dd>' + SEBI.validity + '</dd></div></dl>' +
          '<dl><div class="os-addr"><dt>Office address:</dt><dd>' + SEBI.address + '</dd></div></dl>' +
          '<p class="os-fdisc"><b>Disclaimer:</b> ' + SEBI.disclaimer + (o.note ? ' ' + o.note : '') + '</p>' +
        '</div>' +
      '</section>' +
      '<div class="os-fbottom">' +
        '<p>&copy; 2024&ndash;' + new Date().getFullYear() + ' Mr. Chartist (Investology) &middot; All rights reserved &middot; Personal use only.</p>' +
        '<p class="os-fnote">Built with conviction. For traders, by a trader.</p>' +
      '</div>' +
    '</div></footer>';
  }

  /* Phones: link columns collapse into an accordion (the footer is otherwise ~2,000px tall). Desktop ignores it. */
  function bind(footer) {
    if (!footer) return;
    var mq = root.matchMedia ? root.matchMedia('(max-width: 760px)') : { matches: false };
    function toggle(h) {
      if (!mq.matches) return;
      var c = h.parentNode, on = !c.classList.contains('open');
      c.classList.toggle('open', on); h.setAttribute('aria-expanded', on ? 'true' : 'false');
    }
    footer.addEventListener('click', function (e) { var h = e.target.closest && e.target.closest('.os-fhead'); if (h) toggle(h); });
    footer.addEventListener('keydown', function (e) {
      var h = e.target.closest && e.target.closest('.os-fhead');
      if (h && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggle(h); }
    });
  }

  root.MCFooter = { html: html, bind: bind, ecosystem: ECOSYSTEM, sebi: SEBI };
})(window);
