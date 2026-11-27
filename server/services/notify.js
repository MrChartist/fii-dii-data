'use strict';
/** Once-per-trading-date push alerts (cash, F&O). Dedupe is persisted so deploys/restarts never double-send. */
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('../../lib/store');
const { broadcastNotification } = require('./push');

const NOTIFY_LOG_PATH = path.join(DATA_DIR, 'notify_log.json');
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

module.exports = { sendDataNotifications };
