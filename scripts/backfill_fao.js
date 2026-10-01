// One-off / repair: fill F&O participant-OI for every cash-only history row.
// The nsearchives host serves these CSVs without an NSE session cookie.
// Usage: node scripts/backfill_fao.js [--dry-run]
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { parseFao, applyFao, buildFaoSummary, rowHasFao } = require('./fetch_data.js');

const DATA = path.join(__dirname, '..', 'data');
const DRY = process.argv.includes('--dry-run');
const MONTHS = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };

async function get(date) {
    const [d, m, y] = date.split('-');
    const stamp = `${d.padStart(2, '0')}${MONTHS[m]}${y}`;
    for (const suffix of ['_b', '']) {
        try {
            const r = await axios.get(`https://nsearchives.nseindia.com/content/nsccl/fao_participant_oi_${stamp}${suffix}.csv`,
                { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 15000, validateStatus: s => s === 200 });
            if (r.data && r.data.length > 100) return r.data;
        } catch { /* try next */ }
    }
    return null;
}

(async () => {
    const hp = path.join(DATA, 'history.json');
    const history = JSON.parse(fs.readFileSync(hp, 'utf8'));
    const todo = history.filter(r => r._source === 'fetch-pipeline' && !rowHasFao(r));
    const filled = [], missing = [];
    for (const row of todo) {
        const csv = await get(row.date);
        if (csv && applyFao(row, parseFao(csv)) && rowHasFao(row)) {
            row._fao_summary = buildFaoSummary(row);
            row._fao_backfilled_at = new Date().toISOString();
            filled.push(row.date);
        } else missing.push(row.date);
    }
    console.log(`candidates ${todo.length} · filled ${filled.length} · missing ${missing.length}`, missing.slice(0, 10));
    if (DRY || !filled.length) return;
    fs.writeFileSync(hp, JSON.stringify(history, null, 2));
    const lp = path.join(DATA, 'latest.json');
    const latest = JSON.parse(fs.readFileSync(lp, 'utf8'));
    const upd = history.find(r => r.date === latest.date);
    if (upd && filled.includes(latest.date)) fs.writeFileSync(lp, JSON.stringify(upd, null, 2));
})();
