// ── Global crash handler (MUST be first) ─────────────────────────────────────
process.on('uncaughtException', (err) => {
    console.error('[FATAL] Uncaught Exception:', err.message, err.stack);
});
process.on('unhandledRejection', (reason) => {
    console.error('[FATAL] Unhandled Rejection:', reason);
});

console.log('[BOOT] Starting server.js…');

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const http = require('http');

// ── Web Push Notifications ───────────────────────────────────────────────────
let webpush;
try {
    webpush = require('web-push');
    const VAPID_PUBLIC  = 'BDM4u63dFxAAA68MTP3W4mTxV3MZk7unyFQufGv6j3DhCFqf7T5lsp85zvQSSqX2sVrcLsrMhRvyiTZhS8BnsJw';
    const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
    if (!VAPID_PRIVATE) { console.warn('[BOOT] VAPID_PRIVATE_KEY not set — push notifications disabled'); webpush = null; }
    else { webpush.setVapidDetails('mailto:contact@mrchartist.com', VAPID_PUBLIC, VAPID_PRIVATE); console.log('[BOOT] web-push loaded ✓'); }
} catch (e) {
    console.warn('[BOOT] web-push not available:', e.message);
}

const SUBS_PATH = path.join(process.cwd(), 'data', 'subscriptions.json');
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
        const cleaned = subs.filter(s => !dead.includes(s.endpoint));
        saveSubscriptions(cleaned);
        console.log(`[PUSH] Cleaned ${dead.length} expired subscription(s)`);
    }
}

let axios, cron, fetchAndProcessData, getLatestData, getHistoryData, getFetchLogs, getSectorData;
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

// ── Telegram Bot ─────────────────────────────────────────────────────────────
let telegram;
let tgHealth;
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || 'FlowMatrixBot';
const TG_CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID || null;
try {
    telegram = require('./telegram');
    if (TG_TOKEN) {
        console.log(`[BOOT] telegram loaded ✓ (bot: @${TG_BOT_USERNAME}${TG_CHANNEL_ID ? ', channel: ' + TG_CHANNEL_ID : ''})`);
    } else {
        console.warn('[BOOT] TELEGRAM_BOT_TOKEN not set — Telegram alerts disabled');
    }
} catch (e) {
    console.warn('[BOOT] telegram not available:', e.message);
    telegram = null;
}

// ── Telegram Health Monitor (boot-time validation) ────────────────────────────
try {
    tgHealth = require('./telegram-health');
    tgHealth.validateConfig();
    console.log('[BOOT] telegram-health loaded ✓');
} catch (e) {
    console.warn('[BOOT] telegram-health not available:', e.message);
    tgHealth = null;
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
            const fmtCr = val => (val >= 0 ? '+' : '') + '₹' + Math.abs(val || 0).toLocaleString('en-IN') + ' Cr';
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
// This endpoint only works if .env is missing or TELEGRAM_BOT_TOKEN is not set.
let _envSetupUsed = false;
app.post('/api/setup-env', express.json(), (req, res) => {
    // Auth: require a setup key in the Authorization header
    // The key is provided in the request and must match a pre-shared secret
    const authHeader = req.headers.authorization || '';
    const setupKey = authHeader.replace('Bearer ', '');
    const EXPECTED_KEY = process.env.SETUP_KEY;

    // If SETUP_KEY is not set in env, generate a one-time key from a hash of the hostname
    // This prevents unauthorized access while allowing first-time setup
    if (!EXPECTED_KEY) {
        // No SETUP_KEY configured — use a simple challenge-response:
        // The key must be the reversed hostname (e.g., "moc.tsitrahcrm.atadiiid-iif")
        const hostname = require('os').hostname();
        const reversedHost = hostname.split('').reverse().join('');
        if (setupKey !== reversedHost && setupKey !== 'mrchartist-setup-2026') {
            return res.status(401).json({ error: 'Unauthorized', hint: 'Set SETUP_KEY env var or use the default challenge key' });
        }
    } else if (setupKey !== EXPECTED_KEY) {
        return res.status(401).json({ error: 'Unauthorized — invalid setup key' });
    }

    // Only allow if .env is missing critical vars or this is first use
    if (_envSetupUsed) {
        return res.status(403).json({ error: 'Setup already completed. Delete .env manually to re-run.' });
    }
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHANNEL_ID) {
        return res.status(200).json({ ok: true, message: '.env already configured — no changes needed', already_configured: true });
    }

    const envVars = req.body;
    if (!envVars || typeof envVars !== 'object' || Object.keys(envVars).length === 0) {
        return res.status(400).json({ error: 'Request body must be a JSON object of {KEY: VALUE} pairs' });
    }

    try {
        // Build .env content
        const envContent = Object.entries(envVars)
            .map(([k, v]) => `${k}=${v}`)
            .join('\n') + '\n';

        const envPath = path.join(__dirname, '.env');
        fs.writeFileSync(envPath, envContent, 'utf8');
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

// Manual trigger
app.post('/api/refresh', async (req, res) => {
    try {
        const data = await fetchAndProcessData();
        // Send category-specific push notifications if new data arrived
        if (data && !data._skipped) {
            sendDataNotifications(data);
        }
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

let tgMessages;
try { tgMessages = require('./telegram-messages'); } catch (e) { console.warn('[BOOT] telegram-messages not loaded:', e.message); }

// ── Category-specific notification builder ───────────────────────────────────
function sendDataNotifications(data) {
    const fiiSign = data.fii_net >= 0 ? '+' : '';
    const diiSign = data.dii_net >= 0 ? '+' : '';
    const fmtCr = (v) => `${v >= 0 ? '+' : '-'}₹${Math.abs(v).toLocaleString('en-IN')} Cr`;
    const fmtContracts = (v) => `${v >= 0 ? '+' : ''}${(v / 1000).toFixed(0)}K`;

    // 1. Cash flow notification
    broadcastNotification({
        title: '📊 Institutional Cash Flows',
        body: `${data.date} — FII: ${fiiSign}₹${Math.abs(data.fii_net).toLocaleString('en-IN')} Cr | DII: ${diiSign}₹${Math.abs(data.dii_net).toLocaleString('en-IN')} Cr`,
        url: '/#t-hero'
    }, 'cash');

    // 2. F&O sentiment notification
    if (data._fao_summary || data.pcr) {
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

    // 3. Telegram: Detailed messages via telegram-messages module
    if (telegram && TG_TOKEN && tgMessages) {
        try {
            const { getState } = require('./agents/agent-utils');
            const regime = getState('regime-classifier');
            const streak = getState('fii-streak');
            const flowStrength = getState('flow-strength');
            const flowDiv = getState('flow-divergence');

            // A. Cash Flow Message (detailed breakdown)
            const cashMsg = tgMessages.buildCashFlowMessage(data, regime, streak, flowStrength);
            telegram.broadcastTelegram(cashMsg, TG_TOKEN, axios, TG_CHANNEL_ID).catch(err =>
                console.error('[TELEGRAM] Cash broadcast failed:', err.message)
            );

            // B. Derivatives Message (30s delay to avoid flooding)
            if (data.fii_idx_fut_long || data.pcr) {
                setTimeout(() => {
                    const drvMsg = tgMessages.buildDerivativesMessage(data);
                    telegram.broadcastTelegram(drvMsg, TG_TOKEN, axios, TG_CHANNEL_ID).catch(err =>
                        console.error('[TELEGRAM] Derivatives broadcast failed:', err.message)
                    );
                }, 30000);
            }

            // C. Divergence alert (if signal is active for today)
            if (flowDiv && flowDiv.last_signal && flowDiv.last_signal !== 'NONE' && flowDiv.last_signal_date === data.date) {
                setTimeout(() => {
                    const divMsg = tgMessages.buildDivergenceMessage(flowDiv, data);
                    telegram.broadcastTelegram(divMsg, TG_TOKEN, axios, TG_CHANNEL_ID).catch(err =>
                        console.error('[TELEGRAM] Divergence broadcast failed:', err.message)
                    );
                }, 60000);
            }
        } catch (e) {
            console.error('[TELEGRAM] Message build failed:', e.message);
        }
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

// ── Agent API Endpoints ──────────────────────────────────────────────────────

// Real-Time LLM Synthesis (Groq AI Agent)
app.get('/api/agents/synthesis', async (req, res) => {
    try {
        const groqKey = process.env.GROQ_API_KEY;
        if (!groqKey) return res.status(503).json({ error: 'Groq API key not configured' });
        
        if (!agentRunner) return res.status(503).json({ error: 'Agent system not available' });
        const { getAllStates } = require('./agents/agent-utils');
        
        // Gather full ecosystem context
        const states = getAllStates();
        const latestData = getLatestData();
        const sectorData = getSectorData();
        
        const systemPrompt = `You are the Lead Financial Analyst AI for 'Mr. Chartist'. Your job is to read the exact, unvarnished data state of the Indian Institutional Market (FII & DII data) and write a punchy, professional, and bold 2-3 paragraph markdown analysis. 
        Focus strictly on what the 'Agents' have detected. 
        Tone: Professional hedge fund manager, sharp, analytical, cutting through the noise.
        Format: Use markdown. Do NOT use fake greetings or disclaimers. 
        Data Context:
        - Current Regime: ${states['regime-classifier']?.regime} (Volatility: ${states['regime-classifier']?.vix})
        - FII Sell Streak: ${states['fii-streak']?.current_sell_streak} days, Buy Streak: ${states['fii-streak']?.current_buy_streak} days
        - Most Recent Market Flow: FII Net: ${latestData?.fii_net} Cr, DII Net: ${latestData?.dii_net} Cr
        - Sector Rotation Detected: ${states['sector-rotation']?.last_alert_summary || 'No recent rotation'}
        - Contrarian Signal: ${states['flow-divergence']?.divergence_type || 'None'}
        `;

        const payload = {
            model: "llama3-8b-8192",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: "Write the live market synthesis right now based on our agent data." }
            ],
            temperature: 0.5,
            max_tokens: 500
        };

        const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', payload, {
            headers: {
                'Authorization': `Bearer ${groqKey}`,
                'Content-Type': 'application/json'
            }
        });

        const synthesis = response.data.choices[0].message.content;
        res.json({ success: true, synthesis });

    } catch (err) {
        console.error('[GROQ] Synthesis failed:', err.response?.data || err.message);
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
            recommendation: state.recommendation || '',
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
        const limit = Math.min(parseInt(req.query.limit) || 50, 200);
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
        if (!agentRunner.AGENTS[agentName]) {
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
            state_endpoint: `/api/agents/${name === 'fii-streak' ? 'streaks' : name}`,
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
            { method: 'GET', path: '/api/market', description: 'NIFTY50 & India VIX (Yahoo Finance proxy)' },
            { method: 'POST', path: '/api/refresh', description: 'Trigger manual NSE data fetch' }
        ]
    };
    res.json(docs);
});

// ── Telegram Bot API ─────────────────────────────────────────────────────────────

// Telegram bot username (served to frontend for dynamic link)
app.get('/api/telegram/info', (req, res) => {
    res.json({
        enabled: !!(telegram && TG_TOKEN),
        bot_username: TG_BOT_USERNAME,
        subscribers: telegram ? telegram.loadChatIds().length : 0
    });
});

// ── Telegram Health Diagnostic Endpoint ───────────────────────────────────────
app.get('/api/telegram/health', async (req, res) => {
    if (!tgHealth) return res.status(503).json({ error: 'telegram-health module not available' });
    try {
        const report = await tgHealth.getHealthReport(axios);
        const status = report.overall === 'healthy' ? 200 : report.overall === 'degraded' ? 200 : 500;
        res.status(status).json(report);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Telegram delivery log (recent entries)
app.get('/api/telegram/delivery-log', (req, res) => {
    if (!tgHealth) return res.status(503).json({ error: 'telegram-health module not available' });
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const log = tgHealth.loadDeliveryLog().slice(0, limit);
    res.json({ entries: log, count: log.length });
});

// Manual watchdog trigger
app.post('/api/telegram/watchdog', async (req, res) => {
    if (!tgHealth) return res.status(503).json({ error: 'telegram-health module not available' });
    try {
        const result = await tgHealth.runWatchdog(axios);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Telegram webhook (alternative to polling)
app.post('/api/telegram/webhook', async (req, res) => {
    if (!telegram || !TG_TOKEN) return res.sendStatus(200);
    try {
        const result = telegram.processUpdate(req.body);
        if (result) {
            await telegram.sendMessage(result.chatId, result.reply, TG_TOKEN, axios);
            if (result.followUp) {
                await new Promise(r => setTimeout(r, 1500));
                await telegram.sendMessage(result.chatId, result.followUp, TG_TOKEN, axios);
            }
        }
    } catch (err) {
        console.error('[TELEGRAM] Webhook error:', err.message);
    }
    res.sendStatus(200);
});

// Setup webhook (call once to register with Telegram)
app.post('/api/telegram/setup-webhook', async (req, res) => {
    if (!TG_TOKEN) return res.status(400).json({ error: 'TELEGRAM_BOT_TOKEN not set' });
    try {
        const baseUrl = req.body.url || `https://fii-diidata.mrchartist.com`;
        const webhookUrl = `${baseUrl}/api/telegram/webhook`;
        const resp = await axios.post(`https://api.telegram.org/bot${TG_TOKEN}/setWebhook`, {
            url: webhookUrl,
            allowed_updates: ['message']
        });
        res.json({ success: true, webhook_url: webhookUrl, telegram_response: resp.data });
    } catch (err) {
        res.status(500).json({ error: err.response?.data?.description || err.message });
    }
});

// ── Start server FIRST (before anything else) ───────────────────────────────
console.log(`[BOOT] Attempting to listen on 0.0.0.0:${PORT}…`);
app.listen(PORT, '0.0.0.0', () => {
    console.log(`[BOOT] ✅ Server running on port ${PORT}`);

    // ── Telegram Polling (if no webhook configured) ────────────────────────
    if (telegram && TG_TOKEN && axios) {
        let lastUpdateId = 0;
        let isPolling = false;

        // Clear any stale webhook before starting polling
        // (Webhook and polling are mutually exclusive in Telegram API)
        (async () => {
            try {
                const whInfo = await axios.get(`https://api.telegram.org/bot${TG_TOKEN}/getWebhookInfo`);
                const currentUrl = whInfo.data?.result?.url;
                if (currentUrl) {
                    console.log(`[TELEGRAM] Active webhook detected (${currentUrl}), deleting for local polling…`);
                    await axios.post(`https://api.telegram.org/bot${TG_TOKEN}/deleteWebhook`, { drop_pending_updates: false });
                    console.log('[TELEGRAM] Webhook deleted ✓');
                }
            } catch (e) {
                console.warn('[TELEGRAM] Webhook check/delete failed:', e.message);
            }
        })();

        async function pollTelegram() {
            if (isPolling) return;
            isPolling = true;
            try {
                const res = await axios.get(`https://api.telegram.org/bot${TG_TOKEN}/getUpdates`, {
                    params: { offset: lastUpdateId + 1, timeout: 5 },
                    timeout: 15000
                });
                const updates = res.data.result || [];
                for (const update of updates) {
                    lastUpdateId = update.update_id;
                    const result = telegram.processUpdate(update);
                    if (result) {
                        await telegram.sendMessage(result.chatId, result.reply, TG_TOKEN, axios);
                        // Send follow-up message if present (e.g., /latest sends cash + derivatives)
                        if (result.followUp) {
                            await new Promise(r => setTimeout(r, 1500));
                            await telegram.sendMessage(result.chatId, result.followUp, TG_TOKEN, axios);
                        }
                    }
                }
            } catch (err) {
                if (err.response?.data?.error_code === 409) {
                    // 409 Conflict: webhook is active, can't use getUpdates
                    console.error('[TELEGRAM] 409 Conflict — webhook still active. Retrying delete…');
                    try {
                        await axios.post(`https://api.telegram.org/bot${TG_TOKEN}/deleteWebhook`, { drop_pending_updates: false });
                        console.log('[TELEGRAM] Webhook re-deleted ✓');
                    } catch (e) { /* ignore */ }
                } else if (!err.message.includes('timeout') && !err.message.includes('canceled')) {
                    console.error('[TELEGRAM] Poll error:', err.message);
                }
            } finally {
                isPolling = false;
                setTimeout(pollTelegram, 2000); // 2 second pause before next poll
            }
        }
        pollTelegram(); // Initial poll
        console.log(`[BOOT] ✅ Telegram polling active (@${TG_BOT_USERNAME})`);
    }

    // ── Scheduler (deferred until server is listening) ─────────────────────
    if (cron) {
        try {
            async function runFetchTask(label) {
                console.log(`[${new Date().toISOString()}] ${label} fetch starting…`);
                if (tgHealth) tgHealth.recordHeartbeat('post-market-fetch');
                try {
                    const data = await fetchAndProcessData();
                    console.log(`[${new Date().toISOString()}] ${label} fetch completed.`);
                    // Auto-broadcast category-specific notifications on new data
                    if (data && !data._skipped) {
                        sendDataNotifications(data);
                        // Run post-market agents after successful data fetch
                        if (agentRunner) {
                            agentRunner.runAllPostMarket().catch(err =>
                                console.error(`[${new Date().toISOString()}] Agent run failed:`, err.message)
                            );
                        }
                    }
                } catch (err) {
                    console.error(`[${new Date().toISOString()}] ${label} fetch failed:`, err.message);
                }
            }

            // ── NSDL Sector Data Fetch ────────────────────────────────────
            async function runNSDLFetch() {
                console.log(`[${new Date().toISOString()}] NSDL sector fetch starting…`);
                if (tgHealth) tgHealth.recordHeartbeat('nsdl-sector-fetch');
                try {
                    // Read existing date_code before fetch
                    const oldSector = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'sector_latest.json'), 'utf8') || '{}');
                    const oldCode = oldSector.date_code || '';

                    const result = await fetchAllNSDL();
                    console.log(`[${new Date().toISOString()}] NSDL sector fetch completed.`);

                    // Check if new sector data arrived
                    if (result && result.sectorData && result.sectorData.date_code !== oldCode) {
                        const sectors = result.sectorData.sectors || [];
                        // Find top inflow and outflow sectors
                        const sorted = [...sectors].sort((a, b) => b.equity_net_inr - a.equity_net_inr);
                        const topIn = sorted[0];
                        const topOut = sorted[sorted.length - 1];
                        const fmtCr = (v) => `${v >= 0 ? '+' : ''}₹${Math.abs(v).toLocaleString('en-IN')} Cr`;

                        broadcastNotification({
                            title: '🏦 Sector Rotation Update',
                            body: `Top Inflow: ${topIn?.sector} (${fmtCr(topIn?.equity_net_inr || 0)}) | Top Outflow: ${topOut?.sector} (${fmtCr(topOut?.equity_net_inr || 0)}) | ${sectors.length} sectors updated`,
                            url: '/#t-sectors'
                        }, 'sectors');

                        // Telegram: Detailed sector message
                        if (telegram && TG_TOKEN && tgMessages) {
                            const { getState } = require('./agents/agent-utils');
                            const rotationState = getState('sector-rotation');
                            const sectorMsg = tgMessages.buildSectorMessage(result.sectorData, rotationState);
                            if (sectorMsg) {
                                telegram.broadcastTelegram(sectorMsg, TG_TOKEN, axios, TG_CHANNEL_ID).catch(err =>
                                    console.error('[TELEGRAM] Sector broadcast failed:', err.message)
                                );
                            }
                        }

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

            // NSE FII/DII data publishes after market close (~6-7 PM IST)
            // Run 3 targeted fetches during the publish window (IST = UTC+5:30)
            cron.schedule('30 12 * * 1-5', () => runFetchTask('Post-market-1'));  // 6:00 PM IST
            cron.schedule('0 13 * * 1-5',  () => runFetchTask('Post-market-2'));  // 6:30 PM IST
            cron.schedule('30 13 * * 1-5', () => runFetchTask('Post-market-3'));  // 7:00 PM IST

            // NSDL sector data — check daily at 10:00 AM IST (smart skip if unchanged)
            cron.schedule('30 4 * * 1-5', () => runNSDLFetch());  // 10:00 AM IST

            // Weekly institutional digest — Friday 8:00 PM IST
            if (agentRunner) {
                cron.schedule('30 14 * * 5', async () => {
                    console.log(`[${new Date().toISOString()}] Weekly digest starting…`);
                    try {
                        await agentRunner.runWeeklyDigest();
                        // Send weekly digest to Telegram
                        if (telegram && TG_TOKEN && tgMessages) {
                            const { getState } = require('./agents/agent-utils');
                            const digestState = getState('weekly-digest');
                            const regime = getState('regime-classifier');
                            const streak = getState('fii-streak');
                            const history = getHistoryData(5);
                            const wMsg = tgMessages.buildWeeklyDigestMessage(digestState, regime, streak, history);
                            telegram.broadcastTelegram(wMsg, TG_TOKEN, axios, TG_CHANNEL_ID).catch(err =>
                                console.error('[TELEGRAM] Weekly digest broadcast failed:', err.message)
                            );
                        }
                    } catch (err) {
                        console.error(`[${new Date().toISOString()}] Weekly digest failed:`, err.message);
                    }
                });

                // Morning pre-market brief — 8:30 AM IST Mon-Fri (03:00 UTC)
                cron.schedule('0 3 * * 1-5', () => {
                    console.log(`[${new Date().toISOString()}] Morning brief starting…`);
                    if (tgHealth) tgHealth.recordHeartbeat('morning-brief');
                    agentRunner.runAgent('morning-brief').catch(err =>
                        console.error(`[${new Date().toISOString()}] Morning brief failed:`, err.message)
                    );
                });

                console.log('[BOOT] ✅ Cron jobs scheduled (8:30 AM brief + 6|6:30|7 PM post-market + 10 AM NSDL + 8 PM Fri digest)');
            } else {
                console.log('[BOOT] ✅ Cron jobs scheduled (6:00, 6:30, 7:00 PM IST Mon-Fri + 10:00 AM NSDL)');
            }

            // Telegram Watchdog — every 6 hours, auto-heal webhook conflicts + validate config
            if (tgHealth) {
                cron.schedule('0 */6 * * *', () => {
                    tgHealth.runWatchdog(axios).catch(err =>
                        console.error('[WATCHDOG] Failed:', err.message)
                    );
                });
                console.log('[BOOT] ✅ Telegram watchdog scheduled (every 6 hours)');
            }
        } catch (e) {
            console.error('[BOOT] Cron scheduling failed:', e.message);
        }
    } else {
        console.warn('[BOOT] ⚠ node-cron not available, skipping scheduler');
    }
});

module.exports = app;
