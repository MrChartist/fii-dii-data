// ── Telegram Message Builders — Professional institutional-grade alerts ──────
// Each function returns a formatted HTML string for Telegram
// All messages include FlowMatrix branding header + footer

const { fmtCr, REGIME_EMOJI, REGIME_LABELS } = require('./agents/agent-utils');

const BRAND = '◈ 𝗙𝗟𝗢𝗪𝗠𝗔𝗧𝗥𝗜𝗫';
const LINE  = '━━━━━━━━━━━━━━━━━━━━';
const THIN  = '─ ─ ─ ─ ─ ─ ─ ─ ─ ─';

const fmtK = v => `${v >= 0 ? '+' : ''}${(v / 1000).toFixed(1)}K`;
const fmtL = v => `${v >= 0 ? '+' : ''}${(v / 100000).toFixed(1)}L`;
const dot  = v => v >= 0 ? '🟢' : '🔴';

// Compute net from long/short if _net field missing
function net(d, prefix) {
    const n = d[`${prefix}_net`];
    if (n !== undefined && n !== null) return n;
    const l = d[`${prefix}_long`] || 0;
    const s = d[`${prefix}_short`] || 0;
    return l - s;
}

function footer() {
    return `\n${LINE}\n` +
        `${BRAND} <b>by Mr. Chartist</b>\n` +
        `🌐 <a href="https://fii-diidata.mrchartist.com">Open Live Dashboard</a>\n` +
        `📢 <a href="https://t.me/official_mrchartist">Join @official_mrchartist</a> for more market updates`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. POST-MARKET CASH FLOW UPDATE
// ─────────────────────────────────────────────────────────────────────────────
function buildCashFlowMessage(data, regime, streak, flowStrength) {
    const fn = data.fii_net || 0;
    const dn = data.dii_net || 0;
    const netLiq = fn + dn;
    const absorption = fn !== 0 ? Math.round((Math.abs(dn) / Math.abs(fn)) * 100) : 0;

    let msg = `${BRAND}\n`;
    msg += `📊 <b>INSTITUTIONAL CASH FLOWS</b>\n`;
    msg += `📅 <i>${data.date}</i>\n`;
    msg += `${LINE}\n\n`;

    // FII
    msg += `<b>🏦 FII (Foreign Institutional Investors)</b>\n`;
    msg += `    ├ Buy:  ₹${Math.abs(data.fii_buy || 0).toLocaleString('en-IN')} Cr\n`;
    msg += `    ├ Sell: ₹${Math.abs(data.fii_sell || 0).toLocaleString('en-IN')} Cr\n`;
    msg += `    └ ${dot(fn)} Net:  <b>${fmtCr(fn)}</b>\n\n`;

    // DII
    msg += `<b>🏛️ DII (Domestic Institutional Investors)</b>\n`;
    msg += `    ├ Buy:  ₹${Math.abs(data.dii_buy || 0).toLocaleString('en-IN')} Cr\n`;
    msg += `    ├ Sell: ₹${Math.abs(data.dii_sell || 0).toLocaleString('en-IN')} Cr\n`;
    msg += `    └ ${dot(dn)} Net:  <b>${fmtCr(dn)}</b>\n\n`;

    // Net Liquidity
    msg += `${THIN}\n`;
    msg += `${dot(netLiq)} <b>NET MARKET LIQUIDITY: ${fmtCr(netLiq)}</b>\n`;
    if (fn < 0 && dn > 0) {
        msg += `🛡️ DII Absorption Rate: <b>${absorption}%</b>\n`;
    }
    msg += `${THIN}\n\n`;

    // Intelligence
    msg += `<b>🧠 AGENTIC INTELLIGENCE</b>\n\n`;

    if (regime && regime.regime) {
        const emoji = REGIME_EMOJI[regime.regime] || '⚪';
        const label = REGIME_LABELS[regime.regime] || regime.regime;
        msg += `  📍 Regime: ${emoji} <b>${label}</b>`;
        if (regime.vix) msg += `  ·  VIX: ${regime.vix}`;
        msg += `\n`;
        if (regime.recommendation) msg += `  💡 <i>${regime.recommendation}</i>\n`;
    }

    if (streak) {
        if (streak.current_sell_streak > 2) {
            msg += `  🔥 FII Sell Streak: <b>${streak.current_sell_streak} Days</b> (Cumulative: ${fmtCr(streak.sell_cumulative || 0)})`;
            if (streak.sell_absorption_pct) msg += ` · DII absorbed ${streak.sell_absorption_pct}%`;
            msg += `\n`;
        } else if (streak.current_buy_streak > 2) {
            msg += `  🚀 FII Buy Streak: <b>${streak.current_buy_streak} Days</b> (Cumulative: ${fmtCr(streak.buy_cumulative || 0)})\n`;
        }
    }

    // Extreme Events
    if (flowStrength && flowStrength.last_alerted_events && flowStrength.last_alerted_date === data.date) {
        const labels = {
            FII_MASSIVE_BUY: '💰 FII Massive Buy',
            FII_BLOODBATH: '🩸 FII Bloodbath Selling',
            DII_MASSIVE_ABSORB: '🛡️ DII Massive Absorption',
            EXTREME_DIVERGENCE: '⚡ Extreme FII-DII Divergence'
        };
        const events = flowStrength.last_alerted_events.map(e => labels[e] || e);
        if (events.length) {
            msg += `\n  ⚠️ <b>EXTREME EVENTS DETECTED:</b>\n`;
            events.forEach(e => { msg += `      ▸ ${e}\n`; });
        }
    }

    msg += footer();
    return msg;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. F&O DERIVATIVES POSITIONING
// ─────────────────────────────────────────────────────────────────────────────
function buildDerivativesMessage(data) {
    const pcr = data.pcr || 0;
    const sentScore = data.sentiment_score || 0;

    // Sentiment
    let sentLabel = '⚪ Neutral', sentBar = '▓▓▓▓▓░░░░░';
    if (sentScore > 60) { sentLabel = '🟢 Bullish'; sentBar = '▓▓▓▓▓▓▓▓░░'; }
    else if (sentScore > 50) { sentLabel = '🟡 Mildly Bullish'; sentBar = '▓▓▓▓▓▓░░░░'; }
    else if (sentScore < 35) { sentLabel = '🔴 Bearish'; sentBar = '▓▓░░░░░░░░'; }
    else if (sentScore < 45) { sentLabel = '🟠 Mildly Bearish'; sentBar = '▓▓▓░░░░░░░'; }

    // PCR
    let pcrLabel = '⚪ Neutral';
    if (pcr < 0.5) pcrLabel = '🔴 Extreme Fear';
    else if (pcr < 0.7) pcrLabel = '🟠 Bearish';
    else if (pcr < 0.9) pcrLabel = '⚪ Neutral';
    else if (pcr < 1.2) pcrLabel = '🟡 Mildly Bullish';
    else pcrLabel = '🟢 Bullish / Hedged';

    let msg = `${BRAND}\n`;
    msg += `📈 <b>F&O DERIVATIVES POSITIONING</b>\n`;
    msg += `📅 <i>${data.date}</i>\n`;
    msg += `${LINE}\n\n`;

    // Sentiment Gauge
    msg += `<b>📊 SENTIMENT OVERVIEW</b>\n`;
    msg += `    Score: <b>${sentScore}/100</b> ${sentLabel}\n`;
    msg += `    [${sentBar}]\n`;
    msg += `    PCR: <b>${pcr}</b> — ${pcrLabel}\n\n`;

    // FII Index Futures
    const futNet = net(data, 'fii_idx_fut');
    msg += `<b>🏦 FII INDEX FUTURES</b>\n`;
    msg += `    ├ Long:  ${fmtK(data.fii_idx_fut_long || 0)} contracts\n`;
    msg += `    ├ Short: ${fmtK(data.fii_idx_fut_short || 0)} contracts\n`;
    msg += `    └ ${dot(futNet)} Net: <b>${fmtK(futNet)}</b>`;
    msg += ` ${futNet < 0 ? '⬇️ SHORT HEAVY' : '⬆️ LONG HEAVY'}\n\n`;

    // FII Index Options
    const callNet = net(data, 'fii_idx_call');
    const putNet = net(data, 'fii_idx_put');
    msg += `<b>📋 FII INDEX OPTIONS</b>\n`;
    msg += `    ├ Call Net: ${fmtK(callNet)} `;
    msg += callNet < 0 ? '(Writing = Bearish)\n' : '(Buying = Bullish)\n';
    msg += `    └ Put Net:  ${fmtK(putNet)} `;
    msg += putNet > 0 ? '(Buying = Hedging)\n\n' : '(Writing = Bullish)\n\n';

    // FII Stock Futures
    const stkNet = net(data, 'fii_stk_fut');
    msg += `<b>📦 FII STOCK FUTURES</b>\n`;
    msg += `    ├ Long:  ${fmtL(data.fii_stk_fut_long || 0)}\n`;
    msg += `    ├ Short: ${fmtL(data.fii_stk_fut_short || 0)}\n`;
    msg += `    └ ${dot(stkNet)} Net: <b>${fmtL(stkNet)}</b>\n\n`;

    // DII
    const diiIdxNet = net(data, 'dii_idx_fut');
    const diiStkNet = net(data, 'dii_stk_fut');
    msg += `<b>🏛️ DII POSITIONING</b>\n`;
    msg += `    ├ Index Fut Net: ${fmtK(diiIdxNet)} ${dot(diiIdxNet)}\n`;
    msg += `    └ Stock Fut Net: ${fmtL(diiStkNet)} ${dot(diiStkNet)}\n\n`;

    // Bottom Line
    msg += `${THIN}\n`;
    msg += `<b>⚡ BOTTOM LINE:</b> `;
    if (sentScore < 35) msg += '🔴 Bears in control. FII heavily short. Caution.';
    else if (sentScore < 45) msg += '🟠 Mild bearish tilt. Watch for capitulation.';
    else if (sentScore < 55) msg += '⚪ Mixed signals. No clear directional bias.';
    else if (sentScore < 65) msg += '🟡 Mild bullish tilt. Follow-through needed.';
    else msg += '🟢 Bulls dominant. Strong long positioning across segments.';
    msg += `\n${THIN}`;

    msg += footer();
    return msg;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. SECTOR ROTATION
// ─────────────────────────────────────────────────────────────────────────────
function buildSectorMessage(sectorData, rotationState) {
    const sectors = sectorData.sectors || [];
    if (!sectors.length) return null;

    const sorted = [...sectors].sort((a, b) => b.equity_net_inr - a.equity_net_inr);
    const topInflows = sorted.slice(0, 5);
    const topOutflows = sorted.slice(-5).reverse();
    const totalAuc = sectors.reduce((s, x) => s + (x.equity_auc_inr || 0), 0);
    const totalNet = sectors.reduce((s, x) => s + (x.equity_net_inr || 0), 0);

    let msg = `${BRAND}\n`;
    msg += `🏦 <b>SECTOR ROTATION — FPI ALLOCATION</b>\n`;
    msg += `📅 <i>NSDL Data: ${sectorData.date_code || 'Latest'}</i>\n`;
    msg += `${LINE}\n\n`;

    // Overview
    msg += `<b>📊 FPI PORTFOLIO SNAPSHOT</b>\n`;
    msg += `    Total AUC: ₹${(totalAuc / 100).toFixed(0)}K Cr\n`;
    msg += `    Net Equity Flow: ${dot(totalNet)} <b>${fmtCr(totalNet)}</b>\n`;
    msg += `    Sectors Tracked: ${sectors.length}\n\n`;

    // Top Inflows
    msg += `<b>🟢 TOP 5 INFLOWS (FPI Buying)</b>\n`;
    topInflows.forEach((s, i) => {
        const icon = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'][i];
        msg += `   ${icon} ${s.sector}\n        → <b>${fmtCr(s.equity_net_inr)}</b>\n`;
    });

    msg += `\n<b>🔴 TOP 5 OUTFLOWS (FPI Selling)</b>\n`;
    topOutflows.forEach((s, i) => {
        const icon = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'][i];
        msg += `   ${icon} ${s.sector}\n        → <b>${fmtCr(s.equity_net_inr)}</b>\n`;
    });

    // Rotation signals
    if (rotationState) {
        const hasEntries = rotationState.sustained_entries?.length;
        const hasExits = rotationState.sustained_exits?.length;
        if (hasEntries || hasExits) {
            msg += `\n<b>🔄 ROTATION SIGNALS</b>\n`;
            if (hasEntries) msg += `   📥 Sustained Entry: <b>${rotationState.sustained_entries.join(', ')}</b>\n`;
            if (hasExits) msg += `   📤 Sustained Exit: <b>${rotationState.sustained_exits.join(', ')}</b>\n`;
        }
    }

    msg += footer();
    return msg;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. WEEKLY DIGEST
// ─────────────────────────────────────────────────────────────────────────────
function buildWeeklyDigestMessage(digestState, regime, streak, history5d) {
    const wFii = digestState.weekly_fii || 0;
    const wDii = digestState.weekly_dii || 0;
    const wNet = wFii + wDii;
    const days = digestState.trading_days || 5;
    const range = digestState.date_range || 'This Week';

    let msg = `${BRAND}\n`;
    msg += `📅 <b>WEEKLY INSTITUTIONAL DIGEST</b>\n`;
    msg += `📆 <i>${range} (${days} trading days)</i>\n`;
    msg += `${LINE}\n\n`;

    // Weekly Totals
    msg += `<b>💰 WEEKLY CASH FLOWS</b>\n`;
    msg += `    ${dot(wFii)} FII Weekly: <b>${fmtCr(wFii)}</b>\n`;
    msg += `    ${dot(wDii)} DII Weekly: <b>${fmtCr(wDii)}</b>\n`;
    msg += `    ${dot(wNet)} Net Flow:   <b>${fmtCr(wNet)}</b>\n\n`;

    // Daily Avg
    msg += `<b>📊 DAILY AVERAGES</b>\n`;
    msg += `    FII Avg/Day: ${fmtCr(Math.round(wFii / days))}\n`;
    msg += `    DII Avg/Day: ${fmtCr(Math.round(wDii / days))}\n\n`;

    // Breakdown
    if (history5d && history5d.length) {
        msg += `<b>📋 DAILY BREAKDOWN</b>\n`;
        msg += `<pre>`;
        msg += `Date          FII         DII\n`;
        history5d.slice(0, days).forEach(d => {
            const fn = d.fii_net || 0;
            const dn = d.dii_net || 0;
            const dateStr = (d.date || '').padEnd(13);
            msg += `${dateStr} ${fmtCr(fn).padStart(10)}  ${fmtCr(dn).padStart(10)}\n`;
        });
        msg += `</pre>\n`;
    }

    // Regime
    msg += `<b>🧠 WEEK-END REGIME</b>\n`;
    if (regime && regime.regime) {
        const emoji = REGIME_EMOJI[regime.regime] || '⚪';
        const label = REGIME_LABELS[regime.regime] || regime.regime;
        msg += `    ${emoji} <b>${label}</b>`;
        if (regime.vix) msg += ` · VIX: ${regime.vix}`;
        msg += `\n`;
    }
    if (streak) {
        if (streak.current_sell_streak > 0) msg += `    📉 FII Sell Streak: ${streak.current_sell_streak} days\n`;
        else if (streak.current_buy_streak > 0) msg += `    📈 FII Buy Streak: ${streak.current_buy_streak} days\n`;
    }

    // Outlook
    msg += `\n${THIN}\n`;
    msg += `<b>📝 WEEK SUMMARY:</b> `;
    if (wFii < -10000) msg += 'Heavy FII selling. Watch DII absorption sustainability.';
    else if (wFii < -5000) msg += 'Moderate FII outflows. Institutional pressure persists.';
    else if (wFii > 5000) msg += 'Strong FII inflows. Bullish institutional sentiment.';
    else if (wFii > 0 && wDii > 0) msg += 'Both FII & DII buying. Double institutional support.';
    else msg += 'Balanced week. No extreme institutional positioning.';
    msg += `\n${THIN}`;

    msg += footer();
    return msg;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. CONTRARIAN / DIVERGENCE ALERT
// ─────────────────────────────────────────────────────────────────────────────
function buildDivergenceMessage(divState, data) {
    const signal = divState.last_signal || 'NONE';
    const pct = divState.divergence_percentile || 0;
    const abs = divState.absorption_pct || 0;

    let msg = `${BRAND}\n`;
    msg += `⚡ <b>CONTRARIAN SIGNAL DETECTED</b>\n`;
    msg += `📅 <i>${divState.last_signal_date || data?.date || 'Today'}</i>\n`;
    msg += `${LINE}\n\n`;

    if (signal === 'CONTRARIAN_BULLISH') {
        msg += `🟢 <b>CONTRARIAN BULLISH SIGNAL</b>\n\n`;
        msg += `FII is selling aggressively, but DII absorption exceeds the selling pressure. `;
        msg += `This divergence is at the <b>${pct}th percentile</b> vs 30-day history — historically, `;
        msg += `such extremes have preceded upward reversals.\n\n`;
    } else if (signal === 'CONTRARIAN_BEARISH') {
        msg += `🔴 <b>CONTRARIAN BEARISH SIGNAL</b>\n\n`;
        msg += `FII is buying heavily while DII is pulling back. `;
        msg += `This divergence is at the <b>${pct}th percentile</b> — when smart money diverges at this extreme, `;
        msg += `caution is warranted.\n\n`;
    }

    msg += `<b>📊 SIGNAL METRICS</b>\n`;
    msg += `    ├ Divergence: ₹${Math.abs(divState.today_divergence || 0).toLocaleString('en-IN')} Cr\n`;
    msg += `    ├ Percentile: <b>${pct}th</b> (vs 30-day history)\n`;
    msg += `    ├ DII Absorption: <b>${abs}%</b>\n`;
    msg += `    ├ FII 30d Avg: ${fmtCr(divState.avg_fii_30d || 0)}\n`;
    msg += `    └ DII 30d Avg: ${fmtCr(divState.avg_dii_30d || 0)}\n`;

    msg += footer();
    return msg;
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. MORNING PRE-MARKET BRIEF
// ─────────────────────────────────────────────────────────────────────────────
function buildMorningBriefMessage(latest, regime, streak, flowDiv) {
    const fn = latest.fii_net || 0;
    const dn = latest.dii_net || 0;
    const pcr = latest.pcr || 0;
    const sent = latest.sentiment_score || 0;

    let msg = `${BRAND}\n`;
    msg += `🌅 <b>PRE-MARKET BRIEF</b>\n`;
    msg += `📅 <i>${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}</i>\n`;
    msg += `${LINE}\n\n`;

    msg += `<b>📊 PREVIOUS SESSION RECAP</b>\n`;
    msg += `    ${dot(fn)} FII Cash: <b>${fmtCr(fn)}</b>\n`;
    msg += `    ${dot(dn)} DII Cash: <b>${fmtCr(dn)}</b>\n`;
    msg += `    📈 F&O Sentiment: <b>${sent}/100</b> (${sent > 55 ? 'Bullish' : sent < 45 ? 'Bearish' : 'Neutral'})\n`;
    msg += `    📉 Put-Call Ratio: <b>${pcr}</b>\n\n`;

    // Regime
    msg += `<b>🧠 REGIME STATUS</b>\n`;
    if (regime && regime.regime) {
        const emoji = REGIME_EMOJI[regime.regime] || '⚪';
        const label = REGIME_LABELS[regime.regime] || regime.regime;
        msg += `    ${emoji} <b>${label}</b>`;
        if (regime.vix) msg += `  ·  VIX: ${regime.vix}`;
        msg += `\n`;
        if (regime.recommendation) msg += `    💡 <i>${regime.recommendation}</i>\n`;
    }

    if (streak) {
        if (streak.current_sell_streak > 2) {
            msg += `\n    🔥 FII on <b>${streak.current_sell_streak}-day SELL</b> streak`;
            msg += ` (${fmtCr(streak.sell_cumulative || 0)})`;
            if (streak.sell_absorption_pct) msg += ` · DII absorbed ${streak.sell_absorption_pct}%`;
            msg += `\n`;
        } else if (streak.current_buy_streak > 2) {
            msg += `\n    🚀 FII on <b>${streak.current_buy_streak}-day BUY</b> streak (${fmtCr(streak.buy_cumulative || 0)})\n`;
        }
    }

    // Active signal
    if (flowDiv && flowDiv.last_signal && flowDiv.last_signal !== 'NONE') {
        msg += `\n    ⚡ Active Signal: <b>${flowDiv.last_signal.replace(/_/g, ' ')}</b> (${flowDiv.divergence_percentile}th pctl)\n`;
    }

    msg += `\n${THIN}\n`;
    msg += `<b>☕ TODAY:</b> Track live institutional flows as market opens.\n`;
    msg += `${THIN}`;

    msg += footer();
    return msg;
}

module.exports = {
    buildCashFlowMessage,
    buildDerivativesMessage,
    buildSectorMessage,
    buildWeeklyDigestMessage,
    buildDivergenceMessage,
    buildMorningBriefMessage
};
