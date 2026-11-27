// ── Weekly Institutional Digest ──────────────────────────────────────────────
// Phase 2C: Automated end-of-week intelligence report
//
// CRON: Every Friday at 8:00 PM IST
// GATHERS:
//   - Weekly FII/DII net totals
//   - Current streaks
//   - Sector rotation highlights
//   - Regime classification
//   - Flow divergence status
// FORMAT: Structured digest

const {
    getState, setState,
    getHistory, fmtCr, fmtDate,
    REGIME_EMOJI, REGIME_LABELS
} = require('./agent-utils');

const AGENT_NAME = 'weekly-digest';

// ISO-8601 week key "YYYY-Www" for a UTC-midnight calendar date. Uses the ISO
// week-year (the Thursday's year) so 29 Dec–3 Jan never get the wrong year.
function isoWeekKey(date) {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

// ── Digest Compiler ──────────────────────────────────────────────────────────

function compileWeeklyDigest(history5, allStates) {
    if (history5.length === 0) return null;

    // Weekly totals
    const weeklyFII = history5.reduce((sum, d) => sum + d.fii_net, 0);
    const weeklyDII = history5.reduce((sum, d) => sum + d.dii_net, 0);
    const weeklyNet = weeklyFII + weeklyDII;

    // Daily breakdown
    const dailyBreakdown = history5.map(d =>
        `  ${fmtDate(d.date)}: FII ${fmtCr(d.fii_net)} | DII ${fmtCr(d.dii_net)}`
    ).join('\n');

    // Streak state
    const streakState = allStates['fii-streak'] || {};
    const sellStreak = streakState.current_sell_streak || 0;
    const buyStreak = streakState.current_buy_streak || 0;
    const streakText = sellStreak > 0
        ? `🔴 FII sell streak: ${sellStreak} days (${fmtCr(streakState.sell_cumulative || 0)})`
        : buyStreak > 0
            ? `🟢 FII buy streak: ${buyStreak} days (${fmtCr(streakState.buy_cumulative || 0)})`
            : '⚪ No active streak';

    // Regime state
    const regimeState = allStates['regime-classifier'] || {};
    const regime = regimeState.regime || 'NEUTRAL';
    const regimeEmoji = REGIME_EMOJI[regime] || '⚪';
    const regimeLabel = REGIME_LABELS[regime] || regime;
    const regimeSince = regimeState.since || '';

    // Flow divergence state
    const divergeState = allStates['flow-divergence'] || {};
    const divergeSignal = divergeState.last_signal || 'NONE';

    // Sector rotation state
    const sectorState = allStates['sector-rotation'] || {};
    const topInflow = sectorState.top_inflow || 'N/A';
    const topOutflow = sectorState.top_outflow || 'N/A';
    const sustainedExits = sectorState.sustained_exits || [];

    // Best and worst day
    const bestDay = [...history5].sort((a, b) => b.fii_net - a.fii_net)[0];
    const worstDay = [...history5].sort((a, b) => a.fii_net - b.fii_net)[0];

    return {
        weeklyFII,
        weeklyDII,
        weeklyNet,
        dailyBreakdown,
        streakText,
        regime,
        regimeEmoji,
        regimeLabel,
        regimeSince,
        divergeSignal,
        topInflow,
        topOutflow,
        sustainedExits,
        bestDay,
        worstDay,
        tradingDays: history5.length,
        dateRange: `${fmtDate(history5[history5.length - 1]?.date)} — ${fmtDate(history5[0]?.date)}`
    };
}

// ── Main Agent Logic ─────────────────────────────────────────────────────────

async function run() {
    // Sessions of the latest trading WEEK (Mon–Fri of the newest session).
    // "Last 5 rows" spills into the previous week whenever a holiday shortens it.
    const { parseDate } = require('./agent-utils');
    const recent = getHistory(10);
    let history = recent.slice(0, 5);
    const newest = recent.length ? parseDate(recent[0].date) : null;
    if (newest) {
        const monday = new Date(newest.getTime() - ((newest.getUTCDay() + 6) % 7) * 86400000);
        history = recent.filter(d => { const t = parseDate(d.date); return t && t >= monday; });
    }
    if (history.length === 0) {
        return { items_found: 0, alerts_sent: 0, message: 'No history data available' };
    }

    // Gather all agent states for cross-referencing
    const { getAllStates } = require('./agent-utils');
    const allStates = getAllStates();

    const digest = compileWeeklyDigest(history, allStates);
    if (!digest) {
        return { items_found: 0, alerts_sent: 0, message: 'Failed to compile digest' };
    }

    // Send at most once per ISO week — this agent is also reachable via
    // /api/agents/run-all and `--agent=all`, which previously fired a digest
    // to the channel on every invocation
    const state = getState(AGENT_NAME);
    const weekKey = isoWeekKey(require('../lib/dates').istToday());
    let alertsSent = 0;
    if (state.last_digest_week !== weekKey) {
        console.log(`[${AGENT_NAME}] 📋 Weekly digest compiled (${digest.tradingDays} days, FII: ${fmtCr(digest.weeklyFII)})`);
    } else {
        console.log(`[${AGENT_NAME}] Digest already compiled for ${weekKey}`);
    }

    // Update state
    setState(AGENT_NAME, {
        last_digest_date: new Date().toISOString(),
        last_session_date: history[0]?.date || null,
        last_digest_week: weekKey,
        weekly_fii: digest.weeklyFII,
        weekly_dii: digest.weeklyDII,
        trading_days: digest.tradingDays,
        date_range: digest.dateRange
    });

    return {
        items_found: digest.tradingDays,
        alerts_sent: alertsSent,
        summary: {
            weekly_fii: fmtCr(digest.weeklyFII),
            weekly_dii: fmtCr(digest.weeklyDII),
            regime: digest.regime,
            streak: digest.streakText
        }
    };
}

module.exports = { run, AGENT_NAME };
