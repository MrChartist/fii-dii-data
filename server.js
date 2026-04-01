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
    const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || 'XPNYDfF9dwiUTJrZdnZQQ2LFOHlMjkBl5Y3dIDACH2o';
    webpush.setVapidDetails('mailto:contact@mrchartist.com', VAPID_PUBLIC, VAPID_PRIVATE);
    console.log('[BOOT] web-push loaded ✓');
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

// ── Category-specific notification builder ───────────────────────────────────
function sendDataNotifications(data) {
    const fiiSign = data.fii_net >= 0 ? '+' : '';
    const diiSign = data.dii_net >= 0 ? '+' : '';
    const fmtCr = (v) => `${v >= 0 ? '+' : ''}₹${Math.abs(v).toLocaleString('en-IN')} Cr`;
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
                cron.schedule('30 14 * * 5', () => {
                    console.log(`[${new Date().toISOString()}] Weekly digest starting…`);
                    agentRunner.runWeeklyDigest().catch(err =>
                        console.error(`[${new Date().toISOString()}] Weekly digest failed:`, err.message)
                    );
                });
                console.log('[BOOT] ✅ Cron jobs scheduled (6:00, 6:30, 7:00 PM IST Mon-Fri + 10:00 AM NSDL + 8:00 PM Fri digest)');
            } else {
                console.log('[BOOT] ✅ Cron jobs scheduled (6:00, 6:30, 7:00 PM IST Mon-Fri + 10:00 AM NSDL)');
            }
        } catch (e) {
            console.error('[BOOT] Cron scheduling failed:', e.message);
        }
    } else {
        console.warn('[BOOT] ⚠ node-cron not available, skipping scheduler');
    }
});

module.exports = app;
