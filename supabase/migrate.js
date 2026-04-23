// ═══════════════════════════════════════════════════════════════════════════
// FII & DII Data — JSON → Supabase Migration Script
// ═══════════════════════════════════════════════════════════════════════════
//
// Run this ONCE when connecting Supabase to seed it from local JSON files.
//
// Prerequisites:
//   1. Run supabase/schema.sql in your Supabase SQL editor first
//   2. Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env
//   3. npm install @supabase/supabase-js (if not already)
//
// Usage:
//   node supabase/migrate.js
//
// ═══════════════════════════════════════════════════════════════════════════

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(process.cwd(), 'data');

function readJSON(filename, defaultVal) {
    try {
        const p = path.join(DATA_DIR, filename);
        if (!fs.existsSync(p)) return defaultVal;
        return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch { return defaultVal; }
}

async function migrate() {
    const { supabase, isSupabaseEnabled } = require('./client');

    if (!isSupabaseEnabled) {
        console.error('❌ Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env');
        process.exit(1);
    }

    console.log('═══════════════════════════════════════════════════');
    console.log('  FII & DII Data — JSON → Supabase Migration');
    console.log('═══════════════════════════════════════════════════\n');

    // ── 1. Migrate history.json → daily_flows ────────────────────────────
    console.log('📊 Migrating daily_flows...');
    const history = readJSON('history.json', []);
    if (history.length) {
        const BATCH_SIZE = 100;
        let migrated = 0;
        for (let i = 0; i < history.length; i += BATCH_SIZE) {
            const batch = history.slice(i, i + BATCH_SIZE).map(h => ({
                date: h.date,
                fii_buy: h.fii_buy || 0,
                fii_sell: h.fii_sell || 0,
                fii_net: h.fii_net || 0,
                dii_buy: h.dii_buy || 0,
                dii_sell: h.dii_sell || 0,
                dii_net: h.dii_net || 0,
                fii_idx_fut_long: h.fii_idx_fut_long || 0,
                fii_idx_fut_short: h.fii_idx_fut_short || 0,
                fii_idx_fut_net: h.fii_idx_fut_net || 0,
                dii_idx_fut_long: h.dii_idx_fut_long || 0,
                dii_idx_fut_short: h.dii_idx_fut_short || 0,
                dii_idx_fut_net: h.dii_idx_fut_net || 0,
                fii_stk_fut_long: h.fii_stk_fut_long || 0,
                fii_stk_fut_short: h.fii_stk_fut_short || 0,
                fii_stk_fut_net: h.fii_stk_fut_net || 0,
                dii_stk_fut_long: h.dii_stk_fut_long || 0,
                dii_stk_fut_short: h.dii_stk_fut_short || 0,
                dii_stk_fut_net: h.dii_stk_fut_net || 0,
                fii_idx_call_long: h.fii_idx_call_long || 0,
                fii_idx_call_short: h.fii_idx_call_short || 0,
                fii_idx_call_net: h.fii_idx_call_net || 0,
                fii_idx_put_long: h.fii_idx_put_long || 0,
                fii_idx_put_short: h.fii_idx_put_short || 0,
                fii_idx_put_net: h.fii_idx_put_net || 0,
                pcr: h.pcr || 0,
                sentiment_score: h.sentiment_score || 50,
                source: h._source || 'migration'
            }));

            const { error } = await supabase
                .from('daily_flows')
                .upsert(batch, { onConflict: 'date' });

            if (error) {
                console.error(`  ❌ Batch ${i}-${i + batch.length} failed:`, error.message);
            } else {
                migrated += batch.length;
                process.stdout.write(`  ✅ ${migrated}/${history.length} rows\r`);
            }
        }
        console.log(`\n  ✅ daily_flows: ${migrated} rows migrated`);
    } else {
        console.log('  ⚠ No history.json found, skipping');
    }

    // ── 2. Migrate agent_state.json → agent_state ────────────────────────
    console.log('\n🤖 Migrating agent_state...');
    const agentState = readJSON('agent_state.json', {});
    const stateEntries = Object.entries(agentState);
    if (stateEntries.length) {
        const batch = stateEntries.map(([name, state]) => ({
            agent_name: name,
            state_data: state,
            updated_at: state._updated_at || new Date().toISOString()
        }));

        const { error } = await supabase
            .from('agent_state')
            .upsert(batch, { onConflict: 'agent_name' });

        if (error) console.error('  ❌ agent_state migration failed:', error.message);
        else console.log(`  ✅ agent_state: ${stateEntries.length} agents migrated`);
    } else {
        console.log('  ⚠ No agent_state.json found, skipping');
    }

    // ── 3. Migrate agent_runs.json → agent_runs ──────────────────────────
    console.log('\n📋 Migrating agent_runs...');
    const agentRuns = readJSON('agent_runs.json', []);
    if (agentRuns.length) {
        const BATCH_SIZE = 50;
        let migrated = 0;
        for (let i = 0; i < agentRuns.length; i += BATCH_SIZE) {
            const batch = agentRuns.slice(i, i + BATCH_SIZE).map(r => ({
                agent_name: r.agent,
                run_at: r.run_at,
                status: r.status || 'ok',
                items_found: r.items_found || 0,
                alerts_sent: r.alerts_sent || 0,
                duration_ms: r.duration_ms || 0,
                error: r.error || null,
                result_data: r.result || null
            }));

            const { error } = await supabase
                .from('agent_runs')
                .insert(batch);

            if (error) {
                console.error(`  ❌ Batch ${i}-${i + batch.length} failed:`, error.message);
            } else {
                migrated += batch.length;
            }
        }
        console.log(`  ✅ agent_runs: ${migrated} rows migrated`);
    } else {
        console.log('  ⚠ No agent_runs.json found, skipping');
    }

    // ── 4. Migrate sectors.json → sectors ────────────────────────────────
    console.log('\n🏦 Migrating sectors...');
    const sectors = readJSON('sectors.json', []);
    if (sectors.length) {
        const batch = sectors.map(s => ({
            name: s.name,
            aum_pct: s.aumPct || 0,
            fii_own: s.fiiOwn || 0,
            alpha: s.alpha || 0,
            fortnight_cr: s.fortnightCr || 0,
            history_cr: s.historyCr || [],
            date_code: s.dateCode || null
        }));

        const { error } = await supabase
            .from('sectors')
            .upsert(batch, { onConflict: 'name' });

        if (error) console.error('  ❌ sectors migration failed:', error.message);
        else console.log(`  ✅ sectors: ${sectors.length} sectors migrated`);
    } else {
        console.log('  ⚠ No sectors.json found, skipping');
    }

    // ── 5. Migrate fetch-log.json → fetch_logs ───────────────────────────
    console.log('\n📝 Migrating fetch_logs...');
    const fetchLogs = readJSON('fetch-log.json', []);
    if (fetchLogs.length) {
        const batch = fetchLogs.slice(0, 100).map(l => ({
            ts: l.ts,
            success: l.success !== false,
            date: l.date || null,
            action: l.action || null,
            error: l.error || null,
            reason: l.reason || null
        }));

        const { error } = await supabase
            .from('fetch_logs')
            .insert(batch);

        if (error) console.error('  ❌ fetch_logs migration failed:', error.message);
        else console.log(`  ✅ fetch_logs: ${batch.length} entries migrated`);
    } else {
        console.log('  ⚠ No fetch-log.json found, skipping');
    }

    console.log('\n═══════════════════════════════════════════════════');
    console.log('  ✅ Migration complete!');
    console.log('  Next: Update .env on Hostinger with Supabase keys');
    console.log('═══════════════════════════════════════════════════\n');
}

migrate().catch(err => {
    console.error('Fatal migration error:', err);
    process.exit(1);
});
