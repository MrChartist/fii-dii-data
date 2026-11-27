'use strict';
/** Agent API: synthesis, per-agent state, runs, manual triggers, self-documenting manifest. */
const axios = require('axios');
const synthCache = require('../services/synthesis-cache');
const agentRunner = require('../../agents/runner');
const { getLatestData, getHistoryData, getSectorData } = require('../services/feed');
module.exports = function mount(app) {
    // ── Agent API Endpoints ──────────────────────────────────────────────────────

    // Real-Time LLM Synthesis (Groq AI Agent) — with 5-min cache
    app.get('/api/agents/synthesis', async (req, res) => {
        try {
            // Return cached if fresh
            if (synthCache.get().text && (Date.now() - synthCache.get().ts) < synthCache.SYNTH_TTL) {
                return res.json({ success: true, synthesis: synthCache.get().text, cached: true, cached_at: new Date(synthCache.get().ts).toISOString() });
            }

            const groqKey = process.env.GROQ_API_KEY;
            if (!groqKey) return res.status(503).json({ error: 'Groq API key not configured' });
        
            const { getAllStates } = require('../../agents/agent-utils');
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
            synthCache.set(synthesis);
            res.json({ success: true, synthesis, cached: false });

        } catch (err) {
            console.error('[GROQ] Synthesis failed:', err.response?.data || err.message);
            // Return stale cache if available
            if (synthCache.get().text) return res.json({ success: true, synthesis: synthCache.get().text, cached: true, stale: true });
            res.status(500).json({ error: 'Failed to generate synthesis' });
        }
    });


    // Current regime classification (consumed by all ecosystem agents)
    app.get('/api/agents/regime', (req, res) => {
        try {
            const { getState } = require('../../agents/agent-utils');
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
                recommendation: require('../../agents/agent-utils').regimeNote(state.regime),
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
            const { getState } = require('../../agents/agent-utils');
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
            const { getAllStates, getRunHistory } = require('../../agents/agent-utils');
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
            const { getRunHistory } = require('../../agents/agent-utils');
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
            const { getState } = require('../../agents/agent-utils');
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
            const { getState } = require('../../agents/agent-utils');
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
            const { getState } = require('../../agents/agent-utils');
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
            const { getState } = require('../../agents/agent-utils');
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
            agents: Object.entries(agentRunner.AGENTS).map(([name, def]) => ({
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
                { method: 'POST', path: '/api/refresh', description: 'Trigger manual NSE data fetch' }
            ]
        };
        res.json(docs);
    });
};
