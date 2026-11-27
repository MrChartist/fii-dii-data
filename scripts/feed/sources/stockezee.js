'use strict';
/**
 * StockeZee "FII DII historical data" page — ~1 year of sessions embedded as JSON:
 *   {"date":"2026-10-01T00:00:00","fii_cash":[{"category":"FII/FPI","net_value":-9484.22,..},{"category":"DII","net_value":10041.84,..}],...}
 * NET only (no gross buy/sell). Verified identical (±0.02 Cr) to every NSE-sourced row we hold.
 * A date appears here only if it was a trading session — absence of a weekday = exchange holiday.
 */
const axios = require('axios');
const { format } = require('../../../lib/dates');

const URL = 'https://www.stockezee.com/fii-dii-historical-data';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const isoToNse = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso); return m ? format(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))) : null; };

/** HTML → Map<'DD-Mon-YYYY', {fii_net, dii_net}>. Never throws. */
function parseStockezee(html) {
    const out = new Map();
    const re = /\{"date":"(\d{4}-\d{2}-\d{2})T[^"]*","fii_cash":\[(.*?)\]/g;
    for (const m of String(html || '').matchAll(re)) {
        const f = /"category":"FII\/FPI","net_value":(-?[\d.]+)/.exec(m[2]);
        const d = /"category":"DII","net_value":(-?[\d.]+)/.exec(m[2]);
        const date = isoToNse(m[1]);
        if (f && d && date) out.set(date, { fii_net: parseFloat(f[1]), dii_net: parseFloat(d[1]) });
    }
    return out;
}

async function fetchStockezee(timeout = 30000) {
    const res = await axios.get(URL, { headers: { 'User-Agent': UA, Accept: 'text/html' }, timeout, responseType: 'text', maxContentLength: 20 * 1024 * 1024 });
    return parseStockezee(res.data);
}

module.exports = { parseStockezee, fetchStockezee, URL, isoToNse };
