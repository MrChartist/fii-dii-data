#!/usr/bin/env node
/**
 * repair_derived.js — recompute derived F&O fields (PCR, sentiment score, nets)
 * for history rows that carry participant OI but are missing them.
 *
 * Older ingestion paths ("live-fetch", "historical-seed") stored the raw
 * long/short columns without PCR or with a placeholder sentiment of 0, which
 * the dashboard and Telegram messages then showed as-is. Idempotent: rows that
 * already have valid derived values are left untouched.
 *
 * Usage: node scripts/repair_derived.js
 */
const fs = require('fs');
const path = require('path');
const { applyFao, rowHasFao } = require('./fetch_data');

const file = path.join(process.cwd(), 'data', 'history.json');
const history = JSON.parse(fs.readFileSync(file, 'utf8'));
let fixed = 0;
for (const row of history) {
    if (!rowHasFao(row)) continue;
    if (row.pcr > 0 && row.sentiment_score >= 5) continue;
    const g = (k) => Number(row[k] || 0);
    applyFao(row, {
        FII: {
            idx_fut_long: g('fii_idx_fut_long'), idx_fut_short: g('fii_idx_fut_short'),
            stk_fut_long: g('fii_stk_fut_long'), stk_fut_short: g('fii_stk_fut_short'),
            idx_call_long: g('fii_idx_call_long'), idx_call_short: g('fii_idx_call_short'),
            idx_put_long: g('fii_idx_put_long'), idx_put_short: g('fii_idx_put_short'),
        }
    });
    fixed++;
}
if (fixed) {
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(history, null, 2), 'utf8');
    fs.renameSync(tmp, file);
}
console.log(`Recomputed derived F&O fields for ${fixed} row(s).`);
