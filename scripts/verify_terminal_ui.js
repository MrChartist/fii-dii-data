const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'public', 'index.html');
const html = fs.readFileSync(indexPath, 'utf8');
const dealsHtml = fs.readFileSync(path.join(__dirname, '..', 'public', 'deals.html'), 'utf8');

const requiredMarkers = [
  ['terminal theme class', 'terminal-shell'],
  ['command grid', 'terminal-command-grid'],
  ['cash tape', 'cmd-cash-tape'],
  ['signal stack', 'cmd-signal-stack'],
  ['momentum stack', 'cmd-momentum-stack'],
  ['F&O snapshot', 'cmd-fno-snapshot'],
  ['F&O 3D chart shell', 'fno-3d-chart'],
  ['F&O 3D pressure bars', 'fno-3d-bar'],
  ['sector rotation', 'cmd-sector-rotation'],
  ['heatmap rail', 'cmd-heatmap-rail'],
  ['recent sessions body', 'cmd-recent-body'],
  ['command center renderer', 'function renderCommandCenter()'],
  ['main website display font', 'Plus Jakarta Sans'],
  ['primary UI font', 'Inter:wght@400;500;600;700;800'],
  ['terminal mono font', 'JetBrains Mono'],
  ['product row', 'terminal-product-row'],
  ['command summary', 'terminal-summary-grid'],
  ['dark-first default', 'data-theme="dark"'],
  ['recent-session signal pills', 'signal-pill'],
  ['FII & DII brand', 'FII & DII'],
  // Roadmap features (June 2026)
  ['signal replay strip', 'id="signal-timeline"'],
  ['signal timeline renderer', 'function renderSignalTimeline()'],
  ['provisional data chip', 'id="provChip"'],
  ['glossary tooltips', 'class="gloss"'],
  ['cumulative vs NIFTY view', 'function renderCumulativeChart('],
  ['long-short ratio chart', 'function renderLsRatioChart()'],
  ['live rollup recompute', 'function recomputeRollups()'],
  ['first-visit tour', 'function initTour('],
  ['sticky KPI strip', 'id="stickyKpi"'],
  ['NSDL confirmation line', 'id="nsdlConfirm"'],
  ['design system stylesheet', '/css/mc.css'],
  ['dashboard stylesheet', '/css/mc-dashboard.css'],
  ['shared chrome script', '/js/mc-ui.js'],
  ['safe-area viewport', 'viewport-fit=cover'],
  ['self-hosted chart.js', '/vendor/chart-3.9.1.min.js'],
  ['HTML escaping helper', 'function escapeHtml(']
];

const missing = requiredMarkers.filter(([, marker]) => !html.includes(marker));
if (!dealsHtml.includes('id="large-deals-card"')) missing.push(['bulk/block deals panel (deals.html)', 'id="large-deals-card"']);
for (const f of ['css/mc.css', 'css/mc-dashboard.css', 'js/mc-ui.js', 'js/mc-brand.js', 'js/mc-charts.js', 'js/mc-motion.js', 'js/mc-ranges.js', 'js/mc-deals.js']) {
  if (!fs.existsSync(path.join(__dirname, '..', 'public', f))) missing.push(['front-end file', f]);
}

if (html.includes('FLOWMATRIX')) {
  missing.push(['legacy nav brand still visible', 'FLOWMATRIX must be removed']);
}

if (html.includes('DM Serif Display')) {
  missing.push(['leftover serif font still loaded', 'DM Serif Display must be removed']);
}

if (missing.length) {
  console.error('Terminal UI contract failed:');
  for (const [label, marker] of missing) {
    console.error(`- Missing ${label}: ${marker}`);
  }
  process.exit(1);
}

console.log(`Terminal UI contract passed (${requiredMarkers.length} markers).`);
