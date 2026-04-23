const { getState, setState, sendTelegramAlert } = require('./agent-utils');

/**
 * Confluence Detector Agent
 * Analyzes states of all other independent agents to find highly actionable signals
 * when 3+ indicators align. Sends a prioritized Telegram alert on matches.
 */

async function run() {
    console.log('[AGENT] Running Confluence Detector...');

    // Gather all agent states
    const streak = getState('fii-streak');
    const regime = getState('regime-classifier');
    const divergence = getState('flow-divergence');
    const strength = getState('flow-strength');
    let state = getState('confluence-detector');

    const confluences = [];

    // 1. CAPITULATION SIGNAL
    // Definition: Deep bearish regime, massive selling streak, and a panic flow divergence
    if (regime.regime === 'STRONG_BEARISH' || regime.regime === 'MILD_BEARISH') {
        let score = 0;
        let reasons = [];
        
        if (streak.current_sell_streak >= 5) {
            score++; reasons.push(`FII ${streak.current_sell_streak}-day sell streak 🔴`);
        }
        if (regime.regime === 'STRONG_BEARISH') {
            score++; reasons.push(`Regime is STRONG BEARISH 📉`);
        }
        if (divergence.last_signal === 'PANIC_MODE' && divergence.divergence_percentile > 80) {
            score++; reasons.push(`Panic divergence signal (P${divergence.divergence_percentile}) 🚨`);
        }
        const hasBloodbath = strength.last_alerted_events?.includes('FII_BLOODBATH');
        if (hasBloodbath) {
            score++; reasons.push(`Extreme FII cash selling detected today 🩸`);
        }

        // If at least 3 bearish indicators align, it's a Capitulation Confluence
        if (score >= 3) {
            confluences.push({
                type: 'CAPITULATION_SIGNAL',
                emoji: '🚨',
                title: 'CAPITULATION EVENT DETECTED',
                reasons: reasons,
                action: 'Extreme defensive posture recommended. Do not catch falling knives.'
            });
        }
    }

    // 2. RISK-ON PIVOT SIGNAL
    // Definition: Bullish regime shift with strong FII buying and euphoria divergence
    if (regime.regime === 'STRONG_BULLISH' || regime.regime === 'MILD_BULLISH') {
        let score = 0;
        let reasons = [];
        
        if (streak.current_buy_streak >= 3) {
            score++; reasons.push(`FII ${streak.current_buy_streak}-day buy streak 🟢`);
        }
        if (regime.regime === 'STRONG_BULLISH') {
            score++; reasons.push(`Regime is STRONG BULLISH 📈`);
        }
        if (divergence.last_signal === 'CONTRARIAN_BULLISH') {
            score++; reasons.push(`Contrarian Bullish flow divergence 🚀`);
        }
        const hasMassiveInflow = strength.last_alerted_events?.includes('MASSIVE_INFLOW');
        if (hasMassiveInflow) {
            score++; reasons.push(`Extreme cash inflows detected today 💸`);
        }

        if (score >= 3) {
            confluences.push({
                type: 'RISK_ON_PIVOT',
                emoji: '🔥',
                title: 'RISK-ON PIVOT DETECTED',
                reasons: reasons,
                action: 'Momentum is heavily skewed bullish. Look for breakout setups.'
            });
        }
    }

    // Check if we need to alert
    let alerts_sent = 0;
    const todayStr = new Date().toISOString().split('T')[0];

    if (confluences.length > 0) {
        // Only alert once per day per confluence type
        for (const conf of confluences) {
            const lastAlertDateStr = state[`last_${conf.type}_date`];
            if (lastAlertDateStr !== todayStr) {
                let msg = `<b>${conf.emoji} CONFLUENCE: ${conf.title} ${conf.emoji}</b>\n\n`;
                msg += `<i>Multiple independent agents have aligned to generate this high-conviction signal:</i>\n\n`;
                conf.reasons.forEach(r => msg += `• ${r}\n`);
                msg += `\n<b>Context:</b> ${conf.action}\n`;
                msg += `\n<a href="https://fii-diidata.mrchartist.com/">View Live Dashboard</a>`;

                await sendTelegramAlert(msg);
                alerts_sent++;

                state[`last_${conf.type}_date`] = todayStr;
                state.latest_signal = conf.type;
                state.latest_reasons = conf.reasons;
            }
        }
    }

    state.active_confluences = confluences.map(c => c.type);
    
    setState('confluence-detector', state);

    return {
        items_found: confluences.length,
        alerts_sent: alerts_sent,
        data: { list: confluences }
    };
}

module.exports = { run };
