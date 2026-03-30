// ── Global crash handler (MUST be first) ─────────────────────────────────────
process.on('uncaughtException', (err) => {
    console.error('[FATAL] Uncaught Exception:', err.message, err.stack);
});
process.on('unhandledRejection', (reason) => {
    console.error('[FATAL] Unhandled Rejection:', reason);
});

console.log('[BOOT] Starting server.js…');

const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');

let axios, cron, fetchAndProcessData, getLatestData, getHistoryData, getFetchLogs, getSectorData;

try {
    axios = require('axios');
    console.log('[BOOT] axios loaded ✓');
} catch (e) {
    console.error('[BOOT] axios failed:', e.message);
}

try {
    cron = require('node-cron');
    console.log('[BOOT] node-cron loaded ✓');
} catch (e) {
    console.error('[BOOT] node-cron failed:', e.message);
}

try {
    const fetchModule = require('./scripts/fetch_data');
    fetchAndProcessData = fetchModule.fetchAndProcessData;
    getLatestData = fetchModule.getLatestData;
    getHistoryData = fetchModule.getHistoryData;
    getFetchLogs = fetchModule.getFetchLogs;
    getSectorData = fetchModule.getSectorData;
    console.log('[BOOT] fetch_data loaded ✓');
} catch (e) {
    console.error('[BOOT] fetch_data failed:', e.message);
    // Provide fallback so server still starts
    getLatestData = () => null;
    getHistoryData = () => [];
    getFetchLogs = () => [];
    getSectorData = () => [];
    fetchAndProcessData = async () => null;
}

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Security headers (production-grade)
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
});

// Static files (production caching strategy)
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '1d',           // Cache static assets for 1 day
    etag: true,             // Enable ETag for conditional requests
    setHeaders: (res, filePath) => {
        // Never cache SW or manifest (must always be fresh for PWA updates)
        if (filePath.endsWith('sw.js') || filePath.endsWith('manifest.json')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
        // HTML should revalidate on every request (stale-while-revalidate)
        if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
        }
    }
}));

// ── Routes ────────────────────────────────────────────────────────────────────

// Dashboard
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Latest FII/DII snapshot
app.get('/api/data', async (req, res) => {
    try {
        const data = getLatestData();
        if (!data) return res.status(404).json({ error: 'No data found.' });
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Rolling history
app.get('/api/history', async (req, res) => {
    try {
        const history = getHistoryData(60);
        res.json(history);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Sectors Data
app.get('/api/sectors', async (req, res) => {
    try {
        const sectors = getSectorData();
        res.json(sectors);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Full History (For Frontend Initial Load)
app.get('/api/history-full', async (req, res) => {
    try {
        const history = getHistoryData(800); // Plenty for the dashboard charts
        
        // Map to the concise format the frontend expects
        const formatted = history.map(h => ({
            d: h.date,
            fb: h.fii_buy || 0,
            fs: h.fii_sell || 0,
            fn: h.fii_net || 0,
            db: h.dii_buy || 0,
            ds: h.dii_sell || 0,
            dn: h.dii_net || 0,
            fii_idx_fut_long: h.fii_idx_fut_long,
            fii_idx_fut_short: h.fii_idx_fut_short,
            fii_idx_call_long: h.fii_idx_call_long,
            fii_idx_call_short: h.fii_idx_call_short,
            fii_idx_put_long: h.fii_idx_put_long,
            fii_idx_put_short: h.fii_idx_put_short,
            fii_stk_fut_long: h.fii_stk_fut_long,
            fii_stk_fut_short: h.fii_stk_fut_short,
            dii_idx_fut_long: h.dii_idx_fut_long,
            dii_idx_fut_short: h.dii_idx_fut_short,
            dii_stk_fut_long: h.dii_stk_fut_long,
            dii_stk_fut_short: h.dii_stk_fut_short,
            pcr: h.pcr,
            sentiment_score: h.sentiment_score
        }));
        
        res.json(formatted);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Manual trigger
app.post('/api/refresh', async (req, res) => {
    try {
        const data = await fetchAndProcessData();
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Status
app.get('/api/status', async (req, res) => {
    try {
        const logs = getFetchLogs(5);
        res.json({ status: 'ok', serverTime: new Date().toISOString(), recentLogs: logs });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Yahoo Finance proxy
app.get('/api/market', async (req, res) => {
    try {
        const fetchJSON = async (ticker) => {
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
            const { data } = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 8000 });
            const m = data.chart.result[0].meta;
            const price = m.regularMarketPrice;
            const prev = m.previousClose || m.chartPreviousClose;
            return { price, change: price - prev, pct: ((price - prev) / prev) * 100 };
        };
        const [nifty, vix] = await Promise.all([fetchJSON('^NSEI'), fetchJSON('^INDIAVIX')]);
        res.json({ nifty, vix });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', ts: new Date().toISOString() });
});

// ── Start server FIRST (before anything else) ───────────────────────────────
console.log(`[BOOT] Attempting to listen on 0.0.0.0:${PORT}…`);
app.listen(PORT, '0.0.0.0', () => {
    console.log(`[BOOT] ✅ Server running on port ${PORT}`);

    // ── Scheduler (deferred until server is listening) ─────────────────────
    if (cron) {
        try {
            async function runFetchTask(label) {
                console.log(`[${new Date().toISOString()}] ${label} fetch starting…`);
                try {
                    await fetchAndProcessData();
                    console.log(`[${new Date().toISOString()}] ${label} fetch completed.`);
                } catch (err) {
                    console.error(`[${new Date().toISOString()}] ${label} fetch failed:`, err.message);
                }
            }
            // NSE FII/DII data publishes after market close (~6-7 PM IST)
            // Run 3 targeted fetches during the publish window (IST = UTC+5:30)
            cron.schedule('30 12 * * 1-5', () => runFetchTask('Post-market-1'));  // 6:00 PM IST
            cron.schedule('0 13 * * 1-5',  () => runFetchTask('Post-market-2'));  // 6:30 PM IST
            cron.schedule('30 13 * * 1-5', () => runFetchTask('Post-market-3'));  // 7:00 PM IST
            console.log('[BOOT] ✅ Cron jobs scheduled (6:00, 6:30, 7:00 PM IST Mon-Fri)');
        } catch (e) {
            console.error('[BOOT] Cron scheduling failed:', e.message);
        }
    } else {
        console.warn('[BOOT] ⚠ node-cron not available, skipping scheduler');
    }
});

module.exports = app;
