// ── Agent Runner — Central orchestrator for all FII/DII agents ───────────────
// Manages agent lifecycle: loading, execution, timing, error handling, logging
//
// Usage:
//   const runner = require('./agent-runner');
//   await runner.runAllPostMarket();      // After data fetch
//   await runner.runSectorAgents();       // After NSDL fetch
//   await runner.runWeeklyDigest();       // Friday 8 PM IST
//
// CLI:
//   node agent-runner.js                          # Run all post-market agents
//   node agent-runner.js --agent=fii-streak       # Run single agent
//   node agent-runner.js --agent=weekly-digest    # Run weekly digest
//   node agent-runner.js --agent=sector-rotation  # Run sector agents

require('dotenv').config();
const { logRun } = require('./agents/agent-utils');

// ── Agent Registry ───────────────────────────────────────────────────────────

const AGENTS = {
    // Phase 1: Core Detection
    'fii-streak':        { module: './agents/fii-streak-agent',  group: 'post-market' },
    'regime-classifier': { module: './agents/regime-classifier', group: 'post-market' },
    'flow-strength':     { module: './agents/flow-strength',     group: 'post-market' },

    // Phase 2: Intelligence
    'sector-rotation':   { module: './agents/sector-rotation',   group: 'sector' },
    'flow-divergence':   { module: './agents/flow-divergence',   group: 'post-market' },
    'weekly-digest':     { module: './agents/weekly-digest',     group: 'weekly' },
    'morning-brief':     { module: './agents/morning-brief',     group: 'morning' },

    // Phase 3: Meta Intelligence
    'confluence-detector': { module: './agents/confluence-detector', group: 'meta' }
};

// ── Agent Executor ───────────────────────────────────────────────────────────

async function runAgent(name) {
    const agentDef = AGENTS[name];
    if (!agentDef) {
        console.error(`[RUNNER] ❌ Unknown agent: ${name}`);
        return null;
    }

    const startTime = Date.now();
    console.log(`[RUNNER] ▶ Starting agent: ${name}`);

    try {
        const agent = require(agentDef.module);
        const result = await agent.run();
        const duration = Date.now() - startTime;

        const logEntry = {
            items_found: result.items_found || 0,
            alerts_sent: result.alerts_sent || 0,
            duration_ms: duration,
            data: result
        };

        logRun(name, logEntry);
        console.log(`[RUNNER] ✅ ${name} completed in ${duration}ms (alerts: ${logEntry.alerts_sent})`);
        return result;

    } catch (err) {
        const duration = Date.now() - startTime;
        console.error(`[RUNNER] ❌ ${name} failed in ${duration}ms:`, err.message);

        logRun(name, {
            error: err.message,
            duration_ms: duration
        });

        return null;
    }
}

// ── Group Runners ────────────────────────────────────────────────────────────

async function runGroup(groupName) {
    const agents = Object.entries(AGENTS)
        .filter(([_, def]) => def.group === groupName)
        .map(([name]) => name);

    if (!agents.length) {
        console.warn(`[RUNNER] No agents in group: ${groupName}`);
        return [];
    }

    console.log(`[RUNNER] ━━━ Running ${groupName} agents (${agents.length}) ━━━`);
    const results = [];

    for (const name of agents) {
        const result = await runAgent(name);
        results.push({ agent: name, result });
    }

    console.log(`[RUNNER] ━━━ ${groupName} complete ━━━`);
    return results;
}

async function runAllPostMarket() {
    console.log(`[RUNNER] ═══════════════════════════════════════════════`);
    console.log(`[RUNNER] 📊 Post-Market Agent Run — ${new Date().toISOString()}`);
    console.log(`[RUNNER] ═══════════════════════════════════════════════`);
    await runGroup('post-market');
    
    console.log(`[RUNNER] ═══════════════════════════════════════════════`);
    console.log(`[RUNNER] 🧠 Meta Agent Run — ${new Date().toISOString()}`);
    console.log(`[RUNNER] ═══════════════════════════════════════════════`);
    await runGroup('meta');
}

async function runSectorAgents() {
    console.log(`[RUNNER] ═══════════════════════════════════════════════`);
    console.log(`[RUNNER] 🏦 Sector Agent Run — ${new Date().toISOString()}`);
    console.log(`[RUNNER] ═══════════════════════════════════════════════`);
    return runGroup('sector');
}

async function runWeeklyDigest() {
    console.log(`[RUNNER] ═══════════════════════════════════════════════`);
    console.log(`[RUNNER] 📋 Weekly Digest — ${new Date().toISOString()}`);
    console.log(`[RUNNER] ═══════════════════════════════════════════════`);
    return runAgent('weekly-digest');
}

// ── CLI Mode ─────────────────────────────────────────────────────────────────

if (require.main === module) {
    const args = process.argv.slice(2);
    const agentArg = args.find(a => a.startsWith('--agent='));
    const agentName = agentArg ? agentArg.split('=')[1] : null;

    (async () => {
        try {
            if (agentName) {
                // Run single agent
                if (agentName === 'all') {
                    await runAllPostMarket();
                    await runSectorAgents();
                    await runWeeklyDigest();
                } else {
                    await runAgent(agentName);
                }
            } else {
                // Default: run all post-market agents
                await runAllPostMarket();
            }
            console.log('[RUNNER] Done.');
        } catch (err) {
            console.error('[RUNNER] Fatal error:', err);
            process.exit(1);
        }
    })();
}

module.exports = {
    runAgent,
    runAllPostMarket,
    runSectorAgents,
    runWeeklyDigest,
    AGENTS
};
