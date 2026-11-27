'use strict';
/** Market data proxies: Nifty history, NSE large deals, NSDL daily FPI, persisted closes. */
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { DATA_DIR } = require('../../lib/store');
module.exports = function mount(app) {
    // Nifty 50 daily close history (Yahoo proxy, cached 1h) — powers the
    // cumulative-flows-vs-Nifty overlay on the dashboard
    let _niftyHistCache = { data: null, ts: 0 };
    app.get('/api/nifty-history', async (req, res) => {
        try {
            if (_niftyHistCache.data && Date.now() - _niftyHistCache.ts < 60 * 60 * 1000) {
                return res.json(_niftyHistCache.data);
            }
            const url = 'https://query1.finance.yahoo.com/v8/finance/chart/%5ENSEI?interval=1d&range=2y';
            const { data } = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 });
            const result = data?.chart?.result?.[0];
            const stamps = result?.timestamp || [];
            const closes = result?.indicators?.quote?.[0]?.close || [];
            const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const rows = [];
            for (let i = 0; i < stamps.length; i++) {
                if (!Number.isFinite(closes[i])) continue;
                // Yahoo timestamps are session-start UTC; shift to IST for the trading date
                const d = new Date((stamps[i] + 19800) * 1000);
                rows.push({
                    date: `${String(d.getUTCDate()).padStart(2, '0')}-${MONTHS[d.getUTCMonth()]}-${d.getUTCFullYear()}`,
                    close: Math.round(closes[i] * 100) / 100
                });
            }
            if (!rows.length) throw new Error('Yahoo returned no Nifty history');
            _niftyHistCache = { data: rows, ts: Date.now() };
            res.json(rows);
        } catch (err) {
            if (_niftyHistCache.data) return res.json(_niftyHistCache.data); // stale ok
            res.status(502).json({ error: 'Nifty history unavailable: ' + err.message });
        }
    });

    // NSE bulk/block deals proxy (cached 30 min). NSE edge-blocks many datacenter
    // IPs — fail gracefully so the frontend can hide the panel.
    let _dealsCache = { data: null, ts: 0 };
    app.get('/api/large-deals', async (req, res) => {
        try {
            if (_dealsCache.data && Date.now() - _dealsCache.ts < 30 * 60 * 1000) {
                return res.json(_dealsCache.data);
            }
            const NSE_HEADERS = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': '*/*', 'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://www.nseindia.com/market-data/large-deals'
            };
            // Bootstrap cookies from the homepage, then hit the JSON API
            const home = await axios.get('https://www.nseindia.com/', { headers: NSE_HEADERS, timeout: 10000 });
            const cookies = (home.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
            const { data } = await axios.get('https://www.nseindia.com/api/snapshot-capital-market-largedeal', {
                headers: { ...NSE_HEADERS, Cookie: cookies }, timeout: 10000
            });
            const mapDeal = (d) => ({
                symbol: d.symbol, name: d.name || d.clientName || '', client: d.clientName || '',
                side: d.buySell || '', qty: d.qty || 0, price: d.watp || d.tradePrice || 0,
                date: d.date || d.tradeDate || d.mTIMESTAMP || ''
            });
            const out = {
                as_on: data?.as_on_date || null,
                fetched_at: new Date().toISOString(),
                bulk: (data?.BULK_DEALS_DATA || []).map(mapDeal),
                block: (data?.BLOCK_DEALS_DATA || []).map(mapDeal),
                short: (data?.SHORT_DEALS_DATA || []).map(mapDeal)
            };
            _dealsCache = { data: out, ts: Date.now() };
            res.json(out);
        } catch (err) {
            if (_dealsCache.data) return res.json(_dealsCache.data); // stale ok
            res.status(502).json({ error: 'Large deals unavailable (NSE may be blocking this host)', detail: err.message });
        }
    });

    // NSDL daily FPI trends (custodian-settled equity/debt/hybrid nets)
    app.get('/api/fpi-daily', (req, res) => {
        try {
            const p = path.join(DATA_DIR, 'fpi_daily.json');
            if (!fs.existsSync(p)) return res.status(404).json({ error: 'NSDL daily data not yet fetched' });
            res.json(JSON.parse(fs.readFileSync(p, 'utf8')));
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Persisted daily market closes (Nifty + India VIX), appended post-market
    app.get('/api/market-history', (req, res) => {
        try {
            const p = path.join(DATA_DIR, 'market_history.json');
            res.json(fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : []);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
};
