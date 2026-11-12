// ── Global crash handler (MUST be first) ─────────────────────────────────────
process.on('uncaughtException', (err) => {
    console.error('[FATAL] Uncaught Exception:', err.message, err.stack);
});
process.on('unhandledRejection', (reason) => {
    console.error('[FATAL] Unhandled Rejection:', reason);
});

console.log('[BOOT] Starting server.js…');

require('dotenv').config(); // Load .env from project root
// Also try loading from parent/home directory (survives Hostinger auto-deploys)
const dotenvPath = require('path').join(__dirname, '..', '.env.fii-dii');
try { require('dotenv').config({ path: dotenvPath, override: false }); } catch {}

const express = require('express');
const cors = require('cors');
const { apiGuard, corsOptions } = require('./api-guard');
const compression = require('compression');
const path = require('path');
const fs = require('fs');
const http = require('http');

// ── SSE (Server-Sent Events) — real-time push through Apache ─────────────────
const sseClients = new Set();
function sseBroadcast(event, data) {
    const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of sseClients) {
        try { res.write(msg); } catch { sseClients.delete(res); }
    }
}

// ── Synthesis Cache (24h TTL, invalidated when new data arrives) ─────────────
let _synthCache = { text: null, ts: 0 };
const SYNTH_TTL = 24 * 60 * 60 * 1000; // 24 hours — synthesis regenerates once daily after FII/DII data posts

// ── Web Push Notifications ───────────────────────────────────────────────────
let webpush;
try {
    webpush = require('web-push');
    const VAPID_PUBLIC  = 'BDM4u63dFxAAA68MTP3W4mTxV3MZk7unyFQufGv6j3DhCFqf7T5lsp85zvQSSqX2sVrcLsrMhRvyiTZhS8BnsJw';
    const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
    if (!VAPID_PRIVATE) { console.warn('[BOOT] VAPID_PRIVATE_KEY not set — push notifications disabled'); webpush = null; }
    else { webpush.setVapidDetails('mailto:rohit@mrchartist.com', VAPID_PUBLIC, VAPID_PRIVATE); console.log('[BOOT] web-push loaded ✓'); }
} catch (e) {
    console.warn('[BOOT] web-push not available:', e.message);
}

const SUBS_PATH = path.join(__dirname, 'data', 'subscriptions.json');
const ALL_ALERT_CATEGORIES = ['cash', 'fao', 'sectors'];

function loadSubscriptions() {
    try {
        if (!fs.existsSync(SUBS_PATH)) return [];
        const subs = JSON.parse(fs.readFileSync(SUBS_PATH, 'utf8'));
        // Auto-migrate: existing entries without categories get all categories
        let migrated = false;
        subs.forEach(sub => {
            if (!sub.categories || !Array.isArray(sub.categories)) {
                sub.categories = [...ALL_ALERT_CATEGORIES];
                migrated = true;
            }
        });
        if (migrated) saveSubscriptions(subs);
        return subs;
    } catch { return []; }
}

function saveSubscriptions(subs) {
    const tmp = SUBS_PATH + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(subs, null, 2), 'utf8');
    fs.renameSync(tmp, SUBS_PATH);
}

async function broadcastNotification(payload, category = 'cash') {
    if (!webpush) return;
    const subs = loadSubscriptions();
    // Filter to only subscribers who opted into this category
    const targets = subs.filter(s => s.categories && s.categories.includes(category));
    if (!targets.length) return;
    console.log(`[PUSH] Broadcasting '${category}' to ${targets.length}/${subs.length} subscriber(s)…`);
    const dead = [];
    const body = JSON.stringify({ ...payload, category });
    await Promise.allSettled(targets.map(async (sub) => {
        try {
            const pushSub = { endpoint: sub.endpoint, keys: sub.keys, expirationTime: sub.expirationTime || null };
            await webpush.sendNotification(pushSub, body);
        } catch (err) {
            if (err.statusCode === 404 || err.statusCode === 410) dead.push(sub.endpoint);
            else console.warn('[PUSH] Send error:', err.statusCode || err.message);
        }
    }));
    if (dead.length) {
        // Re-load before writing: subscribers may have been added/updated while
        // the push fan-out was in flight, and writing the stale snapshot would drop them.
        const fresh = loadSubscriptions();
        const cleaned = fresh.filter(s => !dead.includes(s.endpoint));
        saveSubscriptions(cleaned);
        console.log(`[PUSH] Cleaned ${dead.length} expired subscription(s)`);
    }
}

let axios, cron, fetchAndProcessData, getLatestData, getHistoryData, getFetchLogs, getSectorData;
let backfillMissingFao = async () => [];
let fetchAllNSDL;

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
    if (fetchModule.backfillMissingFao) backfillMissingFao = fetchModule.backfillMissingFao;
    console.log('[BOOT] fetch_data loaded ✓');
} catch (e) {
    console.error('[BOOT] fetch_data failed:', e.message);
    getLatestData = () => null;
    getHistoryData = () => [];
    getFetchLogs = () => [];
    getSectorData = () => [];
    fetchAndProcessData = async () => null;
}

try {
    const nsdlModule = require('./scripts/fetch_nsdl');
    fetchAllNSDL = nsdlModule.fetchAllNSDL;
    console.log('[BOOT] fetch_nsdl loaded ✓');
} catch (e) {
    console.warn('[BOOT] fetch_nsdl not available:', e.message);
    fetchAllNSDL = async () => null;
}

// ── Agent System ─────────────────────────────────────────────────────────────
let agentRunner;
try {
    agentRunner = require('./agent-runner');
    console.log('[BOOT] agent-runner loaded ✓ (agents: ' + Object.keys(agentRunner.AGENTS).join(', ') + ')');
} catch (e) {
    console.warn('[BOOT] agent-runner not available:', e.message);
    agentRunner = null;
}


const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(compression({ threshold: 1024 }));
app.set('trust proxy', 1);
app.use(cors(corsOptions()));
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

// API access control — dashboard (same-origin) or approved key only
app.use(apiGuard);

// Agent-readiness: Markdown homepage, Link headers, MCP server + server card
// (MUST be before the dynamic root route and express.static)
try {
    require('./agent-ready').mount(app, { getHistoryData: (n) => getHistoryData(n), getSectorData: () => getSectorData() });
    console.log('[BOOT] agent-ready mounted ✓ (/index.md, /mcp, /.well-known/mcp/server-card.json)');
} catch (e) {
    console.warn('[BOOT] agent-ready not available:', e.message);
}

// Dynamic Root Route for OG Tags (MUST be before express.static)
app.get('/', (req, res, next) => {
    // If it's explicitly not a GET for root, pass it
    if (req.path !== '/') return next();

    try {
        const indexPath = path.join(__dirname, 'public', 'index.html');
        let html = fs.readFileSync(indexPath, 'utf8');

        // Dynamically build the social sharing description
        const { getState } = require('./agents/agent-utils');
        const latest = getLatestData();
        const regimeState = getState('regime-classifier');
        const streakState = getState('fii-streak');

        let dynamicDesc = "Live FII/DII flow tracker.";
        if (latest && regimeState && streakState) {
            const fmtCr = val => ((val || 0) >= 0 ? '+' : '-') + '₹' + Math.abs(val || 0).toLocaleString('en-IN') + ' Cr';
            const fiiVal = fmtCr(latest.fii_net);
            const regime = regimeState.regime ? regimeState.regime.replace(/_/g, ' ') : 'NEUTRAL';
            
            let streakStr = "";
            if (streakState.current_sell_streak > 0) streakStr = ` | ${streakState.current_sell_streak}-Day FII Sell Streak 🔴`;
            else if (streakState.current_buy_streak > 0) streakStr = ` | ${streakState.current_buy_streak}-Day FII Buy Streak 🟢`;

            dynamicDesc = `Market Update: FII Net ${fiiVal} | Regime: ${regime}${streakStr}. Track live institutional money flow, F&O positioning, and sector data.`;
            
            // Limit length for meta tags just in case
            if (dynamicDesc.length > 200) dynamicDesc = dynamicDesc.substring(0, 197) + '...';
        }

        // Inject into HTML
        html = html.replace(
            /<meta property="og:description" content="[^"]+">/,
            `<meta property="og:description" content="${dynamicDesc}">`
        );
        html = html.replace(
            /<meta name="twitter:description" content="[^"]+">/,
            `<meta name="twitter:description" content="${dynamicDesc}">`
        );

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate'); // Stale-while-revalidate strategy
        res.send(html);
    } catch (err) {
        console.error('[SERVER] Dynamic index rendering failed:', err);
        return next(); // Fallback to express.static passing serving error
    }
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

// ── One-time .env Setup (secured by SETUP_KEY or Hostinger API token) ────────
// POST /api/setup-env — writes .env file to production, then self-disables.
// This endpoint works once per process start.
let _envSetupUsed = false;
app.post('/api/setup-env', express.json(), (req, res) => {
    // Auth: require a setup key in the Authorization header
    // The key is provided in the request and must match a pre-shared secret
    const authHeader = req.headers.authorization || '';
    const setupKey = authHeader.replace('Bearer ', '');
    const EXPECTED_KEY = process.env.SETUP_KEY;

    // SETUP_KEY must be explicitly configured — there is no fallback key.
    // (Set it via the hosting panel / shell before calling this endpoint.)
    if (!EXPECTED_KEY) {
        return res.status(403).json({ error: 'Setup disabled — SETUP_KEY env var is not configured on the server' });
    }
    if (setupKey !== EXPECTED_KEY) {
        return res.status(401).json({ error: 'Unauthorized — invalid setup key' });
    }

    // Only allow if .env is missing critical vars or this is first use
    if (_envSetupUsed) {
        return res.status(403).json({ error: 'Setup already completed. Delete .env manually to re-run.' });
    }

    const envVars = req.body;
    if (!envVars || typeof envVars !== 'object' || Object.keys(envVars).length === 0) {
        return res.status(400).json({ error: 'Request body must be a JSON object of {KEY: VALUE} pairs' });
    }

    // Reject keys/values that could inject extra lines or malformed entries into .env
    const invalid = Object.entries(envVars).find(([k, v]) =>
        !/^[A-Z][A-Z0-9_]*$/i.test(k) || typeof v !== 'string' || /[\r\n]/.test(v)
    );
    if (invalid) {
        return res.status(400).json({ error: `Invalid env entry: ${invalid[0]} (keys must be alphanumeric/underscore, values single-line strings)` });
    }

    try {
        // Build .env content
        const envContent = Object.entries(envVars)
            .map(([k, v]) => `${k}=${v}`)
            .join('\n') + '\n';

        // Write to project root (may be overwritten by deploys)
        const envPath = path.join(__dirname, '.env');
        fs.writeFileSync(envPath, envContent, 'utf8');

        // Also write to parent directory (survives Hostinger auto-deploys)
        try {
            const persistPath = path.join(__dirname, '..', '.env.fii-dii');
            fs.writeFileSync(persistPath, envContent, 'utf8');
            console.log(`[SETUP] Persistent .env written to ${persistPath}`);
        } catch (e) {
            console.warn('[SETUP] Could not write persistent .env:', e.message);
        }

        _envSetupUsed = true;

        // Hot-reload the env vars into the running process
        Object.entries(envVars).forEach(([k, v]) => { process.env[k] = v; });

        console.log(`[SETUP] .env written with ${Object.keys(envVars).length} variables. Restart recommended.`);
        res.json({
            ok: true,
            message: `.env written with ${Object.keys(envVars).length} variables. Restart the server to apply all changes.`,
            keys_written: Object.keys(envVars),
            restart_required: true
        });
    } catch (err) {
        console.error('[SETUP] Failed to write .env:', err.message);
        res.status(500).json({ error: 'Failed to write .env: ' + err.message });
    }
});

// Dashboard handled dynamically above

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

// Push notification subscription (with categories)
app.post('/api/subscribe', (req, res) => {
    try {
        const { subscription, categories } = req.body;
        // Support both new format { subscription, categories } and legacy format (flat sub object)
        const sub = subscription || req.body;
        if (!sub || !sub.endpoint) return res.status(400).json({ error: 'Invalid subscription' });
        const cats = Array.isArray(categories) ? categories.filter(c => ALL_ALERT_CATEGORIES.includes(c)) : [...ALL_ALERT_CATEGORIES];
        const subs = loadSubscriptions();
        const existingIdx = subs.findIndex(s => s.endpoint === sub.endpoint);
        if (existingIdx >= 0) {
            // Update categories for existing subscriber
            subs[existingIdx].categories = cats;
            saveSubscriptions(subs);
            console.log(`[PUSH] Updated subscriber categories: [${cats.join(', ')}]`);
        } else {
            subs.push({ endpoint: sub.endpoint, expirationTime: sub.expirationTime || null, keys: sub.keys, categories: cats });
            saveSubscriptions(subs);
            console.log(`[PUSH] New subscriber (total: ${subs.length}), categories: [${cats.join(', ')}]`);
        }
        res.json({ success: true, message: 'Subscribed to push notifications', categories: cats });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update alert preferences for existing subscriber
app.post('/api/subscribe-preferences', (req, res) => {
    try {
        const { endpoint, categories } = req.body;
        if (!endpoint) return res.status(400).json({ error: 'Missing endpoint' });
        if (!Array.isArray(categories)) return res.status(400).json({ error: 'Categories must be an array' });
        const cats = categories.filter(c => ALL_ALERT_CATEGORIES.includes(c));
        const subs = loadSubscriptions();
        const sub = subs.find(s => s.endpoint === endpoint);
        if (!sub) return res.status(404).json({ error: 'Subscription not found' });
        sub.categories = cats;
        saveSubscriptions(subs);
        console.log(`[PUSH] Updated preferences for subscriber: [${cats.join(', ')}]`);
        res.json({ success: true, categories: cats });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get alert preferences for a subscriber
app.post('/api/subscribe-status', (req, res) => {
    try {
        const { endpoint } = req.body;
        if (!endpoint) return res.status(400).json({ error: 'Missing endpoint' });
        const subs = loadSubscriptions();
        const sub = subs.find(s => s.endpoint === endpoint);
        if (!sub) return res.json({ subscribed: false, categories: [] });
        res.json({ subscribed: true, categories: sub.categories || [...ALL_ALERT_CATEGORIES] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Push notification unsubscribe
app.post('/api/unsubscribe', (req, res) => {
    try {
        const { endpoint } = req.body;
        if (!endpoint) return res.status(400).json({ error: 'Missing endpoint' });
        const subs = loadSubscriptions().filter(s => s.endpoint !== endpoint);
        saveSubscriptions(subs);
        res.json({ success: true, message: 'Unsubscribed' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Manual trigger — cooldown prevents anonymous callers from hammering NSE
// (the frontend treats a non-OK response as "already fresh" and reads /api/data)
let _lastRefreshAt = 0;
const REFRESH_COOLDOWN_MS = 30 * 1000;
app.post('/api/refresh', async (req, res) => {
    try {
        const now = Date.now();
        if (now - _lastRefreshAt < REFRESH_COOLDOWN_MS) {
            return res.status(429).json({ success: false, error: 'Refresh cooldown active — try again shortly' });
        }
        _lastRefreshAt = now;
        const data = await fetchAndProcessData();
        // Send category-specific push notifications if new data arrived
        if (data && !data._skipped) {
            _synthCache = { text: null, ts: 0 }; // new data → regenerate AI synthesis
            // Respond first, then run agents + notifications in the background
            // (agents must run before the broadcast so messages use today's state)
            (async () => {
                if (agentRunner) {
                    try { await agentRunner.runAllPostMarket(); }
                    catch (err) { console.error('[API] Agent run failed:', err.message); }
                }
                sendDataNotifications(data);
            })();
        }
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── Category-specific notification builder ───────────────────────────────────
// Dedupe is PERSISTED to disk so a category alerts exactly once per trading date,
// even though the fetch pipeline runs every ~15 min (cash lands first, F&O later),
// /api/refresh is publicly callable, and the process restarts on every deploy.
const NOTIFY_LOG_PATH = path.join(__dirname, 'data', 'notify_log.json');
function _loadNotifyLog() {
    try { return JSON.parse(fs.readFileSync(NOTIFY_LOG_PATH, 'utf8')); } catch { return {}; }
}
function alreadyNotified(date, category) {
    const log = _loadNotifyLog();
    return !!(log[date] && log[date][category]);
}
function markNotified(date, category) {
    const log = _loadNotifyLog();
    if (!log[date]) log[date] = {};
    log[date][category] = new Date().toISOString();
    // Prune to the 40 most-recent dates (by latest timestamp in each entry)
    const dates = Object.keys(log);
    if (dates.length > 40) {
        dates.sort((a, b) => {
            const ta = Math.max(...Object.values(log[a]).map(t => Date.parse(t) || 0));
            const tb = Math.max(...Object.values(log[b]).map(t => Date.parse(t) || 0));
            return tb - ta;
        });
        const pruned = {};
        dates.slice(0, 40).forEach(d => { pruned[d] = log[d]; });
        Object.keys(log).forEach(k => delete log[k]);
        Object.assign(log, pruned);
    }
    try {
        const tmp = NOTIFY_LOG_PATH + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(log, null, 2), 'utf8');
        fs.renameSync(tmp, NOTIFY_LOG_PATH);
    } catch (e) { console.warn('[NOTIFY] Could not persist notify log:', e.message); }
}
function _faoPresent(data) {
    return (data.fii_idx_fut_long || 0) !== 0 || (data.fii_idx_fut_short || 0) !== 0 || (data.pcr || 0) > 0;
}

function sendDataNotifications(data) {
    const fmtCr = (v) => `${v >= 0 ? '+' : '-'}₹${Math.abs(v).toLocaleString('en-IN')} Cr`;
    const fmtContracts = (v) => `${v >= 0 ? '+' : ''}${(v / 1000).toFixed(0)}K`;

    // 1. Cash flow notification — once per date
    const sendCash = !alreadyNotified(data.date, 'cash');
    if (sendCash) {
        markNotified(data.date, 'cash');
        broadcastNotification({
            title: '📊 Institutional Cash Flows',
            body: `${data.date} — FII: ${fmtCr(data.fii_net)} | DII: ${fmtCr(data.dii_net)}`,
            url: '/#t-hero'
        }, 'cash');
    }

    // 2. F&O sentiment notification — once per date, ONLY when F&O is genuinely
    //    present (it publishes later than cash; an all-zeros row must not consume
    //    the alert before the real data arrives)
    const sendFao = _faoPresent(data) && !alreadyNotified(data.date, 'fao');
    if (sendFao) {
        markNotified(data.date, 'fao');
        const summary = data._fao_summary || {};
        const sentiment = summary.sentiment || (data.sentiment_score > 60 ? 'Bullish' : data.sentiment_score < 40 ? 'Bearish' : 'Neutral');
        const pcr = summary.pcr || data.pcr || 0;
        const futNet = summary.fii_fut_net || data.fii_idx_fut_net || 0;
        broadcastNotification({
            title: `📈 F&O Sentiment: ${sentiment}`,
            body: `PCR: ${pcr} | FII Index Futures Net: ${fmtContracts(futNet)} contracts | ${data.date}`,
            url: '/#t-fno'
        }, 'fao');
    }

}
// Status
app.get('/api/status', async (req, res) => {
    try {
        const logs = getFetchLogs(5);
        res.json({ status: 'ok', serverTime: new Date().toISOString(), recentLogs: logs });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Yahoo Finance proxy — NIFTY 50, SENSEX & INDIA VIX.
// Cached for 10s (shared by all visitors) so live polling stays fast; each
// ticker is fetched independently and falls back to its last good quote.
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
app.get('/api/market', async (req, res) => {
    try {
        if (_marketCache.data && Date.now() - _marketCache.ts < MARKET_TTL_MS) {
            res.set('Cache-Control', 'public, max-age=5');
            return res.json(_marketCache.data);
        }
        if (!_marketCache.inflight) {
            _marketCache.inflight = refreshMarket().finally(() => { _marketCache.inflight = null; });
        }
        const data = await _marketCache.inflight;
        res.set('Cache-Control', 'public, max-age=5');
        res.json(data);
    } catch (err) {
        if (_marketCache.data) return res.json({ ..._marketCache.data, stale: true });
        res.status(500).json({ error: err.message });
    }
});

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
        const p = path.join(__dirname, 'data', 'fpi_daily.json');
        if (!fs.existsSync(p)) return res.status(404).json({ error: 'NSDL daily data not yet fetched' });
        res.json(JSON.parse(fs.readFileSync(p, 'utf8')));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Persisted daily market closes (Nifty + India VIX), appended post-market
app.get('/api/market-history', (req, res) => {
    try {
        const p = path.join(__dirname, 'data', 'market_history.json');
        res.json(fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

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
        const p = path.join(__dirname, 'data', 'market_history.json');
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

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', ts: new Date().toISOString(), uptime: process.uptime(), memory: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB', sseClients: sseClients.size });
});

// ── SSE Stream Endpoint ──────────────────────────────────────────────────────
app.get('/api/stream', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'  // Disable buffering in reverse proxies
    });
    res.write(`data: ${JSON.stringify({ type: 'connected', ts: new Date().toISOString() })}\n\n`);
    sseClients.add(res);
    const heartbeat = setInterval(() => {
        try { res.write(`: heartbeat\n\n`); } catch { clearInterval(heartbeat); sseClients.delete(res); }
    }, 25000); // 25s heartbeat to keep Apache proxy alive
    req.on('close', () => { clearInterval(heartbeat); sseClients.delete(res); });
});

// ── Agent API Endpoints ──────────────────────────────────────────────────────

// Real-Time LLM Synthesis (Groq AI Agent) — with 5-min cache
app.get('/api/agents/synthesis', async (req, res) => {
    try {
        // Return cached if fresh
        if (_synthCache.text && (Date.now() - _synthCache.ts) < SYNTH_TTL) {
            return res.json({ success: true, synthesis: _synthCache.text, cached: true, cached_at: new Date(_synthCache.ts).toISOString() });
        }

        const groqKey = process.env.GROQ_API_KEY;
        if (!groqKey) return res.status(503).json({ error: 'Groq API key not configured' });
        
        const { getAllStates } = require('./agents/agent-utils');
        const states = getAllStates();
        const latestData = getLatestData();
        const prevData = getHistoryData(2)[1] || null;
        const sectorData = getSectorData();
        
        // Top 3 sectors by AUM (sectors.json items: { name, aumPct, ... })
        const topSectors = Array.isArray(sectorData) && sectorData.length
            ? sectorData.slice(0, 3).map(s => `${s.name}: ${s.aumPct?.toFixed(1)}%`).join(', ')
            : 'N/A';
        const fiiNet = latestData?.fii_net || 0;
        const diiNet = latestData?.dii_net || 0;
        const date = latestData?.date || 'N/A';

        const systemPrompt = `You write the daily flow summary for 'Mr. Chartist — FII & DII Data', a dashboard of Indian institutional flow data.

Rules: describe what the published data shows and how it changed. Do NOT give buy, sell or hold advice, position-sizing or hedging suggestions, price targets or predictions, and do not address the reader as 'you'.

Your output format is EXACTLY:
Line 1: A bold, punchy 8-12 word headline (no markdown, no asterisks, just raw text).
Line 2: Empty line.
Lines 3-6: A tight 2-3 sentence institutional analysis paragraph. Neutral, factual analyst tone. No fluff, no greetings. Reference specific numbers. LEAD with what CHANGED versus the previous session (acceleration, reversal, divergence) — readers already know the static picture.

Data State (${date}):
- FII Net: ${fiiNet >= 0 ? '+' : ''}${fiiNet} Cr | DII Net: ${diiNet >= 0 ? '+' : ''}${diiNet} Cr
- Previous Session (${prevData?.date || 'N/A'}): FII ${prevData ? (prevData.fii_net >= 0 ? '+' : '') + prevData.fii_net : 'N/A'} Cr | DII ${prevData ? (prevData.dii_net >= 0 ? '+' : '') + prevData.dii_net : 'N/A'} Cr
- Combined Net: ${(fiiNet + diiNet) >= 0 ? '+' : '-'}${Math.abs(fiiNet + diiNet).toFixed(2)} Cr
- Regime: ${states['regime-classifier']?.regime || 'NEUTRAL'} (VIX: ${states['regime-classifier']?.vix || 'N/A'})
- FII Sell Streak: ${states['fii-streak']?.current_sell_streak || 0} days | Buy Streak: ${states['fii-streak']?.current_buy_streak || 0} days
- Flow Strength: ${states['flow-strength']?.flow_label || 'N/A'}
- Sector Rotation: ${states['sector-rotation']?.last_alert_summary || 'None detected'}
- Divergence Signal: ${states['flow-divergence']?.divergence_type || 'None'}
- Top Sectors: ${topSectors}`;

        const payload = {
            model: "llama-3.1-8b-instant",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: "Generate the institutional briefing now." }
            ],
            temperature: 0.4,
            max_tokens: 300
        };

        const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', payload, {
            headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
            timeout: 10000
        });

        const synthesis = response.data.choices[0].message.content;
        _synthCache = { text: synthesis, ts: Date.now() };
        res.json({ success: true, synthesis, cached: false });

    } catch (err) {
        console.error('[GROQ] Synthesis failed:', err.response?.data || err.message);
        // Return stale cache if available
        if (_synthCache.text) return res.json({ success: true, synthesis: _synthCache.text, cached: true, stale: true });
        res.status(500).json({ error: 'Failed to generate synthesis' });
    }
});


// Current regime classification (consumed by all ecosystem agents)
app.get('/api/agents/regime', (req, res) => {
    try {
        if (!agentRunner) return res.status(503).json({ error: 'Agent system not available' });
        const { getState } = require('./agents/agent-utils');
        const state = getState('regime-classifier');
        if (!state.regime) {
            return res.json({
                regime: 'NEUTRAL',
                since: null,
                fii_streak: 0,
                dii_absorption_pct: 0,
                vix: 0,
                recommendation: 'No regime data yet — agents have not run'
            });
        }
        res.json({
            regime: state.regime,
            since: state.since || null,
            fii_streak: state.fii_streak || 0,
            dii_absorption_pct: state.dii_absorption_pct || 0,
            vix: state.vix || 0,
            recommendation: require('./agents/agent-utils').regimeNote(state.regime),
            fii_cumulative_10d: state.fii_cumulative_10d || 0,
            dii_cumulative_10d: state.dii_cumulative_10d || 0,
            last_updated: state._updated_at || null
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Active FII/DII streaks
app.get('/api/agents/streaks', (req, res) => {
    try {
        if (!agentRunner) return res.status(503).json({ error: 'Agent system not available' });
        const { getState } = require('./agents/agent-utils');
        const state = getState('fii-streak');
        res.json({
            fii_sell_streak: state.current_sell_streak || 0,
            fii_buy_streak: state.current_buy_streak || 0,
            sell_cumulative: state.sell_cumulative || 0,
            buy_cumulative: state.buy_cumulative || 0,
            sell_absorption_pct: state.sell_absorption_pct || 0,
            buy_absorption_pct: state.buy_absorption_pct || 0,
            last_run_date: state.last_run_date || null,
            last_updated: state._updated_at || null
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// All agent statuses
app.get('/api/agents/status', (req, res) => {
    try {
        if (!agentRunner) return res.status(503).json({ error: 'Agent system not available' });
        const { getAllStates, getRunHistory } = require('./agents/agent-utils');
        const states = getAllStates();
        const recentRuns = getRunHistory(20);

        // Build agent summary
        const agents = Object.entries(agentRunner.AGENTS).map(([name, def]) => {
            const state = states[name] || {};
            const lastRun = recentRuns.find(r => r.agent === name);
            return {
                name,
                group: def.group,
                state,
                last_run: lastRun ? {
                    run_at: lastRun.run_at,
                    status: lastRun.status,
                    alerts_sent: lastRun.alerts_sent,
                    duration_ms: lastRun.duration_ms
                } : null
            };
        });

        res.json({
            agents,
            total_agents: agents.length,
            server_time: new Date().toISOString()
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Agent execution history
app.get('/api/agents/runs', (req, res) => {
    try {
        if (!agentRunner) return res.status(503).json({ error: 'Agent system not available' });
        const { getRunHistory } = require('./agents/agent-utils');
        const limit = Math.max(1, Math.min(parseInt(req.query.limit) || 50, 200));
        const agent = req.query.agent || null;
        const runs = getRunHistory(limit, agent);
        res.json({ runs, count: runs.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Flow strength state (extreme event detection)
app.get('/api/agents/flow-strength', (req, res) => {
    try {
        if (!agentRunner) return res.status(503).json({ error: 'Agent system not available' });
        const { getState } = require('./agents/agent-utils');
        const state = getState('flow-strength');
        res.json({
            last_alerted_date: state.last_alerted_date || null,
            last_alerted_events: state.last_alerted_events || [],
            events_checked: state.events_checked || 0,
            events_triggered: state.events_triggered || 0,
            latest_fii_net: state.latest_fii_net || 0,
            latest_dii_net: state.latest_dii_net || 0,
            last_run_date: state.last_run_date || null,
            last_updated: state._updated_at || null
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Flow divergence state (contrarian/panic/euphoria signals)
app.get('/api/agents/flow-divergence', (req, res) => {
    try {
        if (!agentRunner) return res.status(503).json({ error: 'Agent system not available' });
        const { getState } = require('./agents/agent-utils');
        const state = getState('flow-divergence');
        res.json({
            signal: state.last_signal || 'NONE',
            signal_date: state.last_signal_date || null,
            today_divergence: state.today_divergence || 0,
            divergence_percentile: state.divergence_percentile || 0,
            absorption_pct: state.absorption_pct || 0,
            avg_fii_30d: state.avg_fii_30d || 0,
            avg_dii_30d: state.avg_dii_30d || 0,
            last_run_date: state.last_run_date || null,
            last_updated: state._updated_at || null
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Sector rotation state
app.get('/api/agents/sector-rotation', (req, res) => {
    try {
        if (!agentRunner) return res.status(503).json({ error: 'Agent system not available' });
        const { getState } = require('./agents/agent-utils');
        const state = getState('sector-rotation');
        res.json({
            total_sectors: state.total_sectors || 0,
            significant_moves: state.significant_moves || 0,
            sustained_exits: state.sustained_exits || [],
            sustained_entries: state.sustained_entries || [],
            top_inflow: state.top_inflow || null,
            top_outflow: state.top_outflow || null,
            last_run_date: state.last_run_date || null,
            last_updated: state._updated_at || null
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Weekly digest state
app.get('/api/agents/weekly-digest', (req, res) => {
    try {
        if (!agentRunner) return res.status(503).json({ error: 'Agent system not available' });
        const { getState } = require('./agents/agent-utils');
        const state = getState('weekly-digest');
        res.json({
            last_digest_date: state.last_digest_date || null,
            weekly_fii: state.weekly_fii || 0,
            weekly_dii: state.weekly_dii || 0,
            trading_days: state.trading_days || 0,
            date_range: state.date_range || null,
            last_updated: state._updated_at || null
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Manual agent execution — trigger a single agent
app.post('/api/agents/run/:agent', async (req, res) => {
    try {
        if (!agentRunner) return res.status(503).json({ error: 'Agent system not available' });
        const agentName = req.params.agent;
        if (!Object.prototype.hasOwnProperty.call(agentRunner.AGENTS, agentName)) {
            return res.status(404).json({ error: `Unknown agent: ${agentName}`, available: Object.keys(agentRunner.AGENTS) });
        }
        // Return immediately, run in background
        res.json({ accepted: true, agent: agentName, message: `Agent "${agentName}" triggered` });
        agentRunner.runAgent(agentName).catch(err =>
            console.error(`[API] Manual agent run failed (${agentName}):`, err.message)
        );
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Manual execution — trigger all agents
app.post('/api/agents/run-all', async (req, res) => {
    try {
        if (!agentRunner) return res.status(503).json({ error: 'Agent system not available' });
        res.json({ accepted: true, message: 'All agent groups triggered', groups: ['post-market', 'sector', 'weekly'] });
        // Run all groups in background
        (async () => {
            try {
                await agentRunner.runAllPostMarket();
                await agentRunner.runSectorAgents();
                await agentRunner.runWeeklyDigest();
            } catch (err) {
                console.error('[API] Manual run-all failed:', err.message);
            }
        })();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API documentation — self-documenting manifest
app.get('/api/agents/docs', (req, res) => {
    const docs = {
        title: 'FII & DII Data — Agent API',
        version: '2.0.0',
        description: 'Autonomous institutional flow intelligence agents by Mr. Chartist',
        base_url: `${req.protocol}://${req.get('host')}`,
        agents: Object.entries(agentRunner ? agentRunner.AGENTS : {}).map(([name, def]) => ({
            name,
            group: def.group,
            // Only agents with a dedicated GET route get a state_endpoint
            state_endpoint: ({
                'fii-streak': '/api/agents/streaks',
                'regime-classifier': '/api/agents/regime',
                'flow-strength': '/api/agents/flow-strength',
                'flow-divergence': '/api/agents/flow-divergence',
                'sector-rotation': '/api/agents/sector-rotation',
                'weekly-digest': '/api/agents/weekly-digest'
            })[name] || null,
            description: {
                'fii-streak': 'Detects sustained FII selling/buying pressure (≥5 consecutive days)',
                'regime-classifier': 'Classifies institutional environment into 5 regimes (Strong Bullish → Strong Bearish)',
                'flow-strength': 'Real-time alerts when daily flows hit extreme thresholds (₹5k+ Cr)',
                'sector-rotation': 'Detects FPI allocation rotation between 24 sectors via NSDL fortnightly data',
                'flow-divergence': 'Contrarian signals when FII/DII diverge to historical extremes',
                'weekly-digest': 'Automated end-of-week intelligence report summarizing institutional activity'
            }[name] || ''
        })),
        endpoints: [
            { method: 'GET', path: '/api/agents/status', description: 'All agent statuses and last run info' },
            { method: 'GET', path: '/api/agents/regime', description: 'Current regime classification (consumed by ecosystem agents)' },
            { method: 'GET', path: '/api/agents/streaks', description: 'Active FII/DII sell/buy streaks' },
            { method: 'GET', path: '/api/agents/flow-strength', description: 'Flow extreme event detection state' },
            { method: 'GET', path: '/api/agents/flow-divergence', description: 'Contrarian/panic/euphoria signal state' },
            { method: 'GET', path: '/api/agents/sector-rotation', description: 'Sector rotation summary' },
            { method: 'GET', path: '/api/agents/weekly-digest', description: 'Latest weekly digest state' },
            { method: 'GET', path: '/api/agents/runs', description: 'Agent execution history (query: ?limit=50&agent=name)' },
            { method: 'GET', path: '/api/agents/synthesis', description: 'Generate AI market synthesis via Groq LLM' },
            { method: 'POST', path: '/api/agents/run/:agent', description: 'Manually trigger a single agent by name' },
            { method: 'POST', path: '/api/agents/run-all', description: 'Trigger all agent groups (post-market + sector + weekly)' },
            { method: 'GET', path: '/api/agents/docs', description: 'This documentation endpoint' }
        ],
        data_endpoints: [
            { method: 'GET', path: '/api/data', description: 'Latest FII/DII snapshot' },
            { method: 'GET', path: '/api/history', description: 'Last 60 days of history' },
            { method: 'GET', path: '/api/history-full', description: 'Full 800-day history (compressed)' },
            { method: 'GET', path: '/api/sectors', description: '24-sector FPI allocation with trend data' },
            { method: 'GET', path: '/api/market', description: 'NIFTY 50, SENSEX & India VIX (Yahoo Finance proxy, 10s cache)' },
            { method: 'POST', path: '/api/refresh', description: 'Trigger manual NSE data fetch' }
        ]
    };
    res.json(docs);
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
                    const data = await fetchAndProcessData();
                    console.log(`[${new Date().toISOString()}] ${label} fetch completed.`);
                    // SSE: Push live update to all connected browsers
                    if (data && !data._skipped) {
                        sseBroadcast('data-update', { date: data.date, fii_net: data.fii_net, dii_net: data.dii_net, ts: new Date().toISOString() });
                    }
                    // Auto-broadcast category-specific notifications on new data
                    if (data && !data._skipped) {
                        _synthCache = { text: null, ts: 0 }; // new data → regenerate AI synthesis
                        persistMarketClose(data.date); // store Nifty+VIX close alongside the session
                        // Run post-market agents FIRST so the broadcast messages read
                        // today's streak/regime/divergence state, not yesterday's
                        if (agentRunner) {
                            try {
                                await agentRunner.runAllPostMarket();
                            } catch (err) {
                                console.error(`[${new Date().toISOString()}] Agent run failed:`, err.message);
                            }
                        }
                        sendDataNotifications(data);
                    }
                } catch (err) {
                    console.error(`[${new Date().toISOString()}] ${label} fetch failed:`, err.message);
                }
            }

            // ── NSDL Sector Data Fetch ────────────────────────────────────
            async function runNSDLFetch() {
                console.log(`[${new Date().toISOString()}] NSDL sector fetch starting…`);
                try {
                    // Read existing date_code before fetch — missing/corrupt file must
                    // not abort the fetch (it's what creates the file in the first place)
                    let oldCode = '';
                    try {
                        const oldSector = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'sector_latest.json'), 'utf8'));
                        oldCode = oldSector.date_code || '';
                    } catch { /* first run or unreadable file — treat as no previous data */ }

                    const result = await fetchAllNSDL();
                    console.log(`[${new Date().toISOString()}] NSDL sector fetch completed.`);

                    // Check if new sector data arrived
                    if (result && result.sectorData && result.sectorData.date_code !== oldCode) {
                        const sectors = result.sectorData.sectors || [];
                        // Find top inflow and outflow sectors
                        const sorted = [...sectors].sort((a, b) => b.equity_net_inr - a.equity_net_inr);
                        const topIn = sorted[0];
                        const topOut = sorted[sorted.length - 1];
                        const fmtCr = (v) => `${v >= 0 ? '+' : '-'}₹${Math.abs(v).toLocaleString('en-IN')} Cr`;

                        broadcastNotification({
                            title: '🏦 Sector Rotation Update',
                            body: `Top Inflow: ${topIn?.sector} (${fmtCr(topIn?.equity_net_inr || 0)}) | Top Outflow: ${topOut?.sector} (${fmtCr(topOut?.equity_net_inr || 0)}) | ${sectors.length} sectors updated`,
                            url: '/#t-sectors'
                        }, 'sectors');

                        // Run sector agents after successful NSDL fetch
                        if (agentRunner) {
                            agentRunner.runSectorAgents().catch(err =>
                                console.error(`[${new Date().toISOString()}] Sector agent run failed:`, err.message)
                            );
                        }
                    }
                } catch (err) {
                    console.error(`[${new Date().toISOString()}] NSDL fetch failed:`, err.message);
                }
            }

            // All cron expressions below are written in UTC — pin the timezone so
            // schedules don't silently shift if the server clock is set to IST.
            const CRON_OPTS = { timezone: 'Etc/UTC' };

            // NSE FII/DII data publishes after market close (~6-7 PM IST, sometimes delayed)
            // Run every 15 mins from 6:00 PM to 9:00 PM IST (12:30 UTC - 15:30 UTC)
            // Smart-skip in fetch_data.js ensures it stops processing once Cash + F&O are both acquired.
            const postMarketCrons = ['30,45 12 * * 1-5', '*/15 13-14 * * 1-5', '0,15,30 15 * * 1-5'];
            postMarketCrons.forEach(schedule => {
                cron.schedule(schedule, () => runFetchTask('Post-market'), CRON_OPTS);
            });

            // NSDL sector data — check daily at 10:00 AM IST (smart skip if unchanged)
            cron.schedule('30 4 * * 1-5', () => runNSDLFetch(), CRON_OPTS);  // 10:00 AM IST

            // F&O recovery — NSE sometimes publishes participant-OI after the
            // evening fetch window closes. Backfill any cash-only rows and fire
            // the (still-pending) F&O alert once. 10 PM IST + next-day 8 AM IST.
            async function runFaoRecovery(label) {
                try {
                    const filled = await backfillMissingFao();
                    if (!filled || !filled.length) return;
                    console.log(`[${new Date().toISOString()}] ${label} recovered F&O: ${filled.join(', ')}`);
                    const latest = getLatestData();
                    if (latest && filled.includes(latest.date) && !latest._skipped) {
                        sseBroadcast('data-update', { date: latest.date, fii_net: latest.fii_net, dii_net: latest.dii_net, ts: new Date().toISOString() });
                        sendDataNotifications(latest); // cash already deduped → only F&O fires
                    }
                } catch (err) {
                    console.error(`[${new Date().toISOString()}] ${label} F&O recovery failed:`, err.message);
                }
            }
            cron.schedule('30 16 * * 1-5', () => runFaoRecovery('Late-evening'), CRON_OPTS); // 10:00 PM IST
            cron.schedule('30 2 * * 2-6', () => runFaoRecovery('Next-morning'), CRON_OPTS);  // 08:00 AM IST (Tue–Sat)

            // Weekly institutional digest — Friday 8:00 PM IST
            if (agentRunner) {
                cron.schedule('30 14 * * 5', async () => {
                    console.log(`[${new Date().toISOString()}] Weekly digest starting…`);
                    try {
                        await agentRunner.runWeeklyDigest();
                    } catch (err) {
                        console.error(`[${new Date().toISOString()}] Weekly digest failed:`, err.message);
                    }
                }, CRON_OPTS);

                console.log('[BOOT] ✅ Cron jobs scheduled (6PM-9PM post-market + 10 AM NSDL + 8 PM Fri digest)');
            } else {
                console.log('[BOOT] ✅ Cron jobs scheduled (6PM-9PM post-market IST Mon-Fri + 10:00 AM NSDL)');
            }

        } catch (e) {
            console.error('[BOOT] Cron scheduling failed:', e.message);
        }
    } else {
        console.warn('[BOOT] ⚠ node-cron not available, skipping scheduler');
    }
});

module.exports = app;
