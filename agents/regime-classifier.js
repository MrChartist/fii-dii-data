// ── Market Regime Classifier Agent ───────────────────────────────────────────
// Phase 1B: Classifies institutional environment into 5 regimes
//
// REGIMES:
//   🟢 STRONG_BULLISH  — FII buying + DII buying (both net positive ≥ 5 of last 10 days)
//   🟡 MILD_BULLISH    — FII mixed + DII buying OR FII buying alone
//   ⚪ NEUTRAL          — No clear trend (alternating days, small flows)
//   🟠 MILD_BEARISH    — FII selling < 5 consecutive days OR moderate outflow
//   🔴 STRONG_BEARISH  — FII selling streak ≥ 5 days + cumulative > ₹10k Cr
//
// Alerts only on REGIME TRANSITIONS

const {
    getState, setState, sendTelegramAlert,
    getHistory, fetchVIX, fmtCr, fmtDate,
    REGIME_EMOJI, REGIME_LABELS
} = require('./agent-utils');

const AGENT_NAME = 'regime-classifier';

// ── Regime Recommendations ───────────────────────────────────────────────────

const RECOMMENDATIONS = {
    'STRONG_BULLISH':  'Risk-on environment. Favor momentum strategies, increase position sizes.',
    'MILD_BULLISH':    'Cautiously optimistic. Standard position sizing, favor quality setups.',
    'NEUTRAL':         'Mixed signals. Reduce exposure, wait for clarity before committing.',
    'MILD_BEARISH':    'Defensive posture. Tighten stops, reduce new entries, hedge existing positions.',
    'STRONG_BEARISH':  'Reduce risk, tighten stops. Favor hedging and short-selling strategies.'
};

// ── Regime Classifier ────────────────────────────────────────────────────────

function classifyRegime(history10, vix) {
    if (history10.length < 5) return 'NEUTRAL';

    // Calculate metrics
    const fiiBuyDays = history10.filter(d => d.fii_net > 0).length;
    const fiiSellDays = history10.filter(d => d.fii_net < 0).length;
    const diiBuyDays = history10.filter(d => d.dii_net > 0).length;
    const diiSellDays = history10.filter(d => d.dii_net < 0).length;

    const fiiCumulative = history10.reduce((sum, d) => sum + d.fii_net, 0);
    const diiCumulative = history10.reduce((sum, d) => sum + d.dii_net, 0);

    // FII consecutive selling streak (from newest)
    let fiiSellStreak = 0;
    for (const day of history10) {
        if (day.fii_net < 0) fiiSellStreak++;
        else break;
    }

    // FII consecutive buying streak (from newest)
    let fiiBuyStreak = 0;
    for (const day of history10) {
        if (day.fii_net > 0) fiiBuyStreak++;
        else break;
    }

    // VIX elevated check (VIX > 20 adds bearish weight)
    const vixElevated = vix > 20;

    // ── Classification Logic ─────────────────────────────────────────────────

    // 🔴 STRONG_BEARISH: FII selling streak ≥ 5 days + cumulative > ₹10k Cr
    if (fiiSellStreak >= 5 && Math.abs(fiiCumulative) > 10000) {
        return 'STRONG_BEARISH';
    }

    // 🟢 STRONG_BULLISH: Both FII and DII buying majority of days
    if (fiiBuyDays >= 5 && diiBuyDays >= 5 && fiiCumulative > 0 && diiCumulative > 0) {
        return 'STRONG_BULLISH';
    }

    // 🟠 MILD_BEARISH: FII selling but not extreme, or elevated VIX
    if (fiiSellStreak >= 3 || (fiiSellDays >= 6 && fiiCumulative < -5000)) {
        return 'MILD_BEARISH';
    }
    if (fiiCumulative < -5000 && vixElevated) {
        return 'MILD_BEARISH';
    }

    // 🟡 MILD_BULLISH: FII mixed but DII buying, or FII buying alone
    if (fiiBuyDays >= 4 || (diiBuyDays >= 6 && fiiCumulative > -2000)) {
        return 'MILD_BULLISH';
    }

    // ⚪ NEUTRAL: default — mixed signals
    return 'NEUTRAL';
}

// ── Alert Builder ────────────────────────────────────────────────────────────

function buildTransitionAlert(prevRegime, newRegime, metrics) {
    const prevEmoji = REGIME_EMOJI[prevRegime] || '⚪';
    const newEmoji = REGIME_EMOJI[newRegime] || '⚪';
    const prevLabel = REGIME_LABELS[prevRegime] || prevRegime;
    const newLabel = REGIME_LABELS[newRegime] || newRegime;

    return `⚡ REGIME SHIFT DETECTED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${prevEmoji} ${prevLabel} → ${newEmoji} ${newLabel}

📊 What changed (10-day window):
  • FII net: ${fmtCr(metrics.fii_cumulative)}
  • DII net: ${fmtCr(metrics.dii_cumulative)}
  • FII sell streak: ${metrics.fii_sell_streak} days
  • FII buy days: ${metrics.fii_buy_days}/10
  • DII buy days: ${metrics.dii_buy_days}/10
  ${metrics.vix > 0 ? `• VIX: ${metrics.vix.toFixed(1)}` : ''}

💡 Recommendation:
  ${RECOMMENDATIONS[newRegime]}

💡 Ecosystem Impact:
  📌 Corporate Decode: ${newRegime.includes('BEARISH') ? 'Filtering for defensive filings' : 'Standard filing alerts'}
  📌 OptionsDesk: ${newRegime.includes('BEARISH') ? 'GEX sensitivity increased' : 'Normal GEX parameters'}
  📌 TradeBook: ${newRegime.includes('BEARISH') ? 'Risk limits tightened' : 'Standard risk limits'}
  📌 Scanner: ${newRegime.includes('BEARISH') ? 'Prioritizing short-selling setups' : 'Standard breakout scans'}

🤖 Regime Classifier Agent
@Mr_Chartist`;
}

// ── Main Agent Logic ─────────────────────────────────────────────────────────

async function run() {
    const history = getHistory(10);
    if (history.length < 5) {
        return { items_found: 0, alerts_sent: 0, message: 'Insufficient history for regime classification' };
    }

    // Fetch VIX (non-critical — defaults to 0 if unavailable)
    const vix = await fetchVIX();

    // Classify
    const regime = classifyRegime(history, vix);
    const state = getState(AGENT_NAME);
    const previousRegime = state.regime || 'NEUTRAL';
    const transitioned = regime !== previousRegime;
    let alertsSent = 0;

    // Calculate metrics for state + alerts
    const fiiCumulative = history.reduce((sum, d) => sum + d.fii_net, 0);
    const diiCumulative = history.reduce((sum, d) => sum + d.dii_net, 0);
    const absorptionPct = Math.abs(fiiCumulative) > 0
        ? Math.round(Math.abs(diiCumulative) / Math.abs(fiiCumulative) * 100)
        : 0;

    let fiiSellStreak = 0;
    for (const day of history) {
        if (day.fii_net < 0) fiiSellStreak++;
        else break;
    }

    const fiiBuyDays = history.filter(d => d.fii_net > 0).length;
    const diiBuyDays = history.filter(d => d.dii_net > 0).length;

    const metrics = {
        fii_cumulative: Math.round(fiiCumulative * 100) / 100,
        dii_cumulative: Math.round(diiCumulative * 100) / 100,
        fii_sell_streak: fiiSellStreak,
        fii_buy_days: fiiBuyDays,
        dii_buy_days: diiBuyDays,
        vix
    };

    // Alert on transition
    if (transitioned) {
        const alert = buildTransitionAlert(previousRegime, regime, metrics);
        await sendTelegramAlert(alert);
        alertsSent++;
        console.log(`[${AGENT_NAME}] ⚡ Regime transition: ${previousRegime} → ${regime}`);
    } else {
        console.log(`[${AGENT_NAME}] Regime unchanged: ${regime}`);
    }

    // Update state (always — even if no transition)
    setState(AGENT_NAME, {
        regime,
        since: transitioned ? (history[0]?.date || '') : (state.since || history[0]?.date || ''),
        previous_regime: previousRegime,
        fii_streak: fiiSellStreak > 0 ? -fiiSellStreak : (history[0]?.fii_net > 0 ? 1 : 0),
        dii_absorption_pct: absorptionPct,
        vix,
        recommendation: RECOMMENDATIONS[regime],
        fii_cumulative_10d: metrics.fii_cumulative,
        dii_cumulative_10d: metrics.dii_cumulative,
        last_run_date: history[0]?.date || ''
    });

    return {
        items_found: 1,
        alerts_sent: alertsSent,
        regime,
        previous_regime: previousRegime,
        transitioned,
        recommendation: RECOMMENDATIONS[regime]
    };
}

module.exports = { run, classifyRegime, AGENT_NAME };
