// ── Flow Strength Monitor ────────────────────────────────────────────────────
// Phase 1C: Real-time alert when daily FII/DII flow hits extreme levels
//
// RULES:
//   FII selling > ₹5,000 Cr in a single day → "🔴 FII BLOODBATH"
//   FII buying > ₹3,000 Cr in a single day → "🟢 FII MEGA BUY"
//   DII buying > ₹5,000 Cr in a single day → "🟢 DII MASSIVE ABSORPTION"
//   FII-DII divergence > ₹8,000 Cr → "⚡ EXTREME DIVERGENCE"
//
// One-shot alert per extreme event per day

const {
    getState, setState, sendTelegramAlert,
    getLatestEntry, fmtCr, fmtDate
} = require('./agent-utils');

const AGENT_NAME = 'flow-strength';

// ── Thresholds ───────────────────────────────────────────────────────────────

const THRESHOLDS = {
    FII_BLOODBATH:        { check: (d) => d.fii_net < -5000, label: '🔴 FII BLOODBATH', field: 'fii_net' },
    FII_MEGA_BUY:         { check: (d) => d.fii_net > 3000,  label: '🟢 FII MEGA BUY', field: 'fii_net' },
    DII_MASSIVE_ABSORB:   { check: (d) => d.dii_net > 5000,  label: '🟢 DII MASSIVE ABSORPTION', field: 'dii_net' },
    EXTREME_DIVERGENCE:   { check: (d) => Math.abs(d.fii_net - d.dii_net) > 8000, label: '⚡ EXTREME DIVERGENCE', field: 'divergence' },
};

// ── Alert Builder ────────────────────────────────────────────────────────────

function buildFlowAlert(eventLabel, data, events) {
    const divergence = Math.abs(data.fii_net - data.dii_net);

    const eventList = events.map(e => `  • ${e}`).join('\n');

    return `${eventLabel}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📅 ${fmtDate(data.date)}

📊 Today's Institutional Flows:
  FII Buy:  ${fmtCr(data.fii_buy)}
  FII Sell: ${fmtCr(Math.abs(data.fii_sell) * -1)}
  FII Net:  ${fmtCr(data.fii_net)}

  DII Buy:  ${fmtCr(data.dii_buy)}
  DII Sell: ${fmtCr(Math.abs(data.dii_sell) * -1)}
  DII Net:  ${fmtCr(data.dii_net)}

  Divergence: ₹${Math.round(divergence).toLocaleString('en-IN')} Cr

🚨 Events Triggered:
${eventList}

🤖 Flow Strength Monitor
@Mr_Chartist`;
}

// ── Main Agent Logic ─────────────────────────────────────────────────────────

async function run() {
    const latest = getLatestEntry();
    if (!latest) {
        return { items_found: 0, alerts_sent: 0, message: 'No latest data available' };
    }

    const state = getState(AGENT_NAME);
    const lastAlertedDate = state.last_alerted_date || '';
    const lastAlertedEvents = state.last_alerted_events || [];

    // Check all thresholds
    const triggeredEvents = [];
    for (const [key, threshold] of Object.entries(THRESHOLDS)) {
        if (threshold.check(latest)) {
            triggeredEvents.push({ key, label: threshold.label });
        }
    }

    if (triggeredEvents.length === 0) {
        console.log(`[${AGENT_NAME}] No extreme flow events detected for ${latest.date}`);
        setState(AGENT_NAME, {
            last_run_date: latest.date,
            events_checked: Object.keys(THRESHOLDS).length,
            events_triggered: 0
        });
        return { items_found: 0, alerts_sent: 0, events_detected: [] };
    }

    // Determine if we need to send alerts (one-shot per day per event)
    const newEvents = [];
    if (latest.date === lastAlertedDate) {
        // Same day — only alert on NEW events not already alerted
        for (const evt of triggeredEvents) {
            if (!lastAlertedEvents.includes(evt.key)) {
                newEvents.push(evt);
            }
        }
    } else {
        // New day — alert on all triggered events
        newEvents.push(...triggeredEvents);
    }

    let alertsSent = 0;
    if (newEvents.length > 0) {
        // Use the most severe event as the headline
        const headline = newEvents[0].label;
        const allLabels = newEvents.map(e => e.label);
        const alert = buildFlowAlert(headline, latest, allLabels);
        await sendTelegramAlert(alert);
        alertsSent++;

        console.log(`[${AGENT_NAME}] 🚨 ${newEvents.length} extreme flow event(s) detected for ${latest.date}`);
    }

    // Update state
    const allAlertedEvents = latest.date === lastAlertedDate
        ? [...new Set([...lastAlertedEvents, ...newEvents.map(e => e.key)])]
        : triggeredEvents.map(e => e.key);

    setState(AGENT_NAME, {
        last_alerted_date: latest.date,
        last_alerted_events: allAlertedEvents,
        last_run_date: latest.date,
        events_checked: Object.keys(THRESHOLDS).length,
        events_triggered: triggeredEvents.length,
        latest_fii_net: latest.fii_net,
        latest_dii_net: latest.dii_net
    });

    return {
        items_found: triggeredEvents.length,
        alerts_sent: alertsSent,
        events_detected: triggeredEvents.map(e => e.key)
    };
}

module.exports = { run, AGENT_NAME };
