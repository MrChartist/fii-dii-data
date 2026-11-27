'use strict';
/**
 * What happens when a NEW session lands — shared by the cron job, /api/refresh
 * and F&O recovery so the three can never drift apart.
 * Order matters: agents run BEFORE notifications so messages read today's state.
 */
const sse = require('./sse');
const synthCache = require('./synthesis-cache');
const { persistMarketClose } = require('./market');
const { sendDataNotifications } = require('./notify');
const agentRunner = require('../../agents/runner');

function announce(data) {
    sse.sseBroadcast('data-update', { date: data.date, fii_net: data.fii_net, dii_net: data.dii_net, ts: new Date().toISOString() });
}

async function onNewSession(data) {
    announce(data);
    synthCache.clear();
    persistMarketClose(data.date);
    try { await agentRunner.runAllPostMarket(); }
    catch (err) { console.error('[PIPELINE] Agent run failed:', err.message); }
    sendDataNotifications(data);
}

/** F&O arrived late for an already-announced cash session: refresh clients, fire only the F&O alert. */
function onFaoRecovered(latest) {
    announce(latest);
    sendDataNotifications(latest);
}

module.exports = { onNewSession, onFaoRecovered };
