/**
 * fetch_tradewise_backfill.js — NSDL FII Trade-Wise Data Parser
 *
 * Downloads monthly ZIP files from NSDL containing transaction-level CSV data
 * and aggregates them by sector (via ISIN mapping) to compute accurate
 * per-sector buy/sell flows.
 *
 * Data source: https://www.fpi.nsdl.co.in/web/StaticReports/FIITradeWise2008/FIITradeWise2008.htm
 *
 * CSV format (19 fields):
 *   0  Custodian Code
 *   1  Report Date
 *   2  Transaction ID
 *   3  FII Registration Number
 *   4  Sub Account Registration Number
 *   5  Broker Registration Number
 *   6  Scrip Name
 *   7  ISIN Code
 *   8  Transaction Date
 *   9  Transaction Type (BUY/SELL)
 *  10  Stock Exchange Code
 *  11  Settled Code
 *  12  Transaction Rate
 *  13  Transaction Quantity
 *  14  Value (₹ in original currency)
 *  15  Instrument Type (EQ/DT/WT/HB)
 *  16  Reason for Delay
 *  17  Reporting Type
 *  18  Reason for Amendment
 *
 * URL Patterns:
 *   Recent (2022-2026): https://www.fpi.nsdl.co.in/web/StaticReports/statistics/zip/{Mon}_{Year}.zip
 *   Mid-range (2014-2021): .../statistics/zip/{Year}_{MonthIndex}.zip
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DATA_DIR = path.join(process.cwd(), 'data');
const TMP_DIR = path.join(process.cwd(), 'data', 'tradewise_tmp');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

const NSDL_ZIP_BASE = 'https://www.fpi.nsdl.co.in/web/StaticReports/statistics/zip';

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': '*/*',
    'Referer': 'https://www.fpi.nsdl.co.in/',
};

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ── ISIN → Sector Mapping ─────────────────────────────────────────────────
// Bootstrap from existing sector_latest.json if available, or use this default mapping
// Top ~100 ISINs by FPI AUC mapped to their BSE sector classification
const DEFAULT_ISIN_SECTOR_MAP = {
    // Financial Services
    'INE009A01021': 'Financial Services',   // HDFC Bank
    'INE040A01034': 'Financial Services',   // HDFC
    'INE062A01020': 'Financial Services',   // SBI
    'INE090A01021': 'Financial Services',   // ICICI Bank
    'INE154A01025': 'Financial Services',   // ITC
    'INE160A01022': 'Financial Services',   // Bajaj Finance
    'INE584A01023': 'Financial Services',   // Bajaj Finserv
    'INE238A01034': 'Financial Services',   // Axis Bank
    'INE476A01022': 'Financial Services',   // Kotak Mahindra
    // IT
    'INE467B01029': 'Information Technology', // TCS
    'INE009A01021': 'Information Technology', // Infosys (duplicate handled)
    'INE860A01027': 'Information Technology', // HCL Tech
    'INE075A01022': 'Information Technology', // Wipro
    'INE356A01018': 'Information Technology', // Tech Mahindra
    // Oil & Gas
    'INE002A01018': 'Oil, Gas & Consumable Fuels', // Reliance
    'INE213A01029': 'Oil, Gas & Consumable Fuels', // ONGC
    // Healthcare
    'INE089A01023': 'Healthcare',           // Sun Pharma
    // Automobile
    'INE585B01010': 'Automobile and Auto Components', // Maruti Suzuki
    'INE917I01010': 'Automobile and Auto Components', // Bajaj Auto
    'INE758T01015': 'Automobile and Auto Components', // Tata Motors
    // FMCG
    'INE030A01027': 'Fast Moving Consumer Goods', // HUL
    'INE047A01021': 'Fast Moving Consumer Goods', // Nestle
    // Metals
    'INE081A01020': 'Metals & Mining',     // Tata Steel
    // Power
    'INE752E01010': 'Power',               // Power Grid
    'INE733E01010': 'Power',               // NTPC
};

function readJSON(filename, defaultVal = null) {
    try {
        const p = path.join(DATA_DIR, filename);
        if (!fs.existsSync(p)) return defaultVal;
        return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch { return defaultVal; }
}

function writeJSON(filename, data) {
    const p = path.join(DATA_DIR, filename);
    fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
    console.log(`  ✅ Saved ${filename}`);
}

// Load or build ISIN → Sector mapping
function loadISINMap() {
    const mapFile = path.join(DATA_DIR, 'isin_sector_map.json');
    if (fs.existsSync(mapFile)) {
        try {
            const map = JSON.parse(fs.readFileSync(mapFile, 'utf8'));
            console.log(`  Loaded ISIN→Sector map: ${Object.keys(map).length} entries`);
            return map;
        } catch {}
    }
    console.log(`  Using default ISIN→Sector map: ${Object.keys(DEFAULT_ISIN_SECTOR_MAP).length} entries`);
    return { ...DEFAULT_ISIN_SECTOR_MAP };
}

// ── Build month range to download ─────────────────────────────────────────
function getRecentMonthURLs(monthsBack = 12) {
    const urls = [];
    const now = new Date();
    for (let i = 0; i < monthsBack; i++) {
        const d = new Date(now);
        d.setMonth(d.getMonth() - i);
        const yr = d.getFullYear();
        const monIdx = d.getMonth();
        const monName = MONTH_NAMES[monIdx];

        // Try both URL patterns
        if (yr >= 2022) {
            urls.push({
                url: `${NSDL_ZIP_BASE}/${monName}_${yr}.zip`,
                label: `${monName} ${yr}`,
                year: yr,
                month: monIdx + 1,
            });
        } else if (yr >= 2014) {
            const mi = String(monIdx + 1).padStart(2, '0');
            urls.push({
                url: `${NSDL_ZIP_BASE}/${yr}_${mi}.zip`,
                label: `${monName} ${yr}`,
                year: yr,
                month: monIdx + 1,
            });
        }
    }
    return urls;
}

// ── Download and unzip a single month ────────────────────────────────────
async function downloadAndParse(monthInfo, isinMap) {
    const { url, label } = monthInfo;
    const zipPath = path.join(TMP_DIR, path.basename(url));
    const csvDir = path.join(TMP_DIR, label.replace(/\s/g, '_'));

    console.log(`  Downloading ${label}…`);

    try {
        const res = await axios.get(url, {
            headers: HEADERS,
            timeout: 60000,
            responseType: 'arraybuffer'
        });

        if (res.status !== 200) {
            console.warn(`  ⚠️ ${label}: HTTP ${res.status}`);
            return null;
        }

        // Save ZIP
        fs.writeFileSync(zipPath, Buffer.from(res.data));
        console.log(`  ZIP saved: ${(res.data.byteLength / 1024).toFixed(0)} KB`);

        // Unzip
        if (!fs.existsSync(csvDir)) fs.mkdirSync(csvDir, { recursive: true });
        try {
            execSync(`unzip -o "${zipPath}" -d "${csvDir}" 2>/dev/null`, { stdio: 'pipe' });
        } catch (unzipErr) {
            console.warn(`  ⚠️ ${label}: Unzip failed`);
            return null;
        }

        // Find the CSV/TXT file
        const files = fs.readdirSync(csvDir).filter(f =>
            f.endsWith('.csv') || f.endsWith('.txt') || f.endsWith('.dat')
        );
        if (files.length === 0) {
            console.warn(`  ⚠️ ${label}: No CSV/TXT found in ZIP`);
            return null;
        }

        // Parse the CSV
        const csvPath = path.join(csvDir, files[0]);
        return parseTradeCSV(csvPath, label, isinMap);

    } catch (err) {
        if (err.response && err.response.status === 404) {
            console.log(`  ⚠️ ${label}: Not found (404)`);
        } else {
            console.warn(`  ⚠️ ${label}: ${err.message}`);
        }
        return null;
    }
}

// ── Parse a single Trade-Wise CSV file ────────────────────────────────────
function parseTradeCSV(csvPath, label, isinMap) {
    const raw = fs.readFileSync(csvPath, 'utf8');
    const lines = raw.split('\n').filter(l => l.trim().length > 0);

    const sectorAgg = {}; // { sector: { buy: 0, sell: 0, net: 0, txCount: 0 } }
    const unknownISINs = new Set();
    let totalTrades = 0;
    let equityTrades = 0;

    for (const line of lines) {
        // CSV fields separated by comma or pipe
        const parts = line.split(/[,|]/).map(s => s.trim().replace(/^"|"$/g, ''));
        if (parts.length < 15) continue;

        const isin = parts[7];
        const txType = parts[9]; // BUY or SELL
        const value = parseFloat(parts[14]);
        const instrType = parts[15]; // EQ, DT, WT, HB

        // Only count equity trades
        if (instrType && instrType !== 'EQ') continue;
        if (!txType || !['BUY', 'SELL'].includes(txType.toUpperCase())) continue;
        if (isNaN(value) || value === 0) continue;

        totalTrades++;
        equityTrades++;

        // Map ISIN to sector
        let sector = isinMap[isin];
        if (!sector) {
            unknownISINs.add(isin);
            sector = 'Unmapped';
        }

        if (!sectorAgg[sector]) {
            sectorAgg[sector] = { buy: 0, sell: 0, net: 0, txCount: 0 };
        }

        const isBuy = txType.toUpperCase() === 'BUY';
        const valueCr = value / 10000000; // Convert to ₹ Cr (assuming value is in ₹)

        if (isBuy) {
            sectorAgg[sector].buy += valueCr;
        } else {
            sectorAgg[sector].sell += valueCr;
        }
        sectorAgg[sector].net = sectorAgg[sector].buy - sectorAgg[sector].sell;
        sectorAgg[sector].txCount++;
    }

    console.log(`  ${label}: ${totalTrades} equity trades, ${Object.keys(sectorAgg).length} sectors, ${unknownISINs.size} unmapped ISINs`);

    return {
        label,
        year: 0,
        month: 0,
        total_trades: totalTrades,
        equity_trades: equityTrades,
        unmapped_isins: unknownISINs.size,
        sectors: sectorAgg,
    };
}

// ── Main Pipeline ─────────────────────────────────────────────────────────
async function runTradeWiseBackfill(monthsBack = 6) {
    console.log('[TRADEWISE] ═══════════════════════════════════════');
    console.log(`[TRADEWISE] Downloading last ${monthsBack} months of NSDL Trade-Wise data…`);
    console.log('[TRADEWISE] ═══════════════════════════════════════\n');

    const isinMap = loadISINMap();
    const monthURLs = getRecentMonthURLs(monthsBack);
    const results = [];

    for (const m of monthURLs) {
        const result = await downloadAndParse(m, isinMap);
        if (result) {
            result.year = m.year;
            result.month = m.month;
            results.push(result);
        }
        // Rate limit
        await new Promise(r => setTimeout(r, 1000));
    }

    if (results.length > 0) {
        // Merge all months into per-sector totals
        const mergedSectors = {};
        for (const r of results) {
            for (const [sector, data] of Object.entries(r.sectors)) {
                if (!mergedSectors[sector]) {
                    mergedSectors[sector] = { buy: 0, sell: 0, net: 0, txCount: 0, months: 0 };
                }
                mergedSectors[sector].buy += data.buy;
                mergedSectors[sector].sell += data.sell;
                mergedSectors[sector].net += data.net;
                mergedSectors[sector].txCount += data.txCount;
                mergedSectors[sector].months++;
            }
        }

        // Sort by net (descending)
        const sorted = Object.entries(mergedSectors)
            .sort((a, b) => Math.abs(b[1].net) - Math.abs(a[1].net))
            .map(([sector, data]) => ({
                sector,
                buy_cr: +data.buy.toFixed(2),
                sell_cr: +data.sell.toFixed(2),
                net_cr: +data.net.toFixed(2),
                tx_count: data.txCount,
                months_present: data.months,
            }));

        const output = {
            fetched_at: new Date().toISOString(),
            period: `Last ${monthsBack} months`,
            months_processed: results.length,
            total_equity_trades: results.reduce((s, r) => s + r.equity_trades, 0),
            sectors: sorted,
            monthly_detail: results.map(r => ({
                label: r.label,
                year: r.year,
                month: r.month,
                equity_trades: r.equity_trades,
                sector_count: Object.keys(r.sectors).length,
            })),
        };

        writeJSON('tradewise_sector_monthly.json', output);
        console.log(`\n[TRADEWISE] ✅ Processed ${results.length} months, ${sorted.length} sectors`);
    } else {
        console.warn('[TRADEWISE] ⚠️ No Trade-Wise data could be downloaded.');
    }

    // Cleanup tmp
    try {
        execSync(`rm -rf "${TMP_DIR}"`, { stdio: 'pipe' });
        console.log('[TRADEWISE] Cleaned up temp files.');
    } catch {}

    console.log('\n[TRADEWISE] Done.');
}

// ── Expose + CLI ──────────────────────────────────────────────────────────
module.exports = { runTradeWiseBackfill };

if (require.main === module) {
    const months = parseInt(process.argv[2]) || 6;
    runTradeWiseBackfill(months)
        .then(() => process.exit(0))
        .catch(err => { console.error('[TRADEWISE] Fatal:', err.message); process.exit(1); });
}
