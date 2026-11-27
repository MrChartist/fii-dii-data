'use strict';
/**
 * Moneycontrol FII/DII activity page — Next.js page with the last ~30 sessions in __NEXT_DATA__:
 * { date: "2026-11-26", fiiCM: "5,843.33", diiCM: "5,630.72", fiiIdxFut, fiiIdxOpt, fiiStkFut, fiiStkOpt, … } (₹ Cr, NET only).
 * Used as an independent cross-check of Groww's net figures and as a net-only record of older sessions.
 */
const axios = require('axios');
const { format } = require('../../../lib/dates');

const URL = 'https://www.moneycontrol.com/stocks/marketstats/fii_dii_activity/index.php';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const num = (s) => parseFloat(String(s).replace(/,/g, ''));

/** Finds the fiiDiiData array wherever the page nests it. */
function findRows(node) {
    if (!node || typeof node !== 'object') return null;
    if (Array.isArray(node.fiiDiiData)) return node.fiiDiiData;
    for (const v of Object.values(node)) { const r = findRows(v); if (r) return r; }
    return null;
}

/** HTML → [{date:'DD-Mon-YYYY', fii_net, dii_net}] newest first. Never throws. */
function parseMoneycontrol(html) {
    try {
        const m = /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/.exec(String(html || ''));
        const rows = m && findRows(JSON.parse(m[1]));
        if (!rows) return [];
        return rows.map(r => {
            const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(r.date || '');
            const date = d ? format(new Date(Date.UTC(+d[1], +d[2] - 1, +d[3]))) : null;
            return { date, fii_net: num(r.fiiCM), dii_net: num(r.diiCM) };
        }).filter(r => r.date && Number.isFinite(r.fii_net) && Number.isFinite(r.dii_net));
    } catch { return []; }
}

async function fetchMoneycontrol(timeout = 20000) {
    const res = await axios.get(URL, { headers: { 'User-Agent': UA, Accept: 'text/html' }, timeout, responseType: 'text' });
    return parseMoneycontrol(res.data);
}

module.exports = { parseMoneycontrol, fetchMoneycontrol, URL };
