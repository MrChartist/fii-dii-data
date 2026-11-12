// ── Agent Utilities — Shared infrastructure for all FII/DII agents ───────────
// Provides: state management, run logging, alert hook, data readers, formatters

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

// ── Alert delivery ───────────────────────────────────────────────────────────
// Agents compute signals and keep state for the dashboard and API. No outbound
// messaging channel is configured, so nothing is sent; the hook stays so a
// channel can be added in one place later.
async function deliverAlert(/* message */) {
    return { sent: false, reason: 'no_alert_channel' };
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
    // Sign comes from the rounded value so -0.4 prints "+₹0 Cr", not "-₹0 Cr"
    const rounded = Math.round(value || 0);
    const sign = rounded >= 0 ? '+' : '-';
    return `${sign}₹${Math.abs(rounded).toLocaleString('en-IN')} Cr`;
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

const REGIME_NOTES = {
    // Descriptions of what the flow data shows — deliberately NOT instructions.
    // These go out to the public channel and the API; telling readers how to
    // size, hedge or short would be unsolicited investment advice.
    'STRONG_BULLISH':  'Institutions are net buyers on both sides; flows are broadly supportive.',
    'MILD_BULLISH':    'Net institutional buying, with domestic support outweighing foreign selling.',
    'NEUTRAL':         'Foreign and domestic flows are roughly offsetting; no clear institutional bias.',
    'MILD_BEARISH':    'Foreign selling is persistent and only partly absorbed by domestic buying.',
    'STRONG_BEARISH':  'Heavy foreign selling with weak domestic absorption; flows are a headwind.'
};
// Always derive the note from the regime key: text stored in older state files
// may still carry the previous advice-style wording.
function regimeNote(regime) { return REGIME_NOTES[regime] || ''; }

module.exports = {
    REGIME_NOTES,
    regimeNote,
    // State
    getState,
    setState,
    getAllStates,
    // Runs
    logRun,
    getRunHistory,
    // Alerts
    deliverAlert,
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
