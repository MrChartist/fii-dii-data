// ── Telegram Bot Integration for FII & DII Data Alerts ──────────────────────────
const fs = require('fs');
const path = require('path');

// Delivery tracking — lazy loaded to avoid circular deps
let _tgHealth = null;
function tgHealth() {
    if (!_tgHealth) { try { _tgHealth = require('./telegram-health'); } catch { _tgHealth = { trackSuccess: () => {}, trackFailure: () => {} }; } }
    return _tgHealth;
}

const SUBS_PATH = path.join(process.cwd(), 'data', 'telegram_subs.json');

function loadChatIds() {
    try {
        if (!fs.existsSync(SUBS_PATH)) return [];
        return JSON.parse(fs.readFileSync(SUBS_PATH, 'utf8'));
    } catch { return []; }
}

function saveChatIds(ids) {
    const tmp = SUBS_PATH + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(ids, null, 2), 'utf8');
    fs.renameSync(tmp, SUBS_PATH);
}

function addChatId(chatId) {
    const ids = loadChatIds();
    if (!ids.includes(chatId)) {
        ids.push(chatId);
        saveChatIds(ids);
        return true;
    }
    return false;
}

function removeChatId(chatId) {
    const ids = loadChatIds().filter(id => id !== chatId);
    saveChatIds(ids);
}

async function sendMessage(chatId, text, token, axios) {
    try {
        await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
            chat_id: chatId,
            text,
            parse_mode: 'HTML',
            disable_web_page_preview: false
        });
        tgHealth().trackSuccess('subscriber', chatId, text);
    } catch (err) {
        if (err.response?.data?.error_code === 403) {
            removeChatId(chatId);
            console.log(`[TELEGRAM] Removed blocked chat: ${chatId}`);
            tgHealth().trackFailure('subscriber', chatId, 'blocked-403', text);
        } else {
            const errMsg = err.response?.data?.description || err.message;
            console.error(`[TELEGRAM] Send failed for ${chatId}:`, errMsg);
            tgHealth().trackFailure('subscriber', chatId, errMsg, text);
        }
    }
}

async function sendToChannel(channelId, text, token, axios) {
    if (!channelId || !token) {
        tgHealth().trackFailure('channel', channelId || 'unknown', 'missing channelId or token', text);
        return;
    }
    try {
        await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
            chat_id: channelId,
            text,
            parse_mode: 'HTML',
            disable_web_page_preview: false
        });
        console.log(`[TELEGRAM] Posted to channel ${channelId}`);
        tgHealth().trackSuccess('channel', channelId, text);
    } catch (err) {
        const errMsg = err.response?.data?.description || err.message;
        console.error(`[TELEGRAM] Channel post failed:`, errMsg);
        tgHealth().trackFailure('channel', channelId, errMsg, text);
    }
}

async function broadcastTelegram(text, token, axios, channelId) {
    if (!token) return;
    // Post to channel first
    if (channelId) {
        await sendToChannel(channelId, text, token, axios);
    }
    // Then broadcast to individual subscribers
    const ids = loadChatIds();
    if (!ids.length) return;
    console.log(`[TELEGRAM] Broadcasting to ${ids.length} subscriber(s)\u2026`);
    await Promise.allSettled(ids.map(id => sendMessage(id, text, token, axios)));
}

// ── Build on-demand reports for /latest, /fno, /sector commands ──────────────
function getOnDemandMessages() {
    let tgMessages, latest, regime, streak, flowStrength, flowDiv, sectorData, sectorRotation, weeklyDigest;
    try {
        tgMessages = require('./telegram-messages');
        try { latest = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'latest.json'), 'utf8')); } catch { latest = null; }
        const { getState } = require('./agents/agent-utils');
        const { getHistoryData } = require('./scripts/fetch_data');
        regime = getState('regime-classifier');
        streak = getState('fii-streak');
        flowStrength = getState('flow-strength');
        flowDiv = getState('flow-divergence');
        sectorRotation = getState('sector-rotation');
        weeklyDigest = getState('weekly-digest');
        try { sectorData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'sector_latest.json'), 'utf8')); } catch { sectorData = null; }
        return { tgMessages, latest, regime, streak, flowStrength, flowDiv, sectorData, sectorRotation, weeklyDigest, getHistoryData };
    } catch (e) {
        console.error('[TELEGRAM] On-demand data load failed:', e.message);
        return null;
    }
}

// ── Process incoming bot messages ────────────────────────────────────────────
function processUpdate(update) {
    const msg = update.message;
    if (!msg || !msg.text) return null;

    const chatId = msg.chat.id;
    const text = msg.text.trim().toLowerCase();
    const userName = msg.from?.first_name || 'Investor';

    // ── /start ───────────────────────────────────────────────────────────────
    if (text === '/start') {
        const isNew = addChatId(chatId);
        const welcome = isNew
            ? `\u2728 <b>Welcome to FII & DII Data, ${userName}!</b>\n\nYou're now subscribed to institutional flow intelligence.\n\n<b>What you'll receive:</b>\n\ud83d\udcca Cash Flow Updates (FII/DII daily)\n\ud83d\udcc8 F&O Derivatives Positioning\n\ud83c\udfe6 Sector Rotation (NSDL data)\n\ud83e\udde0 AI Regime Classification\n\ud83d\udd25 Streak & Extreme Flow Alerts\n\u26a1 Contrarian Divergence Signals\n\ud83c\udf05 Morning Pre-Market Briefs\n\ud83d\udcc5 Weekly Institutional Digests\n\n<b>Commands:</b>\n/latest \u2014 Get today's full report\n/fno \u2014 F&O derivatives positioning\n/sector \u2014 Sector rotation data\n/regime \u2014 Current market regime\n/help \u2014 All commands\n\n\ud83c\udf10 <a href="https://fii-diidata.mrchartist.com">Open Live Dashboard</a>`
            : `\ud83d\udc4b Hey ${userName}, you're already subscribed!\n\nTry /latest for today's report or /help for commands.`;
        return { chatId, reply: welcome };
    }

    // ── /stop ────────────────────────────────────────────────────────────────
    if (text === '/stop') {
        removeChatId(chatId);
        return {
            chatId,
            reply: `\ud83d\udd15 <b>Unsubscribed.</b>\n\nYou won't receive further alerts.\nType /start to re-subscribe anytime.\n\n\ud83c\udf10 <a href="https://fii-diidata.mrchartist.com">Dashboard is always available</a>`
        };
    }

    // ── /status ──────────────────────────────────────────────────────────────
    if (text === '/status') {
        const ids = loadChatIds();
        const ctx = getOnDemandMessages();
        let reply = `\ud83d\udce1 <b>FII \u0026 DII Data Bot Status</b>\n\n`;
        reply += `\ud83d\udc64 Subscribers: <b>${ids.length}</b>\n`;
        reply += `\ud83d\udd14 You: ${ids.includes(chatId) ? '\u2705 Active' : '\u274c Inactive'}\n`;
        if (ctx && ctx.latest) {
            reply += `\ud83d\udcc5 Latest Data: <b>${ctx.latest.date}</b>\n`;
            reply += `\u23f0 Updated: ${ctx.latest._updated_at || 'N/A'}`;
        }
        return { chatId, reply };
    }

    // ── /latest — Full cash flow report ──────────────────────────────────────
    if (text === '/latest') {
        const ctx = getOnDemandMessages();
        if (!ctx) return { chatId, reply: '\u26a0\ufe0f Data not available yet. Please try later.' };
        // Return as async: multi-message
        return {
            chatId,
            reply: ctx.tgMessages.buildCashFlowMessage(ctx.latest, ctx.regime, ctx.streak, ctx.flowStrength),
            followUp: ctx.tgMessages.buildDerivativesMessage(ctx.latest)
        };
    }

    // ── /fno — Derivatives positioning ───────────────────────────────────────
    if (text === '/fno' || text === '/derivatives') {
        const ctx = getOnDemandMessages();
        if (!ctx) return { chatId, reply: '\u26a0\ufe0f Data not available yet.' };
        return { chatId, reply: ctx.tgMessages.buildDerivativesMessage(ctx.latest) };
    }

    // ── /sector — Sector rotation ────────────────────────────────────────────
    if (text === '/sector' || text === '/sectors') {
        const ctx = getOnDemandMessages();
        if (!ctx || !ctx.sectorData) return { chatId, reply: '\u26a0\ufe0f Sector data not available yet.' };
        const msg = ctx.tgMessages.buildSectorMessage(ctx.sectorData, ctx.sectorRotation);
        return { chatId, reply: msg || '\u26a0\ufe0f No sector data found.' };
    }

    // ── /regime — Current market regime ──────────────────────────────────────
    if (text === '/regime') {
        const ctx = getOnDemandMessages();
        if (!ctx) return { chatId, reply: '\u26a0\ufe0f Data not available.' };
        const r = ctx.regime;
        const rEmoji = { STRONG_BULLISH: '\ud83d\udfe2', MILD_BULLISH: '\ud83d\udfe1', NEUTRAL: '\u26aa', MILD_BEARISH: '\ud83d\udfe0', STRONG_BEARISH: '\ud83d\udd34' };
        let reply = `\ud83e\udde0 <b>MARKET REGIME</b>\n\n`;
        reply += `${rEmoji[r.regime] || '\u26aa'} <b>${(r.regime || 'NEUTRAL').replace(/_/g, ' ')}</b>\n`;
        if (r.since) reply += `Since: ${r.since}\n`;
        if (r.vix) reply += `VIX: <b>${r.vix}</b>\n`;
        if (r.fii_cumulative_10d) reply += `FII 10d: ${r.fii_cumulative_10d >= 0 ? '+' : ''}\u20b9${Math.abs(r.fii_cumulative_10d).toLocaleString('en-IN')} Cr\n`;
        if (r.recommendation) reply += `\n\ud83d\udca1 <i>${r.recommendation}</i>`;
        reply += `\n\n\ud83c\udf10 <a href="https://fii-diidata.mrchartist.com">Open Dashboard</a>`;
        return { chatId, reply };
    }

    // ── /weekly — Weekly digest ──────────────────────────────────────────────
    if (text === '/weekly' || text === '/digest') {
        const ctx = getOnDemandMessages();
        if (!ctx) return { chatId, reply: '\u26a0\ufe0f Data not available.' };
        const history = ctx.getHistoryData ? ctx.getHistoryData(5) : [];
        return { chatId, reply: ctx.tgMessages.buildWeeklyDigestMessage(ctx.weeklyDigest, ctx.regime, ctx.streak, history) };
    }

    // ── /help — Full command list ────────────────────────────────────────────
    if (text === '/help') {
        return {
            chatId,
            reply: `\ud83d\udcca <b>FII \u0026 DII Data \u2014 Commands</b>\n\n` +
                `<b>DATA REPORTS</b>\n` +
                `/latest \u2014 Today's FII/DII cash flows + derivatives\n` +
                `/fno \u2014 F&O derivatives positioning\n` +
                `/sector \u2014 FPI sector rotation (NSDL)\n` +
                `/regime \u2014 Current market regime\n` +
                `/weekly \u2014 Weekly institutional digest\n\n` +
                `<b>SUBSCRIPTION</b>\n` +
                `/start \u2014 Subscribe to alerts\n` +
                `/stop \u2014 Unsubscribe\n` +
                `/status \u2014 Bot status & data freshness\n\n` +
                `<b>AUTO ALERTS</b>\n` +
                `\ud83d\udcca Cash flows \u2014 Daily ~6-7 PM IST\n` +
                `\ud83d\udcc8 Derivatives \u2014 Daily ~6-7 PM IST\n` +
                `\ud83c\udfe6 Sector rotation \u2014 When NSDL updates\n` +
                `\ud83c\udf05 Morning brief \u2014 8:30 AM IST Mon-Fri\n` +
                `\ud83d\udcc5 Weekly digest \u2014 Friday 8 PM IST\n` +
                `\u26a1 Divergence alerts \u2014 On detection\n\n` +
                `\ud83c\udf10 <a href="https://fii-diidata.mrchartist.com">Open Live Dashboard</a>\n` +
                `\ud83d\udce2 <a href="https://t.me/official_mrchartist">Join Channel</a>`
        };
    }

    // ── Default — Unknown command ────────────────────────────────────────────
    return {
        chatId,
        reply: `\ud83d\udcca <b>FII & DII Data</b>\n\nTry /latest for today's report or /help for all commands.\n\n\ud83c\udf10 <a href="https://fii-diidata.mrchartist.com">Open Dashboard</a>`
    };
}

module.exports = { loadChatIds, addChatId, removeChatId, sendMessage, sendToChannel, broadcastTelegram, processUpdate };
