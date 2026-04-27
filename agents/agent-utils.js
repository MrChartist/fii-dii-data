// ── Agent Utilities — Shared infrastructure for all FII/DII agents ───────────
// Provides: state management, run logging, Telegram alerts, data readers, formatters

const fs = require('fs');
const path = require('path');
const axios = require('axios');

const DATA_DIR = path.join(process.cwd(), 'data');

// ── JSON Read/Write Helpers ──────────────────────────────────────────────────

function readJSON(filename, defaultVal) {
    try {
        const p = path.join(DATA_DIR, filename);
        if (!fs.existsSync(p)) return defaultVal;
        return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch {
        return defaultVal;
    }
}

function writeJSON(filename, data) {
    const p = path.join(DATA_DIR, filename);
    const tmp = p + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, p);
}

// ── Agent State Management ───────────────────────────────────────────────────
// Each agent gets a namespace in data/agent_state.json
// Structure: { "agent-name": { "key": "value", ... }, ... }

function getState(agentName) {
    const allState = readJSON('agent_state.json', {});
    return allState[agentName] || {};
}

function setState(agentName, updates) {
    const allState = readJSON('agent_state.json', {});
    allState[agentName] = {
        ...(allState[agentName] || {}),
        ...updates,
        _updated_at: new Date().toISOString()
    };
    writeJSON('agent_state.json', allState);
    return allState[agentName];
}

function getAllStates() {
    return readJSON('agent_state.json', {});
}

// ── Agent Run Logger ─────────────────────────────────────────────────────────
// Keeps last 500 run entries in data/agent_runs.json

const MAX_RUNS = 500;

function logRun(agentName, result) {
    const runs = readJSON('agent_runs.json', []);
    runs.unshift({
        agent: agentName,
        run_at: new Date().toISOString(),
        status: result.error ? 'error' : 'ok',
        items_found: result.items_found || 0,
        alerts_sent: result.alerts_sent || 0,
        duration_ms: result.duration_ms || 0,
        error: result.error || null,
        result: result.data || null
    });
    writeJSON('agent_runs.json', runs.slice(0, MAX_RUNS));
}

function getRunHistory(limit = 50, agentFilter = null) {
    const runs = readJSON('agent_runs.json', []);
    const filtered = agentFilter
        ? runs.filter(r => r.agent === agentFilter)
        : runs;
    return filtered.slice(0, limit);
}

// ── Telegram Notifier ────────────────────────────────────────────────────────
// Reads TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID from environment

async function sendTelegramAlert(message, parseMode = 'HTML') {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    // Fallback to TELEGRAM_CHANNEL_ID if TELEGRAM_CHAT_ID is not set
    const chatId = process.env.TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHANNEL_ID;

    // Lazy-load delivery tracker
    let tgHealth;
    try { tgHealth = require('../telegram-health'); } catch { tgHealth = null; }

    if (!token || !chatId) {
        console.error('[AGENT-TG] ❌ Telegram not configured (missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID/TELEGRAM_CHANNEL_ID)');
        console.error('[AGENT-TG] Would have sent:', message.substring(0, 200) + '…');
        if (tgHealth) tgHealth.trackFailure('agent-alert', chatId || 'NOT_SET', 'env_not_configured', message);
        return { sent: false, reason: 'not_configured' };
    }

    try {
        const url = `https://api.telegram.org/bot${token}/sendMessage`;
        const res = await axios.post(url, {
            chat_id: chatId,
            text: message,
            parse_mode: parseMode,
            disable_web_page_preview: true
        }, { timeout: 10000 });

        console.log(`[AGENT-TG] ✅ Alert sent to ${chatId} (msg_id: ${res.data?.result?.message_id})`);
        if (tgHealth) tgHealth.trackSuccess('agent-alert', chatId, message);
        return { sent: true, message_id: res.data?.result?.message_id };
    } catch (err) {
        console.error(`[AGENT-TG] ❌ Failed to send to ${chatId}: ${err.message}`);
        if (tgHealth) tgHealth.trackFailure('agent-alert', chatId, err.message, message);
        return { sent: false, reason: err.message };
    }
}

// ── Data Readers ─────────────────────────────────────────────────────────────

const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };

function parseDate(dateStr) {
    // Parses "01-Apr-2026" → Date object
    if (!dateStr) return null;
    const parts = dateStr.split('-');
    if (parts.length !== 3) return null;
    const day = parseInt(parts[0], 10);
    const month = MONTHS[parts[1]];
    const year = parseInt(parts[2], 10);
    if (month === undefined || isNaN(day) || isNaN(year)) return null;
    return new Date(year, month, day);
}

function compareDates(a, b) {
    const dA = parseDate(a);
    const dB = parseDate(b);
    if (!dA || !dB) return 0;
    return dA - dB;
}

function getHistory(days = 60) {
    const history = readJSON('history.json', []);
    return [...history]
        .sort((a, b) => compareDates(b.date, a.date))
        .slice(0, days);
}

function getLatestEntry() {
    const history = getHistory(1);
    return history[0] || null;
}

function getSectors() {
    return readJSON('sectors.json', []);
}

// ── Market Data (VIX) ────────────────────────────────────────────────────────

async function fetchVIX() {
    try {
        const url = 'https://query1.finance.yahoo.com/v8/finance/chart/%5EINDIAVIX?interval=1d&range=1d';
        const { data } = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 8000
        });
        const price = data.chart.result[0].meta.regularMarketPrice;
        return price || 0;
    } catch (err) {
        console.warn('[AGENT] VIX fetch failed:', err.message);
        return 0;
    }
}

// ── Formatters ───────────────────────────────────────────────────────────────

function fmtCr(value) {
    const sign = value >= 0 ? '+' : '-';
    return `${sign}₹${Math.abs(Math.round(value)).toLocaleString('en-IN')} Cr`;
}

function fmtPct(value) {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function fmtDate(dateStr) {
    // "01-Apr-2026" → "1 Apr 2026"
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parseInt(parts[0])} ${parts[1]} ${parts[2]}`;
}

// ── Regime Emoji Map ─────────────────────────────────────────────────────────

const REGIME_EMOJI = {
    'STRONG_BULLISH': '🟢',
    'MILD_BULLISH': '🟡',
    'NEUTRAL': '⚪',
    'MILD_BEARISH': '🟠',
    'STRONG_BEARISH': '🔴'
};

const REGIME_LABELS = {
    'STRONG_BULLISH': 'STRONG BULLISH',
    'MILD_BULLISH': 'MILD BULLISH',
    'NEUTRAL': 'NEUTRAL',
    'MILD_BEARISH': 'MILD BEARISH',
    'STRONG_BEARISH': 'STRONG BEARISH'
};

module.exports = {
    // State
    getState,
    setState,
    getAllStates,
    // Runs
    logRun,
    getRunHistory,
    // Telegram
    sendTelegramAlert,
    // Data
    getHistory,
    getLatestEntry,
    getSectors,
    fetchVIX,
    // Parsing
    parseDate,
    compareDates,
    readJSON,
    writeJSON,
    // Formatting
    fmtCr,
    fmtPct,
    fmtDate,
    // Constants
    REGIME_EMOJI,
    REGIME_LABELS,
    DATA_DIR
};
