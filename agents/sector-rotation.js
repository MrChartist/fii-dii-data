// ── Sector Rotation Monitor ──────────────────────────────────────────────────
// Phase 2A: Detects FPI allocation rotation between sectors
//
// PERCEPTION: Reads sectors.json after each NSDL fortnight update
// REASONING:
//   Rule 1: Sector AUM drops > 1% in single fortnight → "FPI reducing"
//   Rule 2: Sector AUM rises > 1% in single fortnight → "FPI increasing"
//   Rule 3: 3+ consecutive fortnights of decline → "Sustained FPI exit"
//   Rule 4: Compare top 5 vs bottom 5 sectors → Rotation pattern
// ACTION: Telegram alert with sector rotation summary

const {
    getState, setState, sendTelegramAlert,
    getSectors, fmtCr
} = require('./agent-utils');

const AGENT_NAME = 'sector-rotation';

// ── Rotation Analyzer ────────────────────────────────────────────────────────

function analyzeSectors(sectors) {
    if (!sectors.length) return null;

    const analysis = sectors.map(sector => {
        const history = sector.historyCr || [];
        if (history.length < 2) return null;

        const latest = history[history.length - 1];
        const previous = history[history.length - 2];
        const fortnightChange = latest - previous;

        // Calculate consecutive decline fortnights
        let declineStreak = 0;
        for (let i = history.length - 1; i >= 1; i--) {
            if (history[i] < history[i - 1]) {
                declineStreak++;
            } else {
                break;
            }
        }

        // Calculate consecutive growth fortnights
        let growthStreak = 0;
        for (let i = history.length - 1; i >= 1; i--) {
            if (history[i] > history[i - 1]) {
                growthStreak++;
            } else {
                break;
            }
        }

        return {
            name: sector.name,
            aumPct: sector.aumPct || 0,
            fortnightChange,
            cumulativeOneYear: latest,
            declineStreak,
            growthStreak,
            fortnightCr: sector.fortnightCr || fortnightChange,
            fiiOwn: sector.fiiOwn || 0,
            alpha: sector.alpha || 0
        };
    }).filter(Boolean);

    // Sort by fortnight change
    const sorted = [...analysis].sort((a, b) => b.fortnightChange - a.fortnightChange);
    const topInflows = sorted.slice(0, 5);
    const topOutflows = sorted.slice(-5).reverse();

    // Significant rotations
    const significantMoves = analysis.filter(s =>
        Math.abs(s.fortnightChange) > 500 || s.declineStreak >= 3 || s.growthStreak >= 3
    );

    // Sustained exits (3+ fortnights of decline)
    const sustainedExits = analysis.filter(s => s.declineStreak >= 3);

    // Sustained entries (3+ fortnights of growth)
    const sustainedEntries = analysis.filter(s => s.growthStreak >= 3);

    return {
        sectors: analysis,
        topInflows,
        topOutflows,
        significantMoves,
        sustainedExits,
        sustainedEntries,
        totalSectors: analysis.length
    };
}

// ── Alert Builder ────────────────────────────────────────────────────────────

function buildRotationAlert(rotation) {
    const topIn = rotation.topInflows.slice(0, 3)
        .map(s => `  🟢 ${s.name}: ${fmtCr(s.fortnightChange)} (${s.aumPct}% AUM)`)
        .join('\n');

    const topOut = rotation.topOutflows.slice(0, 3)
        .map(s => `  🔴 ${s.name}: ${fmtCr(s.fortnightChange)} (${s.aumPct}% AUM)`)
        .join('\n');

    let sustainedSection = '';
    if (rotation.sustainedExits.length > 0) {
        const exits = rotation.sustainedExits
            .map(s => `  ⚠️ ${s.name}: ${s.declineStreak} fortnights of decline`)
            .join('\n');
        sustainedSection = `\n🚨 Sustained FPI Exits:\n${exits}\n`;
    }

    if (rotation.sustainedEntries.length > 0) {
        const entries = rotation.sustainedEntries
            .map(s => `  ✅ ${s.name}: ${s.growthStreak} fortnights of growth`)
            .join('\n');
        sustainedSection += `\n📈 Sustained FPI Entries:\n${entries}\n`;
    }

    return `🏦 SECTOR ROTATION UPDATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 ${rotation.totalSectors} sectors analyzed

📈 Top Inflows (Fortnight):
${topIn}

📉 Top Outflows (Fortnight):
${topOut}
${sustainedSection}
📋 Significant Moves: ${rotation.significantMoves.length} sectors

🤖 Sector Rotation Monitor
@Mr_Chartist`;
}

// ── Main Agent Logic ─────────────────────────────────────────────────────────

async function run() {
    const sectors = getSectors();
    if (!sectors.length) {
        return { items_found: 0, alerts_sent: 0, message: 'No sector data available' };
    }

    const state = getState(AGENT_NAME);
    const rotation = analyzeSectors(sectors);
    if (!rotation) {
        return { items_found: 0, alerts_sent: 0, message: 'Insufficient sector history' };
    }

    let alertsSent = 0;

    // Detect if new sector data has arrived
    // Compare history array lengths — new fortnight = new entry appended
    const currentLengths = {};
    for (const s of sectors) {
        currentLengths[s.name] = (s.historyCr || []).length;
    }

    const lastLengths = state.last_sector_lengths || {};
    const hasNewData = Object.keys(currentLengths).some(name =>
        (currentLengths[name] || 0) !== (lastLengths[name] || 0)
    );

    if (hasNewData || Object.keys(lastLengths).length === 0) {
        // New sector data detected — send alert
        if (rotation.significantMoves.length > 0 || rotation.sustainedExits.length > 0) {
            const alert = buildRotationAlert(rotation);
            await sendTelegramAlert(alert);
            alertsSent++;
            console.log(`[${AGENT_NAME}] 🏦 Sector rotation detected: ${rotation.significantMoves.length} significant moves`);
        }
    } else {
        console.log(`[${AGENT_NAME}] No new sector data detected`);
    }

    // Update state
    setState(AGENT_NAME, {
        last_sector_lengths: currentLengths,
        total_sectors: rotation.totalSectors,
        significant_moves: rotation.significantMoves.length,
        sustained_exits: rotation.sustainedExits.map(s => s.name),
        sustained_entries: rotation.sustainedEntries.map(s => s.name),
        top_inflow: rotation.topInflows[0]?.name || '',
        top_outflow: rotation.topOutflows[0]?.name || '',
        last_run_date: new Date().toISOString()
    });

    return {
        items_found: rotation.significantMoves.length,
        alerts_sent: alertsSent,
        rotations_detected: rotation.significantMoves.length,
        top_inflows: rotation.topInflows.slice(0, 3).map(s => s.name),
        top_outflows: rotation.topOutflows.slice(0, 3).map(s => s.name)
    };
}

module.exports = { run, analyzeSectors, AGENT_NAME };
