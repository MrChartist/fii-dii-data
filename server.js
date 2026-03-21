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

let axios, cron, fetchAndProcessData, getDB;
let fetchAllNSDL, buildMockSectorData;
let runTradeWiseBackfill;

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
    // Provide fallback so server still starts
    getDB = () => Promise.resolve({
        get: async () => null,
        all: async () => [],
        run: async () => {},
        close: async () => {}
    });
    fetchAndProcessData = async () => null;
}

try {
    const nsdlModule = require('./scripts/fetch_nsdl');
    fetchAllNSDL = nsdlModule.fetchAllNSDL;
    buildMockSectorData = nsdlModule.buildMockSectorData;
    console.log('[BOOT] fetch_nsdl loaded ✓');
} catch (e) {
    console.error('[BOOT] fetch_nsdl failed:', e.message);
    fetchAllNSDL = async () => null;
    buildMockSectorData = () => ({ sectors: [], is_mock: true });
}

try {
    const tradeWiseModule = require('./scripts/fetch_tradewise_backfill');
    runTradeWiseBackfill = tradeWiseModule.runTradeWiseBackfill;
    console.log('[BOOT] fetch_tradewise_backfill loaded ✓');
} catch (e) {
    console.error('[BOOT] fetch_tradewise_backfill failed:', e.message);
    runTradeWiseBackfill = async () => null;
}

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Static files
app.use(express.static(path.join(__dirname, '.'), {
    maxAge: '1h',
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('sw.js') || filePath.endsWith('manifest.json')) {
            res.setHeader('Cache-Control', 'no-cache');
        }
    }
}));

// ── Routes ────────────────────────────────────────────────────────────────────

// Dashboard
app.get('/', (req, res) => {
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

// ── NSDL FPI Routes ──────────────────────────────────────────────────────────
const fs = require('fs');
const DATA_DIR = require('path').join(__dirname, 'data');

function readDataFile(filename, defaultVal = null) {
    try {
        const p = require('path').join(DATA_DIR, filename);
        if (!fs.existsSync(p)) return defaultVal;
        return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch { return defaultVal; }
}

// Latest fortnightly sector data
app.get('/api/nsdl/sectors', (req, res) => {
    let data = readDataFile('sector_latest.json');
    if (!data || !data.sectors || data.sectors.length === 0) {
        // Return mock data so UI always has something
        data = buildMockSectorData ? buildMockSectorData() : { sectors: [], is_mock: true };
    }
    res.json(data);
});

// Historical fortnightly sector snapshots
app.get('/api/nsdl/sector-history', (req, res) => {
    const data = readDataFile('sector_history.json', []);
    res.json(data);
});

// FPI daily trends
app.get('/api/nsdl/daily', (req, res) => {
    const data = readDataFile('fpi_daily.json');
    if (!data) return res.status(404).json({ error: 'No FPI daily data yet. Trigger /api/nsdl/refresh to fetch.' });
    res.json(data);
});

// FPI yearly data (monthly breakdown per calendar year)
app.get('/api/nsdl/yearly', (req, res) => {
    const data = readDataFile('fpi_yearly_monthly.json');
    if (!data) return res.status(404).json({ error: 'No FPI yearly data yet. Run yearly backfill.' });
    res.json(data);
});

// FPI quarterly data
app.get('/api/nsdl/quarterly', (req, res) => {
    const data = readDataFile('fpi_quarterly.json');
    if (!data) return res.status(404).json({ error: 'No FPI quarterly data yet.' });
    res.json(data);
});

app.get('/api/nsdl/monthly-history', (req, res) => {
    const data = readDataFile('fpi_monthly_history.json');
    if (!data) return res.status(404).json({ error: 'No FPI monthly history yet. Run scripts/fetch_nsdl_daily_backfill.js to populate.' });
    res.json(data);
});

// Country-wise AUC
app.get('/api/nsdl/country-auc', (req, res) => {
    const data = readDataFile('country_auc.json');
    if (!data) return res.status(404).json({ error: 'No country AUC data yet.' });
    res.json(data);
});

// ODI/PN
app.get('/api/nsdl/odi-pn', (req, res) => {
    const data = readDataFile('odi_pn.json');
    if (!data) return res.status(404).json({ error: 'No ODI/PN data yet.' });
    res.json(data);
});

// Debt Utilisation
app.get('/api/nsdl/debt-utilisation', (req, res) => {
    const data = readDataFile('debt_utilisation.json');
    if (!data) return res.status(404).json({ error: 'No Debt Utilisation data yet.' });
    res.json(data);
});

// Trade-Wise Data
app.get('/api/nsdl/tradewise', (req, res) => {
    const data = readDataFile('tradewise_sector_monthly.json');
    if (!data) return res.status(404).json({ error: 'No Trade-Wise data yet. Run backfill.' });
    res.json(data);
});

// Manual Trade-Wise Trigger
app.post('/api/nsdl/tradewise-trigger', async (req, res) => {
    try {
        await runTradeWiseBackfill(1); // Fetch just 1 month to seed the file
        res.json({ success: true, message: 'Trade-Wise backfill completed for 1 month.' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Manual NSDL refresh
app.post('/api/nsdl/refresh', async (req, res) => {
    try {
        const result = await fetchAllNSDL();
        res.json({ success: true, result });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
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

            // NSDL FPI fortnightly fetch — Mon & Fri at 8 PM IST (UTC 14:30)
            cron.schedule('0 14 * * 1,5', async () => {
                console.log(`[${new Date().toISOString()}] NSDL fortnightly fetch starting…`);
                try {
                    await fetchAllNSDL();
                    console.log(`[${new Date().toISOString()}] NSDL fortnightly fetch completed.`);
                } catch (err) {
                    console.error(`[${new Date().toISOString()}] NSDL fetch failed:`, err.message);
                }
            });
            console.log('[BOOT] ✅ NSDL cron scheduled (Mon & Fri 8 PM IST)');

            // NSDL Trade-Wise Backfill — Monthly on the 10th at 8 PM IST (UTC 14:30)
            cron.schedule('30 14 10 * *', async () => {
                console.log(`[${new Date().toISOString()}] NSDL Trade-Wise monthly backfill starting…`);
                try {
                    await runTradeWiseBackfill(2); // Fetch last 2 months to ensure completeness
                    console.log(`[${new Date().toISOString()}] NSDL Trade-Wise backfill completed.`);
                } catch (err) {
                    console.error(`[${new Date().toISOString()}] NSDL Trade-Wise backfill failed:`, err.message);
                }
            });
            console.log('[BOOT] ✅ NSDL Trade-Wise cron scheduled (10th of every month 8 PM IST)');
        } catch (e) {
            console.error('[BOOT] Cron scheduling failed:', e.message);
        }
    } else {
        console.warn('[BOOT] ⚠ node-cron not available, skipping scheduler');
    }
});

module.exports = app;
