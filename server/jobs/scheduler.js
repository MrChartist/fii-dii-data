'use strict';
/**
 * Cron jobs. All expressions are UTC (pinned via CRON_OPTS) — IST = UTC+5:30.
 *   post-market fetch : every 15 min 6:00–9:00 PM IST (smart-skip once cash+F&O are stored)
 *   NSDL sectors      : 10:00 AM IST daily
 *   F&O recovery      : 10:00 PM IST + 8:00 AM IST next morning
 *   weekly digest     : Friday 8:00 PM IST
 */
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('../../lib/store');
const feed = require('../services/feed');
const pipeline = require('../services/pipeline');
const { broadcastNotification } = require('../services/push');
const agentRunner = require('../../agents/runner');

const CRON_OPTS = { timezone: 'Etc/UTC' };
const ts = () => new Date().toISOString();
const fmtCr = (v) => `${v >= 0 ? '+' : '-'}₹${Math.abs(v).toLocaleString('en-IN')} Cr`;

async function runFetchTask(label) {
    console.log(`[${ts()}] ${label} fetch starting…`);
    try {
        const data = await feed.fetchAndProcessData();
        console.log(`[${ts()}] ${label} fetch completed.`);
        if (data && !data._skipped) await pipeline.onNewSession(data);
    } catch (err) {
        console.error(`[${ts()}] ${label} fetch failed:`, err.message);
    }
}

async function runNSDLFetch() {
    console.log(`[${ts()}] NSDL sector fetch starting…`);
    try {
        // A missing/corrupt previous file must not abort the fetch that creates it
        let oldCode = '';
        try { oldCode = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'sector_latest.json'), 'utf8')).date_code || ''; } catch { /* first run */ }
        const result = await feed.fetchAllNSDL();
        console.log(`[${ts()}] NSDL sector fetch completed.`);
        if (result && result.sectorData && result.sectorData.date_code !== oldCode) {
            const sectors = result.sectorData.sectors || [];
            const sorted = [...sectors].sort((a, b) => b.equity_net_inr - a.equity_net_inr);
            const topIn = sorted[0], topOut = sorted[sorted.length - 1];
            broadcastNotification({
                title: '🏦 Sector Rotation Update',
                body: `Top Inflow: ${topIn?.sector} (${fmtCr(topIn?.equity_net_inr || 0)}) | Top Outflow: ${topOut?.sector} (${fmtCr(topOut?.equity_net_inr || 0)}) | ${sectors.length} sectors updated`,
                url: '/#t-sectors'
            }, 'sectors');
            agentRunner.runSectorAgents().catch(err => console.error(`[${ts()}] Sector agent run failed:`, err.message));
        }
    } catch (err) {
        console.error(`[${ts()}] NSDL fetch failed:`, err.message);
    }
}

// NSE publishes participant-OI after the evening window sometimes: backfill cash-only rows, fire the pending F&O alert once
async function runFaoRecovery(label) {
    try {
        const filled = await feed.backfillMissingFao();
        if (!filled || !filled.length) return;
        console.log(`[${ts()}] ${label} recovered F&O: ${filled.join(', ')}`);
        const latest = feed.getLatestData();
        if (latest && filled.includes(latest.date)) pipeline.onFaoRecovered(latest);
    } catch (err) {
        console.error(`[${ts()}] ${label} F&O recovery failed:`, err.message);
    }
}

function start() {
    ['30,45 12 * * 1-5', '*/15 13-14 * * 1-5', '0,15,30 15 * * 1-5']
        .forEach(s => cron.schedule(s, () => runFetchTask('Post-market'), CRON_OPTS));
    cron.schedule('30 4 * * 1-5', runNSDLFetch, CRON_OPTS);
    cron.schedule('30 16 * * 1-5', () => runFaoRecovery('Late-evening'), CRON_OPTS);
    cron.schedule('30 2 * * 2-6', () => runFaoRecovery('Next-morning'), CRON_OPTS);
    cron.schedule('30 14 * * 5', async () => {
        console.log(`[${ts()}] Weekly digest starting…`);
        try { await agentRunner.runWeeklyDigest(); }
        catch (err) { console.error(`[${ts()}] Weekly digest failed:`, err.message); }
    }, CRON_OPTS);
    console.log('[BOOT] ✅ Cron jobs scheduled (post-market, NSDL, F&O recovery, weekly digest)');
}

module.exports = { start };
