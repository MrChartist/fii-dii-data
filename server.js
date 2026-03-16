const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');
const fs = require('fs');
const { fetchAndProcessData } = require('./scripts/fetch_data');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.static(path.join(__dirname, '.'))); // Serve current dir logic, specifically HTML and data

// Serve the dashboard HTML on root access
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'fii_dii_india_flows_dashboard.html'));
});

// Serve the latest FII/DII JSON API
app.get('/api/data', (req, res) => {
    try {
        const dataPath = path.join(__dirname, 'data', 'latest.json');
        if (fs.existsSync(dataPath)) {
            const data = fs.readFileSync(dataPath, 'utf8');
            res.json(JSON.parse(data));
        } else {
            res.status(404).json({ error: 'Data not found' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Proxy TradingView Scanner API to bypass frontend CORS blocks
app.post('/api/ticker', async (req, res) => {
    try {
        const FIELDS = [
            "name", "description", "industry", "sector", "market_cap_basic", "currency", 
            "earnings_per_share_basic_ttm", "price_earnings_ttm", "close", "change", 
            "volume", "relative_volume_10d_calc", "average_volume_10d_calc", "High.All", 
            "Low.All", "SMA10", "SMA20", "SMA50", "change_abs"
        ];
        const tvRes = await fetch('https://scanner.tradingview.com/india/scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                "symbols": { "tickers": ["NSE:NIFTY", "NSE:INDIAVIX"] },
                "columns": FIELDS
            })
        });
        if (!tvRes.ok) throw new Error(`TradingView HTTP ${tvRes.status}`);
        const data = await tvRes.json();
        
        // Map arrays to named keys for easy frontend access
        const mappedData = (data.data || []).map(item => {
            const obj = { symbol: item.s };
            FIELDS.forEach((field, i) => {
                obj[field] = item.d[i] !== undefined ? item.d[i] : null;
            });
            return obj;
        });

        res.json({ data: mappedData });
    } catch (err) {
        console.error('[Ticker] proxy error:', err.message);
        res.status(500).json({ error: 'Failed to proxy TradingView' });
    }
});

// Autonomous CRON Job: Fetch new data directly every day at 18:30 IST (13:00 UTC)
// The NSE typically publishes Bhavcopies after 18:00 IST
cron.schedule('30 13 * * 1-5', async () => {
    console.log('[CRON] Initiating daily NSE FII/DII data fetch...');
    try {
        await fetchAndProcessData();
    } catch (error) {
        console.error('[CRON] Error during daily fetch:', error.message);
    }
}, {
    scheduled: true,
    timezone: "Asia/Kolkata"
});

// Also try to schedule a secondary fetch at 19:30 IST in case of NSE delays
cron.schedule('30 14 * * 1-5', async () => {
    console.log('[CRON] Initiating fallback daily NSE FII/DII data fetch...');
    try {
        await fetchAndProcessData();
    } catch (error) {
        console.error('[CRON] Error during fallback daily fetch:', error.message);
    }
}, {
    scheduled: true,
    timezone: "Asia/Kolkata"
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Dashboard accessible at http://localhost:${PORT}`);
    console.log(`⚙️ Automated CRON fetcher is ACTIVE`);
});
