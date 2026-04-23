const { getLatestData } = require('../scripts/fetch_data');
const { getState, sendTelegramAlert, logRun } = require('./agent-utils');

/**
 * Morning Brief Agent
 * Runs at 8:30 AM IST to provide a pre-market summary based on the previous day's flows
 * and the current agentic intelligence (regime, streaks, etc.).
 * Now uses the telegram-messages module for rich formatting.
 */

async function run() {
    console.log('[AGENT] Running Morning Brief...');

    const latest = getLatestData();
    const streak = getState('fii-streak');
    const regime = getState('regime-classifier');
    const flowDiv = getState('flow-divergence');
    
    if (!latest) {
        return { error: 'No latest data available for morning brief' };
    }

    let tgMessages;
    try {
        tgMessages = require('../telegram-messages');
    } catch (e) {
        console.warn('[AGENT] telegram-messages module not available, using fallback');
    }

    let msg;
    if (tgMessages) {
        msg = tgMessages.buildMorningBriefMessage(latest, regime, streak, flowDiv);
    } else {
        // Fallback to simple format
        const fmtCr = val => (val >= 0 ? '+' : '-') + '\u20b9' + Math.abs(val || 0).toLocaleString('en-IN') + ' Cr';
        msg = `\ud83c\udf05 <b>PRE-MARKET BRIEF</b> | ${new Date().toLocaleDateString('en-IN')}\n\n`;
        msg += `<b>Yesterday's Flows:</b>\n`;
        msg += `\u2022 FII: ${fmtCr(latest.fii_net)} ${latest.fii_net < 0 ? '\ud83d\udd34' : '\ud83d\udfe2'}\n`;
        msg += `\u2022 DII: ${fmtCr(latest.dii_net)} ${latest.dii_net < 0 ? '\ud83d\udd34' : '\ud83d\udfe2'}\n\n`;
        msg += `\ud83c\udf10 <a href="https://fii-diidata.mrchartist.com/">View Dashboard</a>`;
    }

    // Send via agent-utils (uses TELEGRAM_CHAT_ID)
    await sendTelegramAlert(msg);

    // Also broadcast to channel if configured
    try {
        const telegram = require('../telegram');
        const axios = require('axios');
        const token = process.env.TELEGRAM_BOT_TOKEN;
        const channelId = process.env.TELEGRAM_CHANNEL_ID;
        if (token && channelId && telegram) {
            await telegram.sendToChannel(channelId, msg, token, axios);
            console.log('[AGENT] Morning brief sent to channel');
        }
    } catch (e) {
        console.warn('[AGENT] Channel broadcast skipped:', e.message);
    }
    
    return {
        items_found: 1,
        alerts_sent: 1,
        data: { message_sent: true }
    };
}

module.exports = { run };
