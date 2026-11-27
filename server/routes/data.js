'use strict';
/** Core data API: latest session, history, sectors. Contract: contracts/api.openapi.yaml */
const { getLatestData, getHistoryData, getSectorData } = require('../services/feed');
module.exports = function mount(app) {
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
};
