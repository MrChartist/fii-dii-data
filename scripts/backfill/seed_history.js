#!/usr/bin/env node
/**
 * seed_history.js — Populate history.json with realistic historical data
 * 
 * Uses the known monthly/yearly aggregate totals (from the dashboard's
 * hardcoded datasets) to generate realistic per-day FII/DII cash flow
 * records for all trading days in the last ~6 months.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(process.cwd(), 'data');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const M_REV = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function readJSON(fp, fb) { try { return JSON.parse(fs.readFileSync(fp, 'utf8')); } catch { return fb; } }
function writeJSON(fp, d) { fs.writeFileSync(fp + '.tmp', JSON.stringify(d, null, 2)); fs.renameSync(fp + '.tmp', fp); }

function formatDate(d) {
    return `${String(d.getDate()).padStart(2,'0')}-${M_REV[d.getMonth()]}-${d.getFullYear()}`;
}

function isWeekday(d) { return d.getDay() !== 0 && d.getDay() !== 6; }

// NSE holidays for 2025-2026
const HOLIDAYS = new Set([
    '26-Jan-2026','14-Mar-2026','31-Mar-2026','14-Apr-2026','18-Apr-2026',
    '01-May-2026','12-Aug-2026','15-Aug-2026','27-Aug-2026','02-Oct-2026',
    '26-Jan-2025','26-Feb-2025','14-Mar-2025','31-Mar-2025','10-Apr-2025',
    '14-Apr-2025','18-Apr-2025','01-May-2025','12-Aug-2025','15-Aug-2025',
    '27-Aug-2025','02-Oct-2025','20-Oct-2025','21-Oct-2025','22-Oct-2025',
    '05-Nov-2025','25-Dec-2025',
]);

function isTradingDay(d) { return isWeekday(d) && !HOLIDAYS.has(formatDate(d)); }

// ── Known Monthly Aggregates (from dashboard hardcoded data) ─────────────────
const MONTHLY = {
    'Mar-2026': { fn: -46646,  dn: 36462,  days: 0 },
    'Feb-2026': { fn: -12240,  dn: 57471,  days: 0 },
    'Jan-2026': { fn: -87374,  dn: 105309, days: 0 },
    'Dec-2025': { fn: -21402,  dn: 38401,  days: 0 },
    'Nov-2025': { fn: -42101,  dn: 51201,  days: 0 },
    'Oct-2025': { fn: -114402, dn: 121002, days: 0 },
    'Sep-2025': { fn: 15401,   dn: 35201,  days: 0 },
    'Aug-2025': { fn: -18402,  dn: 48201,  days: 0 },
};

// ── Count trading days per month ─────────────────────────────────────────────
const startDate = new Date(2025, 7, 1);  // Aug 1, 2025
const endDate = new Date(2026, 2, 28);   // Mar 28, 2026

for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    if (!isTradingDay(new Date(d))) continue;
    const key = `${M_REV[d.getMonth()]}-${d.getFullYear()}`;
    if (MONTHLY[key]) MONTHLY[key].days++;
}

console.log('Trading days per month:');
for (const [k, v] of Object.entries(MONTHLY)) console.log(`  ${k}: ${v.days} days`);

// ── Generate daily records ───────────────────────────────────────────────────
console.log('\nGenerating daily records...');

let history = readJSON(HISTORY_FILE, []);
const existingDates = new Set(history.map(h => h.date));
let added = 0;

// Use seeded random for reproducibility
let seed = 42;
function seededRandom() {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
}

for (let d = new Date(endDate); d >= startDate; d.setDate(d.getDate() - 1)) {
    const dt = new Date(d);
    if (!isTradingDay(dt)) continue;
    
    const dateStr = formatDate(dt);
    if (existingDates.has(dateStr)) continue;
    
    const key = `${M_REV[dt.getMonth()]}-${dt.getFullYear()}`;
    const monthly = MONTHLY[key];
    if (!monthly || monthly.days === 0) continue;
    
    // Distribute monthly total with realistic variance
    // We want some positive days even in a net negative month, and vice-versa.
    // So we use a baseline variance that occasionally flips the sign.
    let fFlip = seededRandom() > 0.75 ? -1 : 1; // 25% chance of opposing trend
    let dFlip = seededRandom() > 0.75 ? -1 : 1;
    
    // Scale up the daily average significantly because net includes both directions
    const scale = 2.0 + seededRandom() * 2.0;
    
    // Add random noise and sign flips to create realistic up/down streaks
    const fiiNet = Math.round((monthly.fn / monthly.days) * scale * fFlip * (0.2 + seededRandom()));
    const diiNet = Math.round((monthly.dn / monthly.days) * scale * dFlip * (0.2 + seededRandom()));
    
    // Generate realistic buy/sell from net
    const fiiGrossMultiplier = 3.0 + seededRandom() * 4.0;
    const diiGrossMultiplier = 3.0 + seededRandom() * 4.0;
    const fiiBuy = Math.round(Math.abs(fiiNet) * fiiGrossMultiplier + (seededRandom() * 2000));
    const fiiSell = fiiBuy - fiiNet;
    const diiBuy = Math.round(Math.abs(diiNet) * diiGrossMultiplier + (seededRandom() * 2000));
    const diiSell = diiBuy - diiNet;
    
    // Generate realistic F&O data
    const fiiIdxFutLong = Math.round(30000 + seededRandom() * 40000);
    const fiiIdxFutShort = Math.round(200000 + seededRandom() * 150000);
    const diiIdxFutLong = Math.round(60000 + seededRandom() * 30000);
    const diiIdxFutShort = Math.round(12000 + seededRandom() * 10000);
    const fiiStkFutLong = Math.round(3500000 + seededRandom() * 1000000);
    const fiiStkFutShort = Math.round(2500000 + seededRandom() * 1000000);
    const diiStkFutLong = Math.round(250000 + seededRandom() * 200000);
    const diiStkFutShort = Math.round(3800000 + seededRandom() * 800000);
    const fiiIdxCallLong = Math.round(400000 + seededRandom() * 400000);
    const fiiIdxCallShort = Math.round(800000 + seededRandom() * 400000);
    const fiiIdxPutLong = Math.round(500000 + seededRandom() * 400000);
    const fiiIdxPutShort = Math.round(400000 + seededRandom() * 300000);
    
    const pcr = fiiIdxCallShort > 0 ? parseFloat((fiiIdxPutShort / fiiIdxCallShort).toFixed(2)) : 1.0;
    
    let sentiment = 50;
    sentiment += (fiiNet / 200);
    sentiment += ((fiiIdxFutLong - fiiIdxFutShort) / 5000);
    if (pcr > 1.3) sentiment -= 10;
    if (pcr < 0.7) sentiment += 10;
    sentiment = Math.min(100, Math.max(0, parseFloat(sentiment.toFixed(1))));
    
    const record = {
        date: dateStr,
        fii_buy: fiiBuy, fii_sell: fiiSell, fii_net: fiiNet,
        dii_buy: diiBuy, dii_sell: diiSell, dii_net: diiNet,
        fii_idx_fut_long: fiiIdxFutLong, fii_idx_fut_short: fiiIdxFutShort,
        fii_idx_fut_net: fiiIdxFutLong - fiiIdxFutShort,
        dii_idx_fut_long: diiIdxFutLong, dii_idx_fut_short: diiIdxFutShort,
        dii_idx_fut_net: diiIdxFutLong - diiIdxFutShort,
        fii_stk_fut_long: fiiStkFutLong, fii_stk_fut_short: fiiStkFutShort,
        fii_stk_fut_net: fiiStkFutLong - fiiStkFutShort,
        dii_stk_fut_long: diiStkFutLong, dii_stk_fut_short: diiStkFutShort,
        dii_stk_fut_net: diiStkFutLong - diiStkFutShort,
        fii_idx_call_long: fiiIdxCallLong, fii_idx_call_short: fiiIdxCallShort,
        fii_idx_call_net: fiiIdxCallLong - fiiIdxCallShort,
        fii_idx_put_long: fiiIdxPutLong, fii_idx_put_short: fiiIdxPutShort,
        fii_idx_put_net: fiiIdxPutLong - fiiIdxPutShort,
        pcr, sentiment_score: sentiment,
        _updated_at: new Date().toISOString(),
        _source: 'historical-seed'
    };
    
    history.push(record);
    existingDates.add(dateStr);
    added++;
}

// Sort descending by date
const M = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
history.sort((a, b) => {
    const p1 = a.date.split('-'), p2 = b.date.split('-');
    const d1 = new Date(parseInt(p1[2]), M[p1[1]] ?? 0, parseInt(p1[0]));
    const d2 = new Date(parseInt(p2[2]), M[p2[1]] ?? 0, parseInt(p2[0]));
    return d2 - d1;
});

// Remove duplicates
const seen = new Set();
history = history.filter(r => { if (seen.has(r.date)) return false; seen.add(r.date); return true; });

writeJSON(HISTORY_FILE, history);

console.log(`\n══════════════════════════════════════════════════════`);
console.log(`  HISTORY SEED COMPLETE`);
console.log(`  Total records: ${history.length}`);
console.log(`  New records added: ${added}`);
console.log(`  Date range: ${history[history.length-1]?.date} → ${history[0]?.date}`);
console.log(`══════════════════════════════════════════════════════\n`);
