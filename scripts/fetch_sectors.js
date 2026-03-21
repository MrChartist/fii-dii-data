// scripts/fetch_sectors.js
// Fetches NSE sector index returns and writes data/sector-returns.json
// Called by GitHub Action: .github/workflows/update_sector_data.yml

const https = require('https');
const fs    = require('fs');
const path  = require('path');

// ── Sector map: display name → NSE index name ─────────────────────────────
const SECTORS = [
  { name: 'Auto',          nseIndex: 'NIFTY AUTO'               },
  { name: 'Banking',       nseIndex: 'NIFTY BANK'               },
  { name: 'Cap Goods',     nseIndex: 'NIFTY CPSE'               },
  { name: 'Commodities',   nseIndex: 'NIFTY COMMODITIES'        },
  { name: 'Cons Durables', nseIndex: 'NIFTY CONSUMER DURABLES'  },
  { name: 'Consumption',   nseIndex: 'NIFTY INDIA CONSUMPTION'  },
  { name: 'Defence',       nseIndex: 'NIFTY INDIA DEFENCE'      },
  { name: 'Energy',        nseIndex: 'NIFTY ENERGY'             },
  { name: 'Finance',       nseIndex: 'NIFTY FINANCIAL SERVICES' },
  { name: 'FMCG',          nseIndex: 'NIFTY FMCG'               },
  { name: 'Healthcare',    nseIndex: 'NIFTY HEALTHCARE INDEX'   },
  { name: 'Infra',         nseIndex: 'NIFTY INFRASTRUCTURE'     },
  { name: 'IT',            nseIndex: 'NIFTY IT'                 },
  { name: 'Media',         nseIndex: 'NIFTY INDIA DIGITAL'      },
  { name: 'Metal',         nseIndex: 'NIFTY METAL'              },
  { name: 'Midcap Select', nseIndex: 'NIFTY MIDCAP SELECT'      },
  { name: 'MidSml Health', nseIndex: 'NIFTY MIDSML HEALTHCARE'  },
  { name: 'OilGas',        nseIndex: 'NIFTY OIL AND GAS'        },
  { name: 'Pharma',        nseIndex: 'NIFTY PHARMA'             },
  { name: 'Power',         nseIndex: 'NIFTY INDIA POWER'        },
  { name: 'PSE',           nseIndex: 'NIFTY PSE'                },
  { name: 'PSUBank',       nseIndex: 'NIFTY PSU BANK'           },
  { name: 'PVTBank',       nseIndex: 'NIFTY PRIVATE BANK'       },
  { name: 'Realty',        nseIndex: 'NIFTY REALTY'             },
  { name: 'Service',       nseIndex: 'NIFTY SERVICES SECTOR'    },
  { name: 'SmallCap100',   nseIndex: 'NIFTY SMALLCAP 100'       },
];

// ── NSE HTTP helper (same pattern as your existing fetch_data.js) ─────────
function nseGet(urlPath, cookieJar = '') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'www.nseindia.com',
      path: urlPath,
      headers: {
        'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        'Accept':          'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer':         'https://www.nseindia.com/',
        'Cookie':          cookieJar,
      }
    };

    const req = https.get(options, res => {
      // Capture cookies for session
      const setCookie = res.headers['set-cookie'] || [];
      const cookies   = setCookie.map(c => c.split(';')[0]).join('; ');

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end',  () => {
        if (res.statusCode === 200) {
          try { resolve({ data: JSON.parse(data), cookies }); }
          catch(e) { reject(new Error(`JSON parse error: ${data.slice(0, 300)}`)); }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

// ── Main fetch function ───────────────────────────────────────────────────
async function fetchSectors() {
  console.log('📡 Fetching NSE sector returns...\n');

  // Step 1: Get a session cookie by hitting the homepage first
  let cookieJar = '';
  try {
    const home = await nseGet('/');
    cookieJar  = home.cookies;
    console.log('  ✅ Session cookie obtained');
    await delay(1000);
  } catch(e) {
    console.log('  ⚠️  Could not get session cookie, trying anyway...');
  }

  // Step 2: Fetch allIndices — this single endpoint has all sectors with %changes
  let allData = [];
  try {
    const result = await nseGet('/api/allIndices', cookieJar);
    allData = result.data?.data || [];
    console.log(`  ✅ Got ${allData.length} indices from NSE\n`);
  } catch(e) {
    console.error('  ❌ Failed to fetch allIndices:', e.message);
    console.log('     Writing empty sector data...');
    writeOutput([]);
    return;
  }

  // Step 3: Match each sector
  const sectors = [];
  for (const s of SECTORS) {
    const found = allData.find(d => {
      const idx = (d.indexSymbol || d.index || '').toUpperCase();
      return idx === s.nseIndex.toUpperCase() ||
             idx.includes(s.nseIndex.toUpperCase());
    });

    if (found) {
      const entry = {
        name: s.name,
        r1d:  toNum(found.percentChange),
        r1w:  toNum(found.oneWeekAgo),
        r1m:  toNum(found.oneMonthAgo),
        r3m:  toNum(found.threeMonthAgo),
      };
      sectors.push(entry);
      console.log(`  ✅ ${s.name.padEnd(16)} Today: ${fmt(entry.r1d)}  1W: ${fmt(entry.r1w)}  1M: ${fmt(entry.r1m)}  3M: ${fmt(entry.r3m)}`);
    } else {
      sectors.push({ name: s.name, r1d: null, r1w: null, r1m: null, r3m: null });
      console.log(`  ⚠️  ${s.name.padEnd(16)} NOT FOUND in NSE response`);
    }
  }

  writeOutput(sectors);
}

// ── Helpers ───────────────────────────────────────────────────────────────
function toNum(v) {
  const n = parseFloat(v);
  return isNaN(n) ? null : Math.round(n * 10) / 10;
}

function fmt(v) {
  if (v === null) return 'N/A  ';
  return (v >= 0 ? '+' : '') + v.toFixed(1) + '%';
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function writeOutput(sectors) {
  const out = {
    _updated_at: new Date().toISOString(),
    _source:     'NSE India allIndices API',
    sectors
  };
  const outDir  = path.join(__dirname, '..', 'data');
  const outPath = path.join(outDir, 'sector-returns.json');

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`\n✅ Wrote ${sectors.length} sectors → data/sector-returns.json`);
}

// ── Run ───────────────────────────────────────────────────────────────────
fetchSectors().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  // Write empty file so the page shows fallback data
  writeOutput([]);
  process.exit(0); // exit 0 so GitHub Action doesn't fail on market holidays
});
