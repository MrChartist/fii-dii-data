// ── Telegram Bot Integration for FII & DII Data Alerts ──────────────────────────
const fs = require('fs');
const path = require('path');

// Delivery tracking — lazy loaded to avoid circular deps
let _tgHealth = null;
function tgHealth() {
    if (!_tgHealth) { try { _tgHealth = require('./telegram-health'); } catch { _tgHealth = { trackSuccess: () => {}, trackFailure: () => {} }; } }
    return _tgHealth;
}

const SUBS_PATH = path.join(__dirname, 'data', 'telegram_subs.json');

// Escape user-controlled text before interpolating into HTML parse-mode
// messages — names like "<3" otherwise make Telegram reject the whole send
function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

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

// ── User-set alert thresholds (/alert command) ──────────────────────────────
const PREFS_PATH = path.join(__dirname, 'data', 'telegram_alert_prefs.json');

function loadAlertPrefs() {
    try {
        if (!fs.existsSync(PREFS_PATH)) return {};
        return JSON.parse(fs.readFileSync(PREFS_PATH, 'utf8'));
    } catch { return {}; }
}

function saveAlertPrefs(prefs) {
    const tmp = PREFS_PATH + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(prefs, null, 2), 'utf8');
    fs.renameSync(tmp, PREFS_PATH);
}

// Called after each new data day: fire personal alerts for users whose
// |FII net| threshold was crossed. Returns number of alerts sent.
async function checkUserThresholdAlerts(data, token, axios) {
    if (!token || !data) return 0;
    const prefs = loadAlertPrefs();
    const fn = data.fii_net || 0;
    let sent = 0;
    for (const [chatId, p] of Object.entries(prefs)) {
        const thr = p && p.fii_threshold;
        if (!thr || Math.abs(fn) < thr) continue;
        if (p.last_alerted_date === data.date) continue; // once per session
        const dir = fn < 0 ? 'SELLING' : 'BUYING';
        const msg = `🎯 <b>YOUR ALERT TRIGGERED</b> · ${data.date}\n\n` +
            `FII net ${dir.toLowerCase()} of <b>${fn < 0 ? '-' : '+'}₹${Math.abs(Math.round(fn)).toLocaleString('en-IN')} Cr</b> ` +
            `crossed your ±₹${thr.toLocaleString('en-IN')} Cr threshold.\n\n` +
            `Manage: /alert off · /alert &lt;amount&gt;\n` +
            `🌐 <a href="https://mrchartist.com/fii-dii-data">Open Dashboard</a>`;
        const ok = await sendMessage(chatId, msg, token, axios);
        if (ok) { p.last_alerted_date = data.date; sent++; }
    }
    if (sent) saveAlertPrefs(prefs);
    return sent;
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
        return true;
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
        return false;
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
        return true;
    } catch (err) {
        const errMsg = err.response?.data?.description || err.message;
        console.error(`[TELEGRAM] Channel post failed:`, errMsg);
        tgHealth().trackFailure('channel', channelId, errMsg, text);
        return false;
    }
}

async function broadcastTelegram(text, token, axios, channelId) {
    if (!token) return { sent: 0, failed: 0 };
    let sent = 0, failed = 0;
    // Post to channel first
    if (channelId) {
        (await sendToChannel(channelId, text, token, axios)) ? sent++ : failed++;
    }
    // Then broadcast to individual subscribers
    const ids = loadChatIds();
    if (ids.length) {
        console.log(`[TELEGRAM] Broadcasting to ${ids.length} subscriber(s)\u2026`);
        const results = await Promise.allSettled(ids.map(id => sendMessage(id, text, token, axios)));
        results.forEach(r => (r.status === 'fulfilled' && r.value) ? sent++ : failed++);
    }
    return { sent, failed };
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
    // Strip "@BotName" suffix so group commands like /latest@FlowMatrixBot work
    const text = msg.text.trim().toLowerCase().split('@')[0];
    const userName = escapeHtml(msg.from?.first_name || 'Investor');

    // ── /start ───────────────────────────────────────────────────────────────
    if (text === '/start') {
        const isNew = addChatId(chatId);
        const welcome = isNew
            ? `\u2728 <b>Welcome to FII & DII Data, ${userName}!</b>\n\nYou're now subscribed to institutional flow intelligence.\n\n<b>What you'll receive:</b>\n\ud83d\udcca Cash Flow Updates (FII/DII daily)\n\ud83d\udcc8 F&O Derivatives Positioning\n\ud83c\udfe6 Sector Rotation (NSDL data)\n\ud83e\udde0 AI Regime Classification\n\ud83d\udd25 Streak & Extreme Flow Alerts\n\u26a1 Contrarian Divergence Signals\n\ud83c\udf05 Morning Pre-Market Briefs\n\ud83d\udcc5 Weekly Institutional Digests\n\n<b>Commands:</b>\n/latest \u2014 Get today's full report\n/fno \u2014 F&O derivatives positioning\n/sector \u2014 Sector rotation data\n/regime \u2014 Current market regime\n/help \u2014 All commands\n\n\ud83c\udf10 <a href="https://mrchartist.com/fii-dii-data">Open Live Dashboard</a>`
            : `\ud83d\udc4b Hey ${userName}, you're already subscribed!\n\nTry /latest for today's report or /help for commands.`;
        return { chatId, reply: welcome };
    }

    // ── /stop ────────────────────────────────────────────────────────────────
    if (text === '/stop') {
        removeChatId(chatId);
        return {
            chatId,
            reply: `\ud83d\udd15 <b>Unsubscribed.</b>\n\nYou won't receive further alerts.\nType /start to re-subscribe anytime.\n\n\ud83c\udf10 <a href="https://mrchartist.com/fii-dii-data">Dashboard is always available</a>`
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
        if (!ctx || !ctx.latest) return { chatId, reply: '\u26a0\ufe0f Data not available yet. Please try later.' };
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
        if (!ctx || !ctx.latest) return { chatId, reply: '\u26a0\ufe0f Data not available yet.' };
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
        reply += `\n\n\ud83c\udf10 <a href="https://mrchartist.com/fii-dii-data">Open Dashboard</a>`;
        return { chatId, reply };
    }

    // ── /alert — user-set FII net threshold alerts ──────────────────────────
    if (text === '/alert' || text.startsWith('/alert ')) {
        const arg = text.replace('/alert', '').trim();
        const prefs = loadAlertPrefs();
        if (arg === 'off' || arg === 'stop') {
            delete prefs[chatId];
            saveAlertPrefs(prefs);
            return { chatId, reply: '🔕 Threshold alert removed. Set a new one anytime with /alert 5000' };
        }
        const amount = parseInt(arg.replace(/[,₹\s]/g, ''), 10);
        if (!arg) {
            const cur = prefs[chatId]?.fii_threshold;
            return { chatId, reply: cur
                ? `🎯 Your alert: FII net beyond <b>±₹${cur.toLocaleString('en-IN')} Cr</b>\n\nChange: /alert 8000 · Remove: /alert off`
                : `🎯 <b>Personal threshold alerts</b>\n\nGet pinged when FII net flow crosses YOUR level:\n/alert 5000 — alert beyond ±₹5,000 Cr\n/alert off — disable` };
        }
        if (!Number.isFinite(amount) || amount < 100 || amount > 1000000) {
            return { chatId, reply: '⚠️ Use an amount between 100 and 10,00,000 (₹ Cr). Example: /alert 5000' };
        }
        prefs[chatId] = { ...(prefs[chatId] || {}), fii_threshold: amount };
        saveAlertPrefs(prefs);
        return { chatId, reply: `✅ Done — you'll be alerted when FII net flow exceeds <b>±₹${amount.toLocaleString('en-IN')} Cr</b> in a session.\n\nRemove anytime with /alert off` };
    }

    // ── /streaks — Active FII buy/sell streaks ───────────────────────────────
    if (text === '/streaks' || text === '/streak') {
        const ctx = getOnDemandMessages();
        if (!ctx) return { chatId, reply: '⚠️ Data not available.' };
        const s = ctx.streak || {};
        const fmtCr = v => `${(v || 0) >= 0 ? '+' : '-'}₹${Math.abs(Math.round(v || 0)).toLocaleString('en-IN')} Cr`;
        let reply = `🔥 <b>FII STREAK TRACKER</b>\n\n`;
        if (s.current_sell_streak > 0) {
            reply += `🔴 Sell Streak: <b>${s.current_sell_streak} day(s)</b>\n`;
            reply += `💰 Cumulative: <b>${fmtCr(s.sell_cumulative)}</b>\n`;
            if (s.sell_absorption_pct) reply += `🛡️ DII absorbed: <b>${s.sell_absorption_pct}%</b>\n`;
        } else if (s.current_buy_streak > 0) {
            reply += `🟢 Buy Streak: <b>${s.current_buy_streak} day(s)</b>\n`;
            reply += `💰 Cumulative: <b>${fmtCr(s.buy_cumulative)}</b>\n`;
        } else {
            reply += `⚪ No active streak — FII direction flipped in the last session.\n`;
        }
        reply += `\n🌐 <a href="https://mrchartist.com/fii-dii-data">Open Dashboard</a>`;
        return { chatId, reply };
    }

    // ── /absorption — DII absorption of FII selling ─────────────────────────
    if (text === '/absorption' || text === '/absorb') {
        const ctx = getOnDemandMessages();
        if (!ctx || !ctx.latest) return { chatId, reply: '⚠️ Data not available.' };
        const fn = ctx.latest.fii_net || 0;
        const dn = ctx.latest.dii_net || 0;
        const fmtCr = v => `${(v || 0) >= 0 ? '+' : '-'}₹${Math.abs(Math.round(v || 0)).toLocaleString('en-IN')} Cr`;
        let reply = `🛡️ <b>DII ABSORPTION</b> · ${ctx.latest.date}\n\n`;
        reply += `FII Net: <b>${fmtCr(fn)}</b>\nDII Net: <b>${fmtCr(dn)}</b>\n\n`;
        if (fn < 0 && dn > 0) {
            const pct = Math.round((dn / Math.abs(fn)) * 100);
            reply += `DII absorbed <b>${pct}%</b> of FII selling today.\n`;
            reply += pct >= 100 ? `✅ Selling fully absorbed — domestic bid in control.` :
                     pct >= 60 ? `🟡 Substantial but partial absorption.` :
                                 `🔴 Weak absorption — net supply overhang.`;
        } else if (fn >= 0 && dn >= 0) {
            reply += `🟢 Both FII and DII were net buyers — no absorption needed.`;
        } else if (fn >= 0 && dn < 0) {
            reply += `⚡ Roles reversed: FII buying while DII books profits.`;
        } else {
            reply += `🔴 Both FII and DII were net sellers — no domestic cushion today.`;
        }
        reply += `\n\n🌐 <a href="https://mrchartist.com/fii-dii-data">Open Dashboard</a>`;
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
                `/streaks \u2014 Active FII buy/sell streak\n` +
                `/absorption \u2014 DII absorption of FII selling\n` +
                `/alert 5000 \u2014 personal alert when FII net crosses \u00b1\u20b95,000 Cr\n` +
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
                `\ud83c\udf10 <a href="https://mrchartist.com/fii-dii-data">Open Live Dashboard</a>\n` +
                `\ud83d\udce2 <a href="https://t.me/official_mrchartist">Join Channel</a>`
        };
    }

    // ── Default — Unknown command ────────────────────────────────────────────
    return {
        chatId,
        reply: `\ud83d\udcca <b>FII & DII Data</b>\n\nTry /latest for today's report or /help for all commands.\n\n\ud83c\udf10 <a href="https://mrchartist.com/fii-dii-data">Open Dashboard</a>`
    };
}

module.exports = { loadChatIds, addChatId, removeChatId, sendMessage, sendToChannel, broadcastTelegram, processUpdate, checkUserThresholdAlerts };
