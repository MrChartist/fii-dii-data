'use strict';
/**
 * NiftyTrader "FII DII data" page — last ~90 sessions embedded as JSON:
 *   {"created_at":"2026-10-01T00:00:00","fii_net_value":-9484.22,"dii_net_value":10041.84,...}
 * NET only. Used purely as an independent cross-check of StockeZee.
 */
const axios = require('axios');
const { isoToNse } = require('./stockezee');

const URL = 'https://www.niftytrader.in/fii-dii-data';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

/** HTML → Map<'DD-Mon-YYYY', {fii_net, dii_net}>. Never throws. */
function parseNiftytrader(html) {
    const out = new Map();
    const re = /"created_at":"(\d{4}-\d{2}-\d{2})T[^"]*","fii_net_value":(-?[\d.]+),"dii_net_value":(-?[\d.]+)/g;
    for (const m of String(html || '').matchAll(re)) {
        const date = isoToNse(m[1]);
        if (date) out.set(date, { fii_net: parseFloat(m[2]), dii_net: parseFloat(m[3]) });
    }
    return out;
}

async function fetchNiftytrader(timeout = 30000) {
    const res = await axios.get(URL, { headers: { 'User-Agent': UA, Accept: 'text/html' }, timeout, responseType: 'text', maxContentLength: 20 * 1024 * 1024 });
    return parseNiftytrader(res.data);
}

module.exports = { parseNiftytrader, fetchNiftytrader, URL };
