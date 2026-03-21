const fs = require('fs');

const file = 'fii_dii_india_flows_dashboard.html';
let html = fs.readFileSync(file, 'utf8');

// 1. Extract Daily Trends
const dailyTrendsStart = html.indexOf('<!-- ── FPI Daily Trends Card ── -->');
const dailyTrendsEnd = html.indexOf('<!-- ── FPI Sector Flow Heatmap ── -->');
const dailyTrendsChunk = html.substring(dailyTrendsStart, dailyTrendsEnd);

html = html.slice(0, dailyTrendsStart) + html.slice(dailyTrendsEnd);

// 2. Insert Daily Trends into t-macro below Hero Banner
const macroHeroEnd = html.indexOf('    <!-- Quick Stats Row -->');
html = html.slice(0, macroHeroEnd) + dailyTrendsChunk + '\n' + html.slice(macroHeroEnd);

// 3. Extract Deep Dive section
const deepDiveStart = html.indexOf('<!-- ── Trade-Wise Flow Card ── -->');
const deepDiveEnd = html.indexOf('  </div><!-- /t-sector -->');

const deepDiveChunk = html.substring(deepDiveStart, deepDiveEnd);

// Remove from old location (keep the closing tag for t-sector)
html = html.slice(0, deepDiveStart) + html.slice(deepDiveEnd);

// 4. Wrap Deep Dive chunk in its own tab and insert right before t-fno
const newDeepDivePanel = `
  <!-- TAB: DEEP DIVE (Analytics & Constituents) -->
  <div id="t-deepdive" class="panel">
    <!-- Hero Banner -->
    <div class="card hero-banner" style="margin-bottom:20px; text-align:center; padding:36px 32px; position:relative; overflow:hidden; border-left:4px solid var(--purple);">
      <div style="font-size:36px; margin-bottom:12px;">🔬</div>
      <div class="hero-banner-title" style="font-size:22px; font-weight:800; color:var(--t1); letter-spacing:-0.5px; margin-bottom:6px;">Deep Dive Analytics</div>
      <div class="hero-banner-subtitle" style="font-size:13px; color:var(--t3); line-height:1.7; max-width:650px; margin:0 auto;">Granular trade-wise executions, geographical AUM origins, derivative notional values, and bond limit utilisations.</div>
    </div>

    ${deepDiveChunk}
  </div><!-- /t-deepdive -->

`;

const fnoStartNew = html.indexOf('  <!-- TAB: DATA MATRIX & DERIVATIVES -->');
if (fnoStartNew === -1) {
    const backup = html.indexOf('  <!-- TAB: F&O DERIVATIVES -->');
    html = html.slice(0, backup) + newDeepDivePanel + html.slice(backup);
} else {
    html = html.slice(0, fnoStartNew) + newDeepDivePanel + html.slice(fnoStartNew);
}

fs.writeFileSync(file, html, 'utf8');
console.log('DOM manipulation successful.');
