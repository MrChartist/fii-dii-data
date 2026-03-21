/**
 * fetch_nsdl.js — NSDL FPI Data Fetcher
 * Fetches:
 *   1. Fortnightly Sector-wise FPI Investment data
 *   2. Daily FPI Trends (latest)
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(process.cwd(), 'data');

// ── Ensure data directory exists ───────────────────────────────────────────
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const NSDL_BASE = 'https://www.fpi.nsdl.co.in/web';

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Connection': 'keep-alive',
    'Referer': 'https://www.fpi.nsdl.co.in/',
};

// ── Month helpers ─────────────────────────────────────────────────────────
const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatFortnightUrl(date) {
    // Returns e.g. "Mar152026" from a Date object or date string "15-03-2026"
    let d;
    if (date instanceof Date) {
        d = date;
    } else if (typeof date === 'string') {
        // Support "YYYY-MM-DD" or "DD-Mon-YYYY"
        if (date.includes('-') && date.length === 10 && date[4] === '-') {
            const [y, m, day] = date.split('-');
            d = new Date(parseInt(y), parseInt(m) - 1, parseInt(day));
        } else {
            d = new Date(date);
        }
    } else {
        d = new Date();
    }
    const mon = MONTH_ABBR[d.getMonth()];
    const dd = String(d.getDate()).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${mon}${dd}${yyyy}`;
}

// ── Read/Write JSON helpers ────────────────────────────────────────────────
function readJSON(filename, defaultVal = null) {
    try {
        const p = path.join(DATA_DIR, filename);
        if (!fs.existsSync(p)) return defaultVal;
        return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch {
        return defaultVal;
    }
}

function writeJSON(filename, data) {
    const p = path.join(DATA_DIR, filename);
    fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
    console.log(`  ✅ Saved ${filename}`);
}

// ── Parse number (handles commas, negatives) ──────────────────────────────
function parseNum(str) {
    if (!str) return 0;
    const cleaned = String(str).replace(/,/g, '').trim();
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
}

// ── Strip HTML tags ────────────────────────────────────────────────────────
function stripHtml(str) {
    return String(str || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').trim();
}

// ── Get the list of available fortnightly dates from the selection page ──────
async function getAvailableFortnightDates() {
    const url = `${NSDL_BASE}/Reports/FPI_Fortnightly_Selection.aspx`;
    console.log('  Fetching fortnightly selection page…');
    try {
        const res = await axios.get(url, { headers: HEADERS, timeout: 15000 });
        const html = res.data;

        // Extract <option> values from the dropdown
        const optionRegex = /<option[^>]*value="([^"]*)"[^>]*>([^<]*)<\/option>/gi;
        const dates = [];
        let match;
        while ((match = optionRegex.exec(html)) !== null) {
            const val = match[1].trim();
            const label = match[2].trim();
            if (val && val !== '0' && label) {
                dates.push({ value: val, label });
            }
        }

        // Also try to extract dates embedded in onclick or data attributes
        const onclickRegex = /FIIInvestSector_([A-Za-z0-9]+)\.html/g;
        const urlDates = [];
        let m2;
        while ((m2 = onclickRegex.exec(html)) !== null) {
            urlDates.push(m2[1]);
        }

        console.log(`  Found ${dates.length} option entries, ${urlDates.length} embedded URLs`);
        return { dropdownDates: dates, embeddedDates: urlDates };
    } catch (err) {
        console.warn(`  ⚠️ Could not fetch fortnightly selection: ${err.message}`);
        return { dropdownDates: [], embeddedDates: [] };
    }
}

// ── Build the static URL for a fortnightly report ─────────────────────────
function buildFortnightHtmlUrl(dateCode) {
    // dateCode is like "Mar152026"
    return `${NSDL_BASE}/StaticReports/Fortnightly_Sector_wise_FII_Investment_Data/FIIInvestSector_${dateCode}.html`;
}

// ── Map of sector names (normalized) ──────────────────────────────────────
const KNOWN_SECTORS = [
    'Automobile and Auto Components',
    'Capital Goods',
    'Chemicals',
    'Construction',
    'Construction Materials',
    'Consumer Durables',
    'Consumer Services',
    'Diversified',
    'Fast Moving Consumer Goods',
    'Financial Services',
    'Forest Materials',
    'Healthcare',
    'Information Technology',
    'Media, Entertainment & Publication',
    'Metals & Mining',
    'Oil, Gas & Consumable Fuels',
    'Power',
    'Realty',
    'Services',
    'Telecommunication',
    'Textiles',
    'Utilities',
    'Sovereign',
    'Others',
];

// ── Scrape the sector-wise HTML report ────────────────────────────────────
async function fetchFortnightlySectorData(dateCode) {
    // If no dateCode provided, try to determine the latest one
    if (!dateCode) {
        // Default: try today and recent fortnights
        const today = new Date();
        const candidates = [];
        for (let i = 0; i <= 30; i++) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            candidates.push(formatFortnightUrl(d));
        }

        for (const code of candidates) {
            const result = await tryFetchFortnightHtml(code);
            if (result) return result;
        }
        console.warn('  ⚠️ Could not auto-detect latest fortnightly report');
        return null;
    }
    return tryFetchFortnightHtml(dateCode);
}

async function tryFetchFortnightHtml(dateCode) {
    const url = buildFortnightHtmlUrl(dateCode);
    console.log(`  Trying: ${url}`);
    try {
        const res = await axios.get(url, { headers: HEADERS, timeout: 20000 });
        if (res.status !== 200) return null;
        const html = res.data;
        if (html.length < 1000 || !html.includes('Sector')) return null;

        return parseFortnightHtml(html, dateCode);
    } catch (err) {
        if (err.response && err.response.status === 404) return null;
        console.warn(`  ⚠️ Fetch failed for ${dateCode}: ${err.message}`);
        return null;
    }
}

function parseFortnightHtml(html, dateCode) {
    console.log(`  Parsing sector report: ${dateCode}`);

    // Extract the fortnight period from the page title/header
    const periodMatch = html.match(/Fortnight[^\n]*?(\d{1,2}[A-Za-z]{3}\d{4})[^\n]*?(\d{1,2}[A-Za-z]{3}\d{4})/i)
        || html.match(/as on[^<]*(\d{1,2}[\w]+\s+\d{4})/i);
    const period = periodMatch ? periodMatch[0].replace(/<[^>]+>/g, '').trim() : dateCode;

    /*
     * NSDL sector table has exactly 50 cells per data row (confirmed via browser DOM analysis).
     *
     * Column mapping (0-indexed):
     *   [0]  Sr.No
     *   [1]  Sector Name
     *   --- AUC INR Cr ---
     *   [2]  Equity AUC INR
     *   [3]  Debt General Limit INR
     *   [4]  Debt VRR INR
     *   [5]  Debt FAR INR
     *   [6]  Hybrid INR
     *   [7]  MF Equity INR
     *   [8]  MF Debt Gen INR
     *   [9]  MF Hybrid INR
     *   [10] MF Solution INR
     *   [11] MF Other INR
     *   [12] AIF INR
     *   [13] Total AUC INR
     *   --- AUC USD Mn ---
     *   [14] Equity AUC USD
     *   [15..25] (same sub-cols in USD)
     *   [26] Total AUC USD
     *   --- Net Investment INR Cr ---
     *   [27] Equity Net INR         ← PRIMARY VALUE
     *   [28] Debt Gen Limit Net INR
     *   [29] Debt VRR Net INR
     *   [30] Debt FAR Net INR
     *   [31] Hybrid Net INR
     *   [32] MF Equity Net INR
     *   [33] MF Debt Gen Net INR
     *   [34] MF Hybrid Net INR
     *   [35] MF Solution Net INR
     *   [36] MF Other Net INR
     *   [37] AIF Net INR
     *   [38] Total Net INR
     *   --- Net Investment USD Mn ---
     *   [39] Equity Net USD
     *   [40..49] (same sub-cols in USD)
     *   [50/last] Total Net USD  (may or may not exist depending on row)
     */

    const sectorData = [];

    // Extract rows using <tr> tags
    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let m;
    while ((m = trRegex.exec(html)) !== null) {
        const rowHtml = m[1];
        const cellMatches = [...rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)];
        const cells = cellMatches.map(c => stripHtml(c[1]));

        // A valid sector data row should have ~50 cells
        if (cells.length < 30) continue;

        // Cell [1] should be a sector name — check against known sectors
        const sectorCell = cells[1] || '';
        const matched = KNOWN_SECTORS.find(s =>
            sectorCell.toLowerCase().includes(s.toLowerCase().substring(0, 12))
        );
        if (!matched) continue;

        // Also check for the "Total" row which we want to skip
        if (/^total$/i.test(sectorCell.trim())) continue;

        // Parse all cells as numbers (cell 0 = Sr.No, cell 1 = Sector name)
        const n = cells.map(c => parseNum(c));

        sectorData.push({
            sector: matched,
            // AUC in INR Cr  (cells 2–13)
            equity_auc_inr:   n[2]  || 0,
            debt_gen_auc_inr: n[3]  || 0,
            debt_vrr_auc_inr: n[4]  || 0,
            debt_far_auc_inr: n[5]  || 0,
            hybrid_auc_inr:   n[6]  || 0,
            total_auc_inr:    n[13] || 0,
            // AUC in USD Mn  (cells 14–25)
            equity_auc_usd:   n[14] || 0,
            total_auc_usd:    n[25] || 0,
            // Net Investment in INR Cr  (cells 26–37)
            equity_net_inr:   n[26] || 0,
            debt_gen_net_inr: n[27] || 0,
            debt_vrr_net_inr: n[28] || 0,
            debt_far_net_inr: n[29] || 0,
            hybrid_net_inr:   n[30] || 0,
            total_net_inr:    n[37] || 0,
            // Net Investment in USD Mn  (cells 38–49)
            equity_net_usd:   n[38] || 0,
            total_net_usd:    n[49] || 0,
            // Computed convenience fields
            debt_auc_inr:     (n[3] || 0) + (n[4] || 0) + (n[5] || 0),
            debt_net_inr:     (n[27] || 0) + (n[28] || 0) + (n[29] || 0),
        });
    }

    console.log(`  Parsed ${sectorData.length} sectors for ${dateCode}`);

    // Log a sample for debugging
    if (sectorData.length > 0) {
        const s0 = sectorData[0];
        console.log(`  Sample → ${s0.sector}: AUC=${s0.equity_auc_inr} Cr, Net=${s0.equity_net_inr} Cr`);
    }

    return {
        date_code: dateCode,
        period,
        fetched_at: new Date().toISOString(),
        url: buildFortnightHtmlUrl(dateCode),
        sectors: sectorData,
        total_sectors: sectorData.length,
    };
}

// ── Fetch FPI Daily Trends ─────────────────────────────────────────────────
async function fetchDailyTrends() {
    const url = `${NSDL_BASE}/Reports/Latest.aspx`;
    console.log(`  Fetching FPI daily trends from Latest.aspx…`);
    try {
        const res = await axios.get(url, { headers: HEADERS, timeout: 20000 });
        const html = res.data;

        return parseDailyTrends(html);
    } catch (err) {
        console.warn(`  ⚠️ Could not fetch daily trends: ${err.message}`);

        // Fallback: try to get the data from Monthly.aspx
        try {
            console.log('  Trying Monthly.aspx as fallback…');
            const res2 = await axios.get(`${NSDL_BASE}/Reports/Monthly.aspx`, { headers: HEADERS, timeout: 20000 });
            return parseDailyTrends(res2.data, true);
        } catch (err2) {
            console.warn(`  ⚠️ Monthly.aspx also failed: ${err2.message}`);
            return null;
        }
    }
}

function parseDailyTrends(html, isMonthly = false) {
    // Extract all table data
    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const rows = [];
    let m;
    while ((m = trRegex.exec(html)) !== null) {
        const cellMatches = [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)];
        const cells = cellMatches.map(c => stripHtml(c[1]));
        if (cells.length >= 3) rows.push(cells);
    }

    const dailyData = [];
    let curDay = null;
    let mode = 'equity';

    for (const row of rows) {
        const label = row[0].trim();
        const lower = label.toLowerCase();
        
        // Break out of loop when we hit the end of the first table (cash market)
        if (lower === 'total') break;

        // Skip irrelevant top rows
        if (/date|month|year|category|sr\./i.test(label) && !/^\d+\-/.test(label)) continue;
        
        // New Date Row identifies the start of Equity for that day
        if (/^\d{1,2}-[a-zA-Z]{3}-\d{4}$/.test(label)) {
            if (curDay) dailyData.push(curDay);
            curDay = {
                date: label,
                equity_net: 0, debt_net: 0, hybrid_net: 0, total_net: 0
            };
            mode = 'equity';
        }
        
        if (!curDay) continue;

        if (lower.includes('debt-general')) mode = 'debt';
        else if (lower.includes('debt-vrr') || lower.includes('debt-far')) mode = 'debt';
        else if (lower.includes('hybrid')) mode = 'hybrid';
        else if (lower.includes('mutual funds')) mode = 'mf';
        else if (lower.includes('aifs')) mode = 'aif';

        const nums = row.slice(1).map(parseNum);
        const net = nums[2] || 0; // The 3rd value is exactly Net Investment
        
        // We sum the main category rows directly (date row, debt categories, hybrid, aifs)
        if (
            /^\d{1,2}-[a-zA-Z]{3}-\d{4}$/.test(label) || 
            lower.includes('debt-general') ||
            lower.includes('debt-vrr') ||
            lower.includes('debt-far') ||
            lower.includes('hybrid') ||
            lower.includes('aifs')
        ) {
            if (mode === 'equity') curDay.equity_net += net;
            else if (mode === 'debt') curDay.debt_net += net;
            else if (mode === 'hybrid') curDay.hybrid_net += net;
            else if (mode === 'aif') curDay.total_net += net;
            
            curDay.total_net += net;
        }
    }
    
    if (curDay) dailyData.push(curDay);
    
    // Clean up floats
    dailyData.forEach(d => {
        d.equity_net = Math.round(d.equity_net * 100) / 100;
        d.debt_net = Math.round(d.debt_net * 100) / 100;
        d.hybrid_net = Math.round(d.hybrid_net * 100) / 100;
        d.total_net = Math.round(d.total_net * 100) / 100;
    });

    console.log(`  Parsed ${dailyData.length} clean daily trend items (isMonthly=${isMonthly})`);

    return {
        fetched_at: new Date().toISOString(),
        source: isMonthly ? 'monthly' : 'latest',
        rows: dailyData.slice(0, 60),
        latest: dailyData[0] || null,
    };
}

// ── Fetch Yearly FPI Data ──────────────────────────────────────────────────
async function fetchYearlyData() {
    const url = `${NSDL_BASE}/Reports/Yearwise.aspx`;
    console.log('  Fetching FPI yearly data…');
    try {
        const res = await axios.get(url, { headers: HEADERS, timeout: 20000 });
        return parseYearlyData(res.data);
    } catch (err) {
        console.warn(`  ⚠️ Yearly data fetch failed: ${err.message}`);
        return null;
    }
}

function parseYearlyData(html) {
    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const years = [];
    let m;
    while ((m = trRegex.exec(html)) !== null) {
        const cellMatches = [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)];
        const cells = cellMatches.map(c => stripHtml(c[1]));
        if (cells.length < 3) continue;
        if (/year|category|Sr\.?\s*No/i.test(cells[0])) continue;

        const hasNums = cells.slice(1).some(c => /^-?[\d,]+(\.\d+)?$/.test(c.replace(/\s/g, '')));
        if (!hasNums) continue;
        const nums = cells.slice(1).map(c => parseNum(c));
        years.push({
            year: cells[0],
            equity_net: nums[0] || 0,
            debt_net: nums[1] || 0,
            hybrid_net: nums[2] || 0,
            total_net: nums[3] || 0,
        });
    }
    return {
        fetched_at: new Date().toISOString(),
        years: years.slice(0, 30),
    };
}

// ── Main pipeline ─────────────────────────────────────────────────────────
async function fetchAllNSDL() {
    console.log('[NSDL] Starting full NSDL FPI fetch…');

    // 1. Sector-wise fortnightly
    const sectorData = await fetchFortnightlySectorData();
    if (sectorData && sectorData.sectors.length > 0) {
        writeJSON('sector_latest.json', sectorData);

        // Append to history (keep 12 entries = ~6 months)
        const existing = readJSON('sector_history.json', []);
        const idx = existing.findIndex(e => e.date_code === sectorData.date_code);
        if (idx >= 0) {
            existing[idx] = sectorData;
        } else {
            existing.unshift(sectorData);
        }
        writeJSON('sector_history.json', existing.slice(0, 12));
    } else {
        console.warn('[NSDL] No sector data retrieved. Using mock data for demo.');
        const mockData = buildMockSectorData();
        writeJSON('sector_latest.json', mockData);
    }

    // 2. Daily trends
    const daily = await fetchDailyTrends();
    if (daily) {
        writeJSON('fpi_daily.json', daily);
    } else {
        console.warn('[NSDL] No daily data retrieved.');
    }

    // 3. Yearly data
    const yearly = await fetchYearlyData();
    if (yearly && yearly.years.length > 0) {
        writeJSON('fpi_yearly.json', yearly);
    }

    console.log('[NSDL] ✅ NSDL FPI fetch complete.');
    return { sectorData, daily, yearly };
}

// ── Mock data for demo/fallback ────────────────────────────────────────────
function buildMockSectorData() {
    const mockSectors = [
        { sector: 'Financial Services',              equity_auc_inr: 2326577, equity_net_inr: 2243,   total_auc_inr: 2480500 },
        { sector: 'Information Technology',          equity_auc_inr: 417719,  equity_net_inr: -5993,  total_auc_inr: 424100 },
        { sector: 'Oil, Gas & Consumable Fuels',     equity_auc_inr: 387200,  equity_net_inr: 1856,   total_auc_inr: 395000 },
        { sector: 'Healthcare',                      equity_auc_inr: 283500,  equity_net_inr: 3201,   total_auc_inr: 291200 },
        { sector: 'Automobile and Auto Components',  equity_auc_inr: 264150,  equity_net_inr: 3075,   total_auc_inr: 271000 },
        { sector: 'Capital Goods',                   equity_auc_inr: 263894,  equity_net_inr: 4103,   total_auc_inr: 270500 },
        { sector: 'Consumer Durables',               equity_auc_inr: 178300,  equity_net_inr: -812,   total_auc_inr: 183000 },
        { sector: 'Fast Moving Consumer Goods',      equity_auc_inr: 165800,  equity_net_inr: 987,    total_auc_inr: 170200 },
        { sector: 'Metals & Mining',                 equity_auc_inr: 143200,  equity_net_inr: -1423,  total_auc_inr: 148900 },
        { sector: 'Power',                           equity_auc_inr: 128700,  equity_net_inr: 2340,   total_auc_inr: 133500 },
        { sector: 'Construction',                    equity_auc_inr: 99800,   equity_net_inr: -634,   total_auc_inr: 104200 },
        { sector: 'Chemicals',                       equity_auc_inr: 121048,  equity_net_inr: -394,   total_auc_inr: 126000 },
        { sector: 'Consumer Services',               equity_auc_inr: 89700,   equity_net_inr: 1150,   total_auc_inr: 93500  },
        { sector: 'Realty',                          equity_auc_inr: 67800,   equity_net_inr: -892,   total_auc_inr: 71200  },
        { sector: 'Telecommunication',               equity_auc_inr: 65400,   equity_net_inr: 750,    total_auc_inr: 69000  },
        { sector: 'Services',                        equity_auc_inr: 58900,   equity_net_inr: 430,    total_auc_inr: 62400  },
        { sector: 'Construction Materials',          equity_auc_inr: 52300,   equity_net_inr: -280,   total_auc_inr: 55800  },
        { sector: 'Diversified',                     equity_auc_inr: 47200,   equity_net_inr: 190,    total_auc_inr: 50100  },
        { sector: 'Utilities',                       equity_auc_inr: 41500,   equity_net_inr: 560,    total_auc_inr: 44300  },
        { sector: 'Media, Entertainment & Publication', equity_auc_inr: 28700, equity_net_inr: -145, total_auc_inr: 30500 },
        { sector: 'Forest Materials',                equity_auc_inr: 18900,   equity_net_inr: 87,     total_auc_inr: 20100  },
        { sector: 'Textiles',                        equity_auc_inr: 15600,   equity_net_inr: -67,    total_auc_inr: 16800  },
        { sector: 'Sovereign',                       equity_auc_inr: 9800,    equity_net_inr: 0,      total_auc_inr: 340000 },
        { sector: 'Others',                          equity_auc_inr: 38700,   equity_net_inr: 620,    total_auc_inr: 41200  },
    ].map(s => ({
        ...s,
        equity_auc_usd: Math.round(s.equity_auc_inr / 84.5),
        debt_auc_inr: 0, debt_auc_usd: 0,
        hybrid_auc_inr: 0, hybrid_auc_usd: 0,
        total_auc_usd: Math.round(s.total_auc_inr / 84.5),
        equity_net_usd: Math.round(s.equity_net_inr / 84.5),
        debt_net_inr: 0, debt_net_usd: 0,
        total_net_inr: s.equity_net_inr,
        total_net_usd: Math.round(s.equity_net_inr / 84.5),
    }));

    return {
        date_code: 'Mar152026',
        period: 'Fortnight ending 15 Mar 2026 (DEMO DATA — live fetch unavailable)',
        fetched_at: new Date().toISOString(),
        url: buildFortnightHtmlUrl('Mar152026'),
        is_mock: true,
        sectors: mockSectors,
        total_sectors: mockSectors.length,
    };
}

// ── Expose for server.js ───────────────────────────────────────────────────
module.exports = {
    fetchAllNSDL,
    fetchFortnightlySectorData,
    fetchDailyTrends,
    fetchYearlyData,
    buildMockSectorData,
    getAvailableFortnightDates,
};

// ── CLI entry point ────────────────────────────────────────────────────────
if (require.main === module) {
    fetchAllNSDL()
        .then(() => {
            console.log('[NSDL] Done.');
            process.exit(0);
        })
        .catch(err => {
            console.error('[NSDL] Fatal error:', err.message);
            process.exit(1);
        });
}
