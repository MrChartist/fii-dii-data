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
// FORMAT: Structured Telegram digest

const {
    getState, setState, sendTelegramAlert,
    getHistory, fmtCr, fmtDate,
    REGIME_EMOJI, REGIME_LABELS
} = require('./agent-utils');

const AGENT_NAME = 'weekly-digest';

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

// ── Alert Builder ────────────────────────────────────────────────────────────

function buildDigestAlert(digest) {
    let sectorSection = '';
    if (digest.topInflow !== 'N/A' || digest.topOutflow !== 'N/A') {
        sectorSection = `
🏦 Sector Highlights:
  📈 Top Inflow: ${digest.topInflow}
  📉 Top Outflow: ${digest.topOutflow}`;

        if (digest.sustainedExits.length > 0) {
            sectorSection += `\n  ⚠️ Sustained exits: ${digest.sustainedExits.join(', ')}`;
        }
    }

    const divergeText = digest.divergeSignal !== 'NONE'
        ? `\n⚡ Divergence: ${digest.divergeSignal.replace(/_/g, ' ')}`
        : '';

    return `📋 WEEKLY INSTITUTIONAL DIGEST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📅 ${digest.dateRange} (${digest.tradingDays} trading days)

💰 Weekly Totals:
  FII Net: ${fmtCr(digest.weeklyFII)}
  DII Net: ${fmtCr(digest.weeklyDII)}
  Combined: ${fmtCr(digest.weeklyNet)}

📉 Daily Breakdown:
${digest.dailyBreakdown}

📊 Best FII Day: ${fmtDate(digest.bestDay?.date)} (${fmtCr(digest.bestDay?.fii_net || 0)})
📉 Worst FII Day: ${fmtDate(digest.worstDay?.date)} (${fmtCr(digest.worstDay?.fii_net || 0)})

🔥 Streaks:
  ${digest.streakText}

🏷️ Regime: ${digest.regimeEmoji} ${digest.regimeLabel}${digest.regimeSince ? ` (since ${fmtDate(digest.regimeSince)})` : ''}${divergeText}
${sectorSection}

🤖 Weekly Institutional Digest
@Mr_Chartist`;
}

// ── Main Agent Logic ─────────────────────────────────────────────────────────

async function run() {
    // Get last 5 trading days
    const history = getHistory(5);
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

    // Always send the weekly digest (it's scheduled weekly)
    const alert = buildDigestAlert(digest);
    await sendTelegramAlert(alert);
    console.log(`[${AGENT_NAME}] 📋 Weekly digest sent (${digest.tradingDays} days, FII: ${fmtCr(digest.weeklyFII)})`);

    // Update state
    setState(AGENT_NAME, {
        last_digest_date: new Date().toISOString(),
        weekly_fii: digest.weeklyFII,
        weekly_dii: digest.weeklyDII,
        trading_days: digest.tradingDays,
        date_range: digest.dateRange
    });

    return {
        items_found: digest.tradingDays,
        alerts_sent: 1,
        summary: {
            weekly_fii: fmtCr(digest.weeklyFII),
            weekly_dii: fmtCr(digest.weeklyDII),
            regime: digest.regime,
            streak: digest.streakText
        }
    };
}

module.exports = { run, AGENT_NAME };
