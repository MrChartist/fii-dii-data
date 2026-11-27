'use strict';
/**
 * Groww "FII DII data" page — server-rendered HTML table with the last ~10 sessions:
 * Date | FII gross buy | FII gross sell | FII net | DII gross buy | DII gross sell | DII net  (₹ Cr)
 * Figures are the exchanges' provisional FII/DII numbers (verified identical to NSE rows).
 * Parsing keys on cell CONTENT, not class names (those are build hashes that change on every deploy).
 */
const axios = require('axios');
const { parse: parseDate, format } = require('../../../lib/dates');

const URL = 'https://groww.in/fii-dii-data';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const num = (s) => parseFloat(String(s).replace(/[,+\s₹]/g, ''));
const strip = (h) => h.replace(/<!--.*?-->/g, '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();

/** "26 Nov 2026" → "26-Nov-2026" (null if not a date) */
function toNseDate(s) {
    const m = /^(\d{1,2}) ([A-Z][a-z]{2}) (\d{4})$/.exec(s.trim());
    if (!m) return null;
    const out = `${m[1].padStart(2, '0')}-${m[2]}-${m[3]}`;
    return parseDate(out) ? out : null;
}

/** HTML → [{date, fii_buy, fii_sell, fii_net, dii_buy, dii_sell, dii_net}] newest first. Never throws. */
function parseGroww(html) {
    const rows = [];
    for (const tr of String(html || '').match(/<tr[\s>][\s\S]*?<\/tr>/g) || []) {
        const cells = (tr.match(/<td[\s>][\s\S]*?<\/td>/g) || []).map(strip);
        if (cells.length !== 7) continue;
        const date = toNseDate(cells[0]);
        if (!date) continue;
        const [fii_buy, fii_sell, fii_net, dii_buy, dii_sell, dii_net] = cells.slice(1).map(num);
        rows.push({ date, fii_buy, fii_sell, fii_net, dii_buy, dii_sell, dii_net });
    }
    return rows;
}

async function fetchGroww(timeout = 20000) {
    const res = await axios.get(URL, { headers: { 'User-Agent': UA, Accept: 'text/html' }, timeout, responseType: 'text' });
    return parseGroww(res.data);
}

module.exports = { parseGroww, fetchGroww, toNseDate, URL, format };
