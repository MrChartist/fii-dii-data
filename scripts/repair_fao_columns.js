// ── One-off repair: un-swap F&O option columns in stored history ─────────────
// The positional CSV parser in fetch_data.js (before the header-based fix)
// read NSE's participant-OI columns as Call Long, Call Short, Put Long,
// Put Short — but the file's real order is Call Long, Put Long, Call Short,
// Put Short. So for every `fetch-pipeline` row:
//     stored fii_idx_call_short actually held PUT LONG
//     stored fii_idx_put_long   actually held CALL SHORT
// This script swaps them back, recomputes the option nets, PCR and the
// sentiment score, and rewrites history.json / latest.json atomically.
//
// Usage: node scripts/repair_fao_columns.js [--dry-run]

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DRY_RUN = process.argv.includes('--dry-run');

function readJSON(file) {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
}

function writeJSON(file, data) {
    const p = path.join(DATA_DIR, file);
    const tmp = p + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, p);
}

function recomputeSentiment(row) {
    let sentiment = 50;
    sentiment += Math.max(-15, Math.min(15, (row.fii_net || 0) / 500));
    sentiment += Math.max(-15, Math.min(15, (row.fii_idx_fut_net || 0) / 10000));
    if (row.pcr > 1.3) sentiment -= 8;
    else if (row.pcr > 1.1) sentiment -= 4;
    if (row.pcr < 0.7) sentiment += 8;
    else if (row.pcr < 0.9) sentiment += 4;
    return Math.min(100, Math.max(5, parseFloat(sentiment.toFixed(1))));
}

function repairRow(row) {
    // Only rows written by the (buggy) real pipeline, with option data present
    if (row._source !== 'fetch-pipeline') return false;
    if (!row.fii_idx_call_long && !row.fii_idx_call_short && !row.fii_idx_put_long) return false;
    if (row._fao_columns_repaired) return false;

    const realPutLong = row.fii_idx_call_short;
    const realCallShort = row.fii_idx_put_long;
    row.fii_idx_put_long = realPutLong;
    row.fii_idx_call_short = realCallShort;

    row.fii_idx_call_net = (row.fii_idx_call_long || 0) - (row.fii_idx_call_short || 0);
    row.fii_idx_put_net = (row.fii_idx_put_long || 0) - (row.fii_idx_put_short || 0);
    row.pcr = row.fii_idx_call_short > 0
        ? parseFloat(((row.fii_idx_put_short || 0) / row.fii_idx_call_short).toFixed(2))
        : 1.0;
    row.sentiment_score = recomputeSentiment(row);

    if (row._fao_summary) {
        row._fao_summary.pcr = row.pcr;
        row._fao_summary.fii_call_net = row.fii_idx_call_net;
        row._fao_summary.fii_put_net = row.fii_idx_put_net;
        row._fao_summary.sentiment = row.sentiment_score > 60 ? 'Bullish'
            : row.sentiment_score < 40 ? 'Bearish' : 'Neutral';
    }
    row._fao_columns_repaired = true;
    return true;
}

const history = readJSON('history.json');
let repaired = 0;
for (const row of history) {
    if (repairRow(row)) {
        repaired++;
        console.log(`  ✔ ${row.date}: pcr=${row.pcr} call_net=${row.fii_idx_call_net} put_net=${row.fii_idx_put_net} sentiment=${row.sentiment_score}`);
    }
}
console.log(`Repaired ${repaired}/${history.length} history rows${DRY_RUN ? ' (dry run — not written)' : ''}`);
if (!DRY_RUN && repaired) writeJSON('history.json', history);

try {
    const latest = readJSON('latest.json');
    if (repairRow(latest)) {
        console.log(`Repaired latest.json (${latest.date})`);
        if (!DRY_RUN) writeJSON('latest.json', latest);
    } else {
        // latest.json may be a copy of an already-repaired history row
        const fixed = history.find(r => r.date === latest.date && r._fao_columns_repaired);
        if (fixed && !DRY_RUN) {
            writeJSON('latest.json', fixed);
            console.log(`Synced latest.json from repaired history row (${fixed.date})`);
        }
    }
} catch { console.log('latest.json not found — skipped'); }
