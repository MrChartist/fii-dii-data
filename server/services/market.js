'use strict';
/** Persisted daily Nifty/VIX closes (Yahoo Finance), appended after each new session. */
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('../../lib/store');

// Append today's Nifty + VIX close to data/market_history.json (idempotent per date)
async function persistMarketClose(dateStr) {
    try {
        const fetchClose = async (ticker) => {
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
            const { data } = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 8000 });
            const v = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
            return Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
        };
        const [nifty, vix] = await Promise.all([fetchClose('^NSEI'), fetchClose('^INDIAVIX')]);
        if (nifty == null && vix == null) return;
        const p = path.join(DATA_DIR, 'market_history.json');
        const rows = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : [];
        const idx = rows.findIndex(r => r.date === dateStr);
        const row = { date: dateStr, nifty_close: nifty, vix_close: vix, ts: new Date().toISOString() };
        if (idx >= 0) rows[idx] = row; else rows.unshift(row);
        const tmp = p + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(rows.slice(0, 800), null, 2), 'utf8');
        fs.renameSync(tmp, p);
        console.log(`[MARKET] Persisted close for ${dateStr} (Nifty ${nifty}, VIX ${vix})`);
    } catch (err) {
        console.warn('[MARKET] Close persistence failed:', err.message);
    }
}

module.exports = { persistMarketClose };
