const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'public', 'index.html');
const html = fs.readFileSync(indexPath, 'utf8');

const requiredMarkers = [
  ['terminal theme class', 'terminal-shell'],
  ['command grid', 'terminal-command-grid'],
  ['cash tape', 'cmd-cash-tape'],
  ['signal stack', 'cmd-signal-stack'],
  ['momentum stack', 'cmd-momentum-stack'],
  ['F&O snapshot', 'cmd-fno-snapshot'],
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
  ['pro terminal 2 polish layer', 'Pro Terminal 2.0'],
  ['manual readability tuning layer', 'Pro Terminal 2.1'],
  ['scanability polish layer', 'Pro Terminal 2.2'],
  ['iOS-level card finish layer', 'Pro Terminal 2.3'],
  ['public-ready terminal finish layer', 'Pro Terminal 2.4'],
  ['original website theme alignment layer', 'Pro Terminal 2.5'],
  ['final typography normalization layer', 'Pro Terminal 2.6'],
  ['recent-session signal pills', 'signal-pill'],
  ['FII & DII brand', 'FII & DII']
];

const missing = requiredMarkers.filter(([, marker]) => !html.includes(marker));

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
