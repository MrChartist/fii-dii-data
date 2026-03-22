// scripts/fetch_sectors.js
// Fetches NSE sector returns combining Yahoo Finance ETFs + Google Sheets
// Yahoo Finance → 1D, 1W, 1M, 3M for ETF-based sectors
// Google Sheets → fills in missing sectors (Cons Durables, Consumption, Defence, Finance, Healthcare, OilGas, PVTBank)
// Auto-calculates RS Rank, RRG Quadrant, Signal
// Saves to: data/sector-returns.json

const https = require('https');
const fs    = require('fs');
const path  = require('path');

// ── Google Sheet published CSV URL ────────────────────────────────────────
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR0yEZhzDaD4R-mRaczoSUOb0Q6nYXdXOySjSawcY-wtMPiJBUZh2q1m1u6Ak6eP-knoSdx1odwbHF7/pub?output=csv';

// ── Verified Yahoo Finance symbols ───────────────────────────────────────
// ETF symbols with full history (price + 1D + 1W + 1M + 3M)
const YAHOO_SECTORS = [
  { name: 'Auto',          yahoo: 'AUTOBEES.NS'   },
  { name: 'Banking',       yahoo: 'BANKBEES.NS'   },
  { name: 'Commodities',   yahoo: '%5ECNXCMDT'    },
  { name: 'Consumption',   yahoo: 'CONSUMBEES.NS' },
  { name: 'Energy',        yahoo: '%5ECNXENERGY'  },
  { name: 'FMCG',          yahoo: 'FMCGIETF.NS'   },
  { name: 'Infra',         yahoo: 'INFRABEES.NS'  },
  { name: 'IT',            yahoo: 'ITBEES.NS'     },
  { name: 'Media',         yahoo: 'MOGSEC.NS'     },
  { name: 'Metal',         yahoo: 'METALIETF.NS'  },
  { name: 'OilGas',        yahoo: 'OILIETF.NS'    },
  { name: 'Pharma',        yahoo: 'PHARMABEES.NS' },
  { name: 'PSE',           yahoo: '%5ECNXPSE'     },
  { name: 'PSUBank',       yahoo: 'PSUBNKBEES.NS' },
  { name: 'Realty',        yahoo: 'MOREALTY.NS'   },
  { name: 'Service',       yahoo: '%5ECNXSERVICE' },
  { name: 'CPSE',          yahoo: 'CPSEETF.NS'    },
];

// ── Sectors to get from Google Sheets (Yahoo doesn't have history) ────────
const SHEET_SECTORS = ['Cons Durables', 'Defence', 'Finance', 'Healthcare', 'PVTBank', 'Power'];

// ── HTTP fetch with redirect following ───────────────────────────────────
function fetchURL(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('Too many redirects'));
    const req = https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    }, res => {
      if ([301,302,307,308].includes(res.statusCode)) {
        res.resume();
        return fetchURL(res.headers.location, redirects + 1).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Clean closes array ────────────────────────────────────────────────────
function cleanCloses(closes) {
  const c = (closes || []).filter(v => v !== null && v !== undefined);
  while (c.length > 1 && c[c.length-1] === c[c.length-2]) c.pop();
  return c;
}

// ── % change calculation ──────────────────────────────────────────────────
function pct(a, b) {
  if (!a || !b || b === 0) return null;
  return Math.round(((a - b) / b) * 1000) / 10;
}

function fmt(v) { return v === null ? 'N/A' : (v >= 0 ? '+' : '') + v.toFixed(1) + '%'; }

// ── Fetch one sector from Yahoo Finance ───────────────────────────────────
async function fetchYahoo(sector) {
  const base = `https://query1.finance.yahoo.com/v8/finance/chart/${sector.yahoo}`;
  try {
    // Daily for 1D
    const daily   = await fetchURL(`${base}?interval=1d&range=10d`);
    const dResult = JSON.parse(daily)?.chart?.result?.[0];
    if (!dResult) throw new Error('No daily result');
    const dCloses  = cleanCloses(dResult.indicators.quote[0].close);
    const lastClose = dCloses[dCloses.length - 1];
    const prevClose = dCloses[dCloses.length - 2];
    const r1d = pct(lastClose, prevClose);
    const lastDate = new Date(dResult.timestamp[dResult.timestamp.length-1] * 1000)
      .toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric', timeZone:'Asia/Kolkata' });

    await delay(300);

    // Weekly for 1W, 1M, 3M
    const weekly  = await fetchURL(`${base}?interval=1wk&range=4mo`);
    const wResult = JSON.parse(weekly)?.chart?.result?.[0];
    if (!wResult) throw new Error('No weekly result');
    const wCloses = cleanCloses(wResult.indicators.quote[0].close);
    const wLen    = wCloses.length;
    const r1w = pct(lastClose, wCloses[wLen - 2]);
    const r1m = pct(lastClose, wCloses[wLen - 5] || wCloses[0]);
    const r3m = pct(lastClose, wCloses[0]);

    console.log(
      `  ✅ ${sector.name.padEnd(16)}` +
      `  1D:${fmt(r1d).padStart(7)}` +
      `  1W:${fmt(r1w).padStart(7)}` +
      `  1M:${fmt(r1m).padStart(7)}` +
      `  3M:${fmt(r3m).padStart(7)}` +
      `  [${lastDate}]`
    );

    return { name: sector.name, source: 'yahoo', last: lastClose, lastDate, r1d, r1w, r1m, r3m };
  } catch(e) {
    console.log(`  ⚠️  ${sector.name.padEnd(16)} Yahoo error: ${e.message}`);
    return { name: sector.name, source: 'yahoo_failed', last: null, lastDate: null, r1d: null, r1w: null, r1m: null, r3m: null };
  }
}

// ── Parse % from Google Sheet cell ───────────────────────────────────────
function parseSheetNum(v) {
  if (!v || v.trim() === '-' || v.trim() === '—' || v.trim() === '') return null;
  const cleaned = v.replace(/%/g, '').replace(/[▲▼]/g, '').trim();
  const n = parseFloat(cleaned);
  if (isNaN(n)) return null;
  // Google Sheets exports decimals (0.091) not percentages (9.1%)
  if (Math.abs(n) < 1 && n !== 0 && !v.includes('%')) return Math.round(n * 1000) / 10;
  return Math.round(n * 10) / 10;
}

// ── Fetch missing sectors from Google Sheets ──────────────────────────────
async function fetchGoogleSheet() {
  console.log('\n  📊 Fetching missing sectors from Google Sheets...');
  try {
    const csv = await fetchURL(SHEET_URL);
    const lines = csv.split('\n');
    const sheetSectors = {};

    // Find data start (row with "Sector" header)
    let dataStart = 4;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('Sector') && lines[i].includes('1D')) {
        dataStart = i + 1; break;
      }
    }

    for (let i = dataStart; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      const name = cols[0]?.trim();
      if (!name || name === '') continue;

      // Check if this is one of our missing sectors
      const match = SHEET_SECTORS.find(s =>
        name.toLowerCase().includes(s.toLowerCase()) ||
        s.toLowerCase().includes(name.toLowerCase())
      );
      if (!match) continue;

      sheetSectors[match] = {
        name:    match,
        source:  'google_sheets',
        last:    null,
        lastDate: new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric', timeZone:'Asia/Kolkata' }),
        r1d:     parseSheetNum(cols[3]),
        r1w:     parseSheetNum(cols[4]),
        r1m:     parseSheetNum(cols[5]),
        r3m:     parseSheetNum(cols[6]),
      };
      console.log(
        `  ✅ ${match.padEnd(16)} [sheets]` +
        `  1D:${fmt(sheetSectors[match].r1d).padStart(7)}` +
        `  1W:${fmt(sheetSectors[match].r1w).padStart(7)}` +
        `  1M:${fmt(sheetSectors[match].r1m).padStart(7)}` +
        `  3M:${fmt(sheetSectors[match].r3m).padStart(7)}`
      );
    }
    return sheetSectors;
  } catch(e) {
    console.log(`  ⚠️  Google Sheets error: ${e.message}`);
    return {};
  }
}

// ── Auto-calculate RS Rank, RRG, Signal ──────────────────────────────────
function calculateSignals(sectors) {
  // Get Nifty 1M for relative strength calculation
  // Using 0 as baseline if Nifty not available
  const valid = sectors.filter(s => s.r1m !== null);

  // Sort by 1M% to get RS Rank
  const sorted = [...valid].sort((a, b) => (b.r1m || 0) - (a.r1m || 0));

  sorted.forEach((s, i) => {
    s.rsRank = i + 1;
    const total = sorted.length;

    // RRG Quadrant based on rank and momentum (1W trend)
    const rankPct = s.rsRank / total;
    const momentum = (s.r1w !== null && s.r1d !== null) ? (s.r1w > 0 ? 'rising' : s.r1w < -1 ? 'falling' : 'flat') : 'flat';

    if (rankPct <= 0.25 && momentum !== 'falling') {
      s.rrg = 'Leading';
      s.signal = 'OVERWEIGHT';
    } else if (rankPct <= 0.25 && momentum === 'falling') {
      s.rrg = 'Weakening';
      s.signal = 'REDUCE';
    } else if (rankPct <= 0.55 && momentum === 'rising') {
      s.rrg = 'Improving';
      s.signal = 'ACCUMULATE';
    } else if (rankPct <= 0.55) {
      s.rrg = 'Neutral';
      s.signal = 'HOLD';
    } else if (momentum === 'rising') {
      s.rrg = 'Improving';
      s.signal = 'ACCUMULATE';
    } else if (rankPct > 0.80) {
      s.rrg = 'Lagging';
      s.signal = 'EXIT';
    } else {
      s.rrg = 'Weakening';
      s.signal = 'REDUCE';
    }
  });

  // Sectors with no data
  sectors.filter(s => s.r1m === null).forEach(s => {
    s.rsRank = null;
    s.rrg = null;
    s.signal = null;
  });

  return sectors;
}

// ── Main ──────────────────────────────────────────────────────────────────
async function fetchSectors() {
  const istNow  = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  const dayName = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][istNow.getUTCDay()];

  console.log('━'.repeat(65));
  console.log(`🔄 Sector Rotation Fetch — ${dayName} ${istNow.toISOString().slice(0,16)} IST`);
  console.log('   Source 1: Yahoo Finance ETFs (1D + 1W + 1M + 3M)');
  console.log('   Source 2: Google Sheets CSV (missing sectors)');
  console.log('━'.repeat(65));

  // Step 1: Fetch from Yahoo Finance
  console.log('\n📡 Fetching from Yahoo Finance...\n');
  const sectors = [];
  for (const s of YAHOO_SECTORS) {
    const result = await fetchYahoo(s);
    sectors.push(result);
    await delay(500);
  }

  // Step 2: Fetch missing sectors from Google Sheets
  const sheetData = await fetchGoogleSheet();

  // Step 3: Add sheet sectors
  for (const sName of SHEET_SECTORS) {
    if (sheetData[sName]) {
      sectors.push(sheetData[sName]);
    } else {
      sectors.push({ name: sName, source: 'missing', last: null, lastDate: null, r1d: null, r1w: null, r1m: null, r3m: null });
      console.log(`  ⚠️  ${sName.padEnd(16)} not found in sheet`);
    }
  }

  // Step 4: Auto-calculate RS Rank, RRG, Signal
  const final = calculateSignals(sectors);

  // Summary
  const valid = final.filter(s => s.r1d !== null);
  console.log('\n' + '━'.repeat(65));
  console.log(`📊 Total: ${final.length} sectors | With data: ${valid.length}`);

  const ranked = final.filter(s => s.rsRank !== null).sort((a,b) => a.rsRank - b.rsRank);
  if (ranked.length > 0) {
    console.log('\n🏆 Top 5 by RS Rank:');
    ranked.slice(0, 5).forEach(s => console.log(`   #${s.rsRank} ${s.name.padEnd(16)} ${fmt(s.r1m)} 1M | ${s.rrg} | ${s.signal}`));
    console.log('\n📉 Bottom 5 by RS Rank:');
    ranked.slice(-5).forEach(s => console.log(`   #${s.rsRank} ${s.name.padEnd(16)} ${fmt(s.r1m)} 1M | ${s.rrg} | ${s.signal}`));
  }

  writeOutput(final);
}

function writeOutput(sectors) {
  const out = {
    _updated_at: new Date().toISOString(),
    _source: 'Yahoo Finance ETFs + Google Sheets CSV',
    sectors
  };
  const outDir  = path.join(__dirname, '..', 'data');
  const outPath = path.join(outDir, 'sector-returns.json');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`\n✅ Saved ${sectors.length} sectors → data/sector-returns.json`);
  console.log('━'.repeat(65));
}

fetchSectors().catch(err => {
  console.error('\n❌ Fatal:', err.message);
  process.exit(0);
});
