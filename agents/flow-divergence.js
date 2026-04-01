// ── Flow Divergence Signal Agent ─────────────────────────────────────────────
// Phase 2B: Detects when FII and DII flow patterns diverge to historical extremes
//
// RULES:
//   1. FII selling heavily + DII absorbing 120%+ → CONTRARIAN_BULLISH
//   2. FII and DII both selling → PANIC_MODE
//   3. FII buying + DII selling → EUPHORIA_CHECK
//
// Uses 30-day rolling averages for signal stability

const {
    getState, setState, sendTelegramAlert,
    getHistory, fmtCr, fmtPct, fmtDate
} = require('./agent-utils');

const AGENT_NAME = 'flow-divergence';

// ── Signal Definitions ───────────────────────────────────────────────────────

const SIGNALS = {
    CONTRARIAN_BULLISH: {
        emoji: '🟢',
        label: 'CONTRARIAN BULLISH',
        description: 'FII selling heavily but DII absorbing 120%+ — domestic institutions confident despite foreign exits'
    },
    PANIC_MODE: {
        emoji: '🔴',
        label: 'PANIC MODE',
        description: 'Both FII and DII selling simultaneously — rare systemic risk indicator'
    },
    EUPHORIA_CHECK: {
        emoji: '🟡',
        label: 'EUPHORIA CHECK',
        description: 'FII buying but DII selling — foreign money inflowing while domestics reduce exposure'
    },
    NONE: {
        emoji: '⚪',
        label: 'NORMAL',
        description: 'No divergence signal — flows within normal range'
    }
};

// ── Divergence Analyzer ──────────────────────────────────────────────────────

function analyzeDivergence(history30) {
    if (history30.length < 10) return null;

    // 30-day rolling averages
    const avgFII = history30.reduce((sum, d) => sum + d.fii_net, 0) / history30.length;
    const avgDII = history30.reduce((sum, d) => sum + d.dii_net, 0) / history30.length;

    // Current day
    const today = history30[0];

    // 10-day window for signal generation (more responsive)
    const recent10 = history30.slice(0, Math.min(10, history30.length));
    const recentFII = recent10.reduce((sum, d) => sum + d.fii_net, 0);
    const recentDII = recent10.reduce((sum, d) => sum + d.dii_net, 0);

    // FII sell days vs DII sell days in recent window
    const fiSellDays = recent10.filter(d => d.fii_net < 0).length;
    const diSellDays = recent10.filter(d => d.dii_net < 0).length;

    // DII absorption percentage of FII selling
    const absorptionPct = Math.abs(recentFII) > 0
        ? Math.round(Math.abs(recentDII) / Math.abs(recentFII) * 100)
        : 0;

    // Historical divergence percentile
    const divergences = history30.map(d => Math.abs(d.fii_net - d.dii_net));
    const todayDivergence = Math.abs(today.fii_net - today.dii_net);
    const belowCount = divergences.filter(d => d <= todayDivergence).length;
    const percentile = Math.round((belowCount / divergences.length) * 100);

    // ── Signal Classification ────────────────────────────────────────────────

    let signal = 'NONE';

    // CONTRARIAN_BULLISH: FII selling + DII absorbing 120%+
    if (recentFII < -5000 && recentDII > 0 && absorptionPct >= 120) {
        signal = 'CONTRARIAN_BULLISH';
    }
    // PANIC_MODE: Both selling (at least 6 of 10 days each)
    else if (fiSellDays >= 6 && diSellDays >= 6 && recentFII < 0 && recentDII < 0) {
        signal = 'PANIC_MODE';
    }
    // EUPHORIA_CHECK: FII buying + DII selling
    else if (recentFII > 3000 && recentDII < -2000 && fiSellDays <= 3 && diSellDays >= 6) {
        signal = 'EUPHORIA_CHECK';
    }

    return {
        signal,
        today_fii: today.fii_net,
        today_dii: today.dii_net,
        today_divergence: todayDivergence,
        recent_fii_10d: Math.round(recentFII * 100) / 100,
        recent_dii_10d: Math.round(recentDII * 100) / 100,
        avg_fii_30d: Math.round(avgFII * 100) / 100,
        avg_dii_30d: Math.round(avgDII * 100) / 100,
        absorption_pct: absorptionPct,
        divergence_percentile: percentile,
        fii_sell_days_10: fiSellDays,
        dii_sell_days_10: diSellDays,
        date: today.date
    };
}

// ── Alert Builder ────────────────────────────────────────────────────────────

function buildDivergenceAlert(analysis) {
    const signalDef = SIGNALS[analysis.signal];

    return `${signalDef.emoji} FLOW DIVERGENCE — ${signalDef.label}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📅 ${fmtDate(analysis.date)}

${signalDef.description}

📊 10-Day Window:
  FII cumulative: ${fmtCr(analysis.recent_fii_10d)}
  DII cumulative: ${fmtCr(analysis.recent_dii_10d)}
  FII sell days: ${analysis.fii_sell_days_10}/10
  DII sell days: ${analysis.dii_sell_days_10}/10
  DII absorption: ${analysis.absorption_pct}%

📈 30-Day Averages:
  FII daily avg: ${fmtCr(analysis.avg_fii_30d)}
  DII daily avg: ${fmtCr(analysis.avg_dii_30d)}

📊 Today's Divergence:
  ₹${Math.round(analysis.today_divergence).toLocaleString('en-IN')} Cr
  Percentile: ${analysis.divergence_percentile}th (vs 30-day history)

🤖 Flow Divergence Agent
@Mr_Chartist`;
}

// ── Main Agent Logic ─────────────────────────────────────────────────────────

async function run() {
    const history = getHistory(30);
    if (history.length < 10) {
        return { items_found: 0, alerts_sent: 0, message: 'Insufficient history for divergence analysis' };
    }

    const state = getState(AGENT_NAME);
    const analysis = analyzeDivergence(history);
    if (!analysis) {
        return { items_found: 0, alerts_sent: 0, message: 'Analysis failed' };
    }

    let alertsSent = 0;

    // Alert only on new or changed signals
    const lastSignal = state.last_signal || 'NONE';
    const lastSignalDate = state.last_signal_date || '';

    if (analysis.signal !== 'NONE') {
        // New signal or signal changed
        if (analysis.signal !== lastSignal || analysis.date !== lastSignalDate) {
            const alert = buildDivergenceAlert(analysis);
            await sendTelegramAlert(alert);
            alertsSent++;
            console.log(`[${AGENT_NAME}] ${SIGNALS[analysis.signal].emoji} ${analysis.signal} detected`);
        }
    }

    // Update state
    setState(AGENT_NAME, {
        last_signal: analysis.signal,
        last_signal_date: analysis.date,
        today_divergence: analysis.today_divergence,
        divergence_percentile: analysis.divergence_percentile,
        absorption_pct: analysis.absorption_pct,
        avg_fii_30d: analysis.avg_fii_30d,
        avg_dii_30d: analysis.avg_dii_30d,
        last_run_date: analysis.date
    });

    return {
        items_found: analysis.signal !== 'NONE' ? 1 : 0,
        alerts_sent: alertsSent,
        signal: analysis.signal,
        divergence_value: analysis.today_divergence,
        percentile: analysis.divergence_percentile
    };
}

module.exports = { run, analyzeDivergence, AGENT_NAME };
