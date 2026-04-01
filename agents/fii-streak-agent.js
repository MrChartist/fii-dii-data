// ── FII Sell/Buy Streak Detector ─────────────────────────────────────────────
// Phase 1A: Detects sustained FII selling/buying pressure
//
// PERCEPTION: Reads history data after each post-market fetch
// REASONING:
//   Rule 1: FII net selling ≥ 5 consecutive days → ⚠️ WARNING
//   Rule 2: FII net selling ≥ 10 consecutive days → 🚨 CRITICAL
//   Rule 3: Cumulative sell volume in streak > ₹20,000 Cr → 🔴 EXTREME
//   Rule 4: DII absorption < 50% of FII sell → "DII not absorbing — RISK"
//   Rule 5: DII absorption > 100% of FII sell → "DII fully absorbing — STABLE"
// ACTION: Telegram alert with streak count, daily breakdown, absorption ratio

const {
    getState, setState, sendTelegramAlert,
    getHistory, fmtCr, fmtDate, REGIME_EMOJI
} = require('./agent-utils');

const AGENT_NAME = 'fii-streak';

// ── Streak Calculator ────────────────────────────────────────────────────────

function calculateStreaks(history) {
    if (!history.length) return { sell: null, buy: null };

    // Walk from newest → oldest counting consecutive days
    const calcStreak = (isMatch) => {
        let streak = 0;
        let cumulativeFII = 0;
        let cumulativeDII = 0;
        const days = [];

        for (const day of history) {
            if (isMatch(day)) {
                streak++;
                cumulativeFII += day.fii_net;
                cumulativeDII += day.dii_net;
                days.push({
                    date: day.date,
                    fii_net: day.fii_net,
                    dii_net: day.dii_net
                });
            } else {
                break;
            }
        }

        if (streak === 0) return null;

        const absorptionPct = Math.abs(cumulativeFII) > 0
            ? Math.round(Math.abs(cumulativeDII) / Math.abs(cumulativeFII) * 100)
            : 0;

        return {
            length: streak,
            cumulative_fii: Math.round(cumulativeFII * 100) / 100,
            cumulative_dii: Math.round(cumulativeDII * 100) / 100,
            absorption_pct: absorptionPct,
            days
        };
    };

    return {
        sell: calcStreak(day => day.fii_net < 0),
        buy: calcStreak(day => day.fii_net > 0)
    };
}

// ── Alert Builder ────────────────────────────────────────────────────────────

function buildStreakAlert(type, streak) {
    const isSell = type === 'sell';
    const emoji = isSell ? '🔴' : '🟢';
    const direction = isSell ? 'SELL' : 'BUY';
    const flowWord = isSell ? 'outflow' : 'inflow';

    // Determine severity
    let severity = '⚠️ WARNING';
    if (streak.length >= 10) severity = '🚨 CRITICAL';
    if (Math.abs(streak.cumulative_fii) > 20000) severity = '🔴 EXTREME';

    // DII response analysis
    let diiStatus = '';
    if (isSell) {
        if (streak.absorption_pct > 100) {
            diiStatus = '✅ DII fully absorbing → STABLE';
        } else if (streak.absorption_pct >= 50) {
            diiStatus = `⚠️ DII partially absorbing (${streak.absorption_pct}%)`;
        } else {
            diiStatus = `🔴 DII not absorbing (${streak.absorption_pct}%) → RISK`;
        }
    } else {
        diiStatus = `DII net: ${fmtCr(streak.cumulative_dii)}`;
    }

    // Daily breakdown (max 10 days)
    const breakdownDays = streak.days.slice(0, 10);
    const breakdown = breakdownDays.map((d, i) =>
        `  Day ${streak.length - i}: ${fmtCr(d.fii_net)} (${fmtDate(d.date)})`
    ).join('\n');

    return `${emoji} FII ${direction} STREAK — DAY ${streak.length}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${severity}

📊 ${streak.length} consecutive days of FII ${direction.toLowerCase()}ing
💰 Cumulative ${flowWord}: ${fmtCr(streak.cumulative_fii)}

📉 Daily Breakdown:
${breakdown}

🛡️ DII Response:
  DII net: ${fmtCr(streak.cumulative_dii)} (${streak.absorption_pct}%)
  ${diiStatus}

🤖 FII Streak Detector
@Mr_Chartist`;
}

// ── Main Agent Logic ─────────────────────────────────────────────────────────

async function run() {
    const history = getHistory(30);
    if (history.length < 2) {
        return { items_found: 0, alerts_sent: 0, message: 'Insufficient history' };
    }

    const state = getState(AGENT_NAME);
    const streaks = calculateStreaks(history);
    let alertsSent = 0;

    // Process sell streak
    if (streaks.sell && streaks.sell.length >= 5) {
        const lastAlertedSell = state.last_alerted_sell_streak || 0;

        if (streaks.sell.length > lastAlertedSell) {
            const alert = buildStreakAlert('sell', streaks.sell);
            await sendTelegramAlert(alert);
            alertsSent++;
            console.log(`[${AGENT_NAME}] 🔴 FII sell streak: ${streaks.sell.length} days, cumulative: ${fmtCr(streaks.sell.cumulative_fii)}`);
        }
    }

    // Process buy streak
    if (streaks.buy && streaks.buy.length >= 5) {
        const lastAlertedBuy = state.last_alerted_buy_streak || 0;

        if (streaks.buy.length > lastAlertedBuy) {
            const alert = buildStreakAlert('buy', streaks.buy);
            await sendTelegramAlert(alert);
            alertsSent++;
            console.log(`[${AGENT_NAME}] 🟢 FII buy streak: ${streaks.buy.length} days, cumulative: ${fmtCr(streaks.buy.cumulative_fii)}`);
        }
    }

    // Update state
    setState(AGENT_NAME, {
        last_alerted_sell_streak: streaks.sell ? streaks.sell.length : 0,
        last_alerted_buy_streak: streaks.buy ? streaks.buy.length : 0,
        current_sell_streak: streaks.sell ? streaks.sell.length : 0,
        current_buy_streak: streaks.buy ? streaks.buy.length : 0,
        sell_cumulative: streaks.sell ? streaks.sell.cumulative_fii : 0,
        buy_cumulative: streaks.buy ? streaks.buy.cumulative_fii : 0,
        sell_absorption_pct: streaks.sell ? streaks.sell.absorption_pct : 0,
        buy_absorption_pct: streaks.buy ? streaks.buy.absorption_pct : 0,
        last_run_date: history[0]?.date || ''
    });

    return {
        items_found: (streaks.sell?.length || 0) + (streaks.buy?.length || 0),
        alerts_sent: alertsSent,
        fii_sell_streak: streaks.sell?.length || 0,
        fii_buy_streak: streaks.buy?.length || 0,
        cumulative_sell: streaks.sell?.cumulative_fii || 0,
        cumulative_buy: streaks.buy?.cumulative_fii || 0,
        dii_absorption_pct: streaks.sell?.absorption_pct || 0
    };
}

module.exports = { run, calculateStreaks, AGENT_NAME };
