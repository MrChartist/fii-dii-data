'use strict';
/** Operational endpoints: refresh, status, health, SSE stream. */
const { sseClients } = require('../services/sse');
const { getFetchLogs, fetchAndProcessData } = require('../services/feed');
const pipeline = require('../services/pipeline');
module.exports = function mount(app) {
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
            // Respond first; agents + notifications run in the background
            if (data && !data._skipped) pipeline.onNewSession(data);
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
};
