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
const fs = require('fs');
const http = require('http');

let axios, cron, fetchAndProcessData, getDB;

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
    getDB = fetchModule.getDB;
    console.log('[BOOT] fetch_data loaded ✓');
} catch (e) {
    console.error('[BOOT] fetch_data failed:', e.message);
    getDB = () => Promise.resolve({
        get: async () => null,
        all: async () => [],
        run: async () => {},
        close: async () => {}
    });
    fetchAndProcessData = async () => null;
}

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, '.'), {
    maxAge: '1h',
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('sw.js') || filePath.endsWith('manifest.json')) {
            res.setHeader('Cache-Control', 'no-cache');
        }
    }
}));

// ── Routes ────────────────────────────────────────────────────────────────────

// Homepage
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// FII DII Full Dashboard
app.get('/fii-dii', (req, res) => {
    res.sendFile(path.join(__dirname, 'fii_dii_india_flows_dashboard.html'));
});

// Latest FII/DII snapshot
app.get('/api/data', async (req, res) => {
    try {
        const db = await getDB();
        const data = await db.all('SELECT * FROM flows ORDER BY rowid DESC LIMIT 10');
        await db.close();
        if (!data || data.length === 0) return res.status(404).json({ error: 'No data found.' });
        const M = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
        data.sort((a,b) => {
            const pa = (a.date||'').split('-'), pb = (b.date||'').split('-');
            if(pa.length<3||pb.length<3) return 0;
            return new Date(pb[2],M[pb[1]],pb[0]) - new Date(pa[2],M[pa[1]],pa[0]);
        });
        res.json(data[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Rolling history
app.get('/api/history', async (req, res) => {
    try {
        const db = await getDB();
        const history = await db.all('SELECT * FROM flows ORDER BY rowid DESC LIMIT 100');
        await db.close();
        const M = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
        history.sort((a,b) => {
            const pa = (a.date||'').split('-'), pb = (b.date||'').split('-');
            if(pa.length<3||pb.length<3) return 0;
            return new Date(pb[2],M[pb[1]],pb[0]) - new Date(pa[2],M[pa[1]],pa[0]);
        });
        res.json(history.slice(0,60));
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
        const db = await getDB();
        const logs = await db.all('SELECT * FROM fetch_logs ORDER BY id DESC LIMIT 5');
        await db.close();
        res.json({ status: 'ok', serverTime: new Date().toISOString(), recentLogs: logs });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Yahoo Finance proxy — Nifty & VIX
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

// NSE Market Statistics — reads from file saved by GitHub Actions
app.get('/api/market-stats', (req, res) => {
    try {
        const filePath = path.join(__dirname, 'data', 'market-stats.json');
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                error: 'Market stats not available yet — GitHub Actions fetches this daily at 6 PM IST'
            });
        }
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        res.json(data);
    } catch (err) {
        console.error('❌ Market stats read error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── Sector Returns — reads from file saved by GitHub Actions ─────────────────
app.get('/api/sector-returns', (req, res) => {
    try {
        const filePath = path.join(__dirname, 'data', 'sector-returns.json');
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                error: 'Sector data not available yet — GitHub Actions fetches this daily after market close'
            });
        }
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        res.json(data);
    } catch (err) {
        console.error('❌ Sector returns read error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Sector Rotation Dashboard
app.get('/sector-rotation', (req, res) => {
    res.sendFile(path.join(__dirname, 'sector_rotation.html'));
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', ts: new Date().toISOString() });
});

// ── Start server ──────────────────────────────────────────────────────────────
console.log(`[BOOT] Attempting to listen on 0.0.0.0:${PORT}…`);
app.listen(PORT, '0.0.0.0', () => {
    console.log(`[BOOT] ✅ Server running on port ${PORT}`);

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
