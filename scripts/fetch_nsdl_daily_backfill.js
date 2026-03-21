/**
 * fetch_nsdl_daily_backfill.js — NSDL FPI Monthly History Backfill
 *
 * Fetches multi-year monthly FPI data from NSDL and also backfills
 * fortnightly sector data for multiple periods.
 *
 * Data sources:
 *   1. NSDL Monthly.aspx  → monthly equity/debt/hybrid flows
 *   2. NSDL Yearwise.aspx → yearly summary flows
 *   3. Fortnightly sector reports → historical sector snapshots
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const NSDL_BASE = 'https://www.fpi.nsdl.co.in/web';

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Connection': 'keep-alive',
    'Referer': 'https://www.fpi.nsdl.co.in/',
};

function parseNum(str) {
    if (!str) return 0;
    const cleaned = String(str).replace(/,/g, '').replace(/\s/g, '').trim();
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
}

function stripHtml(str) {
    return String(str || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').trim();
}

function writeJSON(filename, data) {
    const p = path.join(DATA_DIR, filename);
    fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
    console.log(`  ✅ Saved ${filename}`);
}

function readJSON(filename, defaultVal = null) {
    try {
        const p = path.join(DATA_DIR, filename);
        if (!fs.existsSync(p)) return defaultVal;
        return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch {
        return defaultVal;
    }
}

// ── Fetch Monthly FPI Data ─────────────────────────────────────────────────
async function fetchMonthlyHistory() {
    const url = `${NSDL_BASE}/Reports/Monthly.aspx`;
    console.log('[BACKFILL] Fetching NSDL Monthly.aspx…');

    try {
        const res = await axios.get(url, { headers: HEADERS, timeout: 25000 });
        const html = res.data;
        return parseMonthlyHtml(html);
    } catch (err) {
        console.warn(`  ⚠️ Monthly.aspx fetch failed: ${err.message}`);
        return null;
    }
}

function parseMonthlyHtml(html) {
    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const rows = [];
    let m;
    while ((m = trRegex.exec(html)) !== null) {
        const cellMatches = [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)];
        const cells = cellMatches.map(c => stripHtml(c[1]));
        if (cells.length >= 3) rows.push(cells);
    }

    const monthlyData = [];
    for (const row of rows) {
        const dateCell = row[0];
        if (!dateCell || dateCell.length > 40) continue;
        // Skip header rows
        if (/date|month|year|category|Sr\.?\s*No|Description|Particulars/i.test(dateCell)) continue;

        const hasNumbers = row.slice(1).some(c => /^-?[\d,]+(\.\d+)?$/.test(c.replace(/\s/g, '')));
        if (!hasNumbers) continue;

        const nums = row.slice(1).map(c => parseNum(c));

        // Monthly.aspx typically shows: Month | Gross Purchase | Gross Sales | Net | (repeated for debt, hybrid)
        monthlyData.push({
            month: dateCell,
            equity_gross_purchase: nums[0] || 0,
            equity_gross_sales: nums[1] || 0,
            equity_net: nums[2] || 0,
            debt_gross_purchase: nums[3] || 0,
            debt_gross_sales: nums[4] || 0,
            debt_net: nums[5] || 0,
            hybrid_gross_purchase: nums[6] || 0,
            hybrid_gross_sales: nums[7] || 0,
            hybrid_net: nums[8] || 0,
            total_net: nums[9] || (nums[2] + nums[5] + nums[8]) || 0,
        });
    }

    console.log(`  Parsed ${monthlyData.length} monthly rows`);
    return monthlyData;
}

// ── Fetch Yearly FPI Data ─────────────────────────────────────────────────
async function fetchYearlyHistory() {
    const url = `${NSDL_BASE}/Reports/Yearwise.aspx`;
    console.log('[BACKFILL] Fetching NSDL Yearwise.aspx…');

    try {
        const res = await axios.get(url, { headers: HEADERS, timeout: 25000 });
        const html = res.data;
        return parseYearlyHtml(html);
    } catch (err) {
        console.warn(`  ⚠️ Yearwise.aspx fetch failed: ${err.message}`);
        return null;
    }
}

function parseYearlyHtml(html) {
    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const years = [];
    let m;
    while ((m = trRegex.exec(html)) !== null) {
        const cellMatches = [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)];
        const cells = cellMatches.map(c => stripHtml(c[1]));
        if (cells.length < 3) continue;
        if (/year|category|Sr\.?\s*No|Description/i.test(cells[0])) continue;

        const hasNums = cells.slice(1).some(c => /^-?[\d,]+(\.\d+)?$/.test(c.replace(/\s/g, '')));
        if (!hasNums) continue;
        const nums = cells.slice(1).map(c => parseNum(c));

        years.push({
            year: cells[0],
            equity_gross_purchase: nums[0] || 0,
            equity_gross_sales: nums[1] || 0,
            equity_net: nums[2] || 0,
            debt_gross_purchase: nums[3] || 0,
            debt_gross_sales: nums[4] || 0,
            debt_net: nums[5] || 0,
            hybrid_gross_purchase: nums[6] || 0,
            hybrid_gross_sales: nums[7] || 0,
            hybrid_net: nums[8] || 0,
            total_net: nums[9] || (nums[2] + nums[5] + nums[8]) || 0,
        });
    }

    console.log(`  Parsed ${years.length} yearly rows`);
    return years;
}

// ── Backfill Fortnightly Sector History ────────────────────────────────────
// Go back through the last 12 fortnightly reports (6 months)
const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function getFortnightDates(monthsBack = 6) {
    const dates = [];
    const today = new Date();
    for (let m = 0; m < monthsBack; m++) {
        const d = new Date(today);
        d.setMonth(d.getMonth() - m);
        const yr = d.getFullYear();
        const mon = MONTH_ABBR[d.getMonth()];
        // NSDL publishes on 15th and last day of month
        dates.push(`${mon}15${yr}`);
        // Last day depends on month
        const lastDay = new Date(yr, d.getMonth() + 1, 0).getDate();
        dates.push(`${mon}${lastDay}${yr}`);
    }
    return dates;
}

async function backfillSectorHistory() {
    console.log('[BACKFILL] Backfilling fortnightly sector history…');
    const existing = readJSON('sector_history.json', []);
    const existingCodes = new Set(existing.map(e => e.date_code));

    const candidates = getFortnightDates(12); // 12 months back
    let newCount = 0;

    // Import the main fetch function
    const { fetchFortnightlySectorData } = require('./fetch_nsdl.js');

    for (const code of candidates) {
        if (existingCodes.has(code)) {
            // console.log(`  Skip ${code} (already exists)`);
            continue;
        }

        try {
            const data = await fetchFortnightlySectorData(code);
            if (data && data.sectors && data.sectors.length > 0) {
                existing.push(data);
                existingCodes.add(code);
                newCount++;
                console.log(`  ✅ Added ${code}: ${data.sectors.length} sectors`);
            }
        } catch (err) {
            // Silently skip failed dates
        }

        // Rate limit: small delay between requests
        await new Promise(r => setTimeout(r, 500));
    }

    // Sort by date_code (most recent first)
    existing.sort((a, b) => {
        // Parse date codes like "Mar152026" → Date
        const parseCode = c => {
            const match = c.match(/([A-Za-z]{3})(\d{2})(\d{4})/);
            if (!match) return 0;
            const mi = MONTH_ABBR.indexOf(match[1]);
            return new Date(parseInt(match[3]), mi, parseInt(match[2])).getTime();
        };
        return parseCode(b.date_code) - parseCode(a.date_code);
    });

    writeJSON('sector_history.json', existing.slice(0, 24)); // Keep 24 entries = ~12 months
    console.log(`[BACKFILL] Added ${newCount} new fortnightly snapshots. Total: ${existing.length}`);
}

// ── Main Pipeline ─────────────────────────────────────────────────────────
async function runBackfill() {
    console.log('[BACKFILL] ═══════════════════════════════════════');
    console.log('[BACKFILL] Starting NSDL FPI History Backfill…');
    console.log('[BACKFILL] ═══════════════════════════════════════\n');

    // 1. Monthly history
    const monthly = await fetchMonthlyHistory();
    if (monthly && monthly.length > 0) {
        writeJSON('fpi_monthly_history.json', {
            fetched_at: new Date().toISOString(),
            source: 'nsdl_monthly',
            months: monthly,
            total: monthly.length,
        });
    }

    // 2. Yearly history
    const yearly = await fetchYearlyHistory();
    if (yearly && yearly.length > 0) {
        writeJSON('fpi_yearly.json', {
            fetched_at: new Date().toISOString(),
            source: 'nsdl_yearly',
            years: yearly,
            total: yearly.length,
        });
    }

    // 3. Backfill sector history
    await backfillSectorHistory();

    console.log('\n[BACKFILL] ✅ History backfill complete.');
}

// ── Expose + CLI ──────────────────────────────────────────────────────────
module.exports = {
    runBackfill,
    fetchMonthlyHistory,
    fetchYearlyHistory,
    backfillSectorHistory,
};

if (require.main === module) {
    runBackfill()
        .then(() => { console.log('[BACKFILL] Done.'); process.exit(0); })
        .catch(err => { console.error('[BACKFILL] Fatal:', err.message); process.exit(1); });
}
