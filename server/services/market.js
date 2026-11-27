'use strict';
/** Yahoo Finance quotes (10s shared cache) and persisted daily Nifty/VIX closes. */
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('../../lib/store');

const MARKET_TICKERS = { nifty: '^NSEI', sensex: '^BSESN', vix: '^INDIAVIX' };
const MARKET_TTL_MS = 10 * 1000;
let _marketCache = { data: null, ts: 0, inflight: null };
async function fetchMarketQuote(ticker) {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
    const { data } = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 5000 });
    const m = data?.chart?.result?.[0]?.meta;
    const price = m?.regularMarketPrice;
    const prev = m?.previousClose || m?.chartPreviousClose;
    if (!Number.isFinite(price) || !Number.isFinite(prev) || prev === 0) {
        throw new Error(`Yahoo returned incomplete quote for ${ticker}`);
    }
    return { price, change: price - prev, pct: ((price - prev) / prev) * 100 };
}
async function refreshMarket() {
    const keys = Object.keys(MARKET_TICKERS);
    const results = await Promise.allSettled(keys.map(k => fetchMarketQuote(MARKET_TICKERS[k])));
    const prevData = _marketCache.data || {};
    const out = { ts: Date.now() };
    let ok = 0;
    keys.forEach((k, i) => {
        if (results[i].status === 'fulfilled') { out[k] = results[i].value; ok++; }
        else if (prevData[k]) out[k] = { ...prevData[k], stale: true };
    });
    if (!ok && !Object.keys(out).some(k => k !== 'ts')) throw new Error('Market quotes unavailable');
    _marketCache = { data: out, ts: Date.now(), inflight: null };
    return out;
}

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

/** Cached quotes for /api/market; coalesces concurrent refreshes. */
async function getQuotes() {
    if (_marketCache.data && Date.now() - _marketCache.ts < MARKET_TTL_MS) return { data: _marketCache.data, fresh: true };
    if (!_marketCache.inflight) {
        _marketCache.inflight = refreshMarket().finally(() => { _marketCache.inflight = null; });
    }
    return { data: await _marketCache.inflight, fresh: false };
}
function lastQuotes() { return _marketCache.data; }

module.exports = { getQuotes, lastQuotes, persistMarketClose };
