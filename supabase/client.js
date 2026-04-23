// ═══════════════════════════════════════════════════════════════════════════
// FII & DII Data — Supabase Client
// ═══════════════════════════════════════════════════════════════════════════
//
// STATUS: PREPARED — NOT CONNECTED
// Currently all data runs on local JSON files (Hostinger VPS).
// When ready to migrate, set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env
// and switch the data layer in agent-utils.js and fetch_data.js.
//
// Usage (when activated):
//   const { supabase, isSupabaseEnabled } = require('./supabase/client');
//   if (isSupabaseEnabled) { /* use supabase client */ }
//   else { /* fallback to JSON files */ }
//
// ═══════════════════════════════════════════════════════════════════════════

require('dotenv').config();

let supabase = null;
let isSupabaseEnabled = false;

// Only initialise if credentials exist in environment
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    try {
        const { createClient } = require('@supabase/supabase-js');
        supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
            auth: { persistSession: false },
            db: { schema: 'public' }
        });
        isSupabaseEnabled = true;
        console.log('[SUPABASE] ✅ Client initialised');
    } catch (err) {
        console.warn('[SUPABASE] ⚠ Failed to initialise:', err.message);
        console.warn('[SUPABASE] Falling back to local JSON storage');
    }
} else {
    console.log('[SUPABASE] ℹ Not configured — using local JSON files');
}

// ── Helper: Daily Flows ──────────────────────────────────────────────────

async function upsertDailyFlow(data) {
    if (!isSupabaseEnabled) return null;
    const { error } = await supabase
        .from('daily_flows')
        .upsert({
            date: data.date,
            fii_buy: data.fii_buy,
            fii_sell: data.fii_sell,
            fii_net: data.fii_net,
            dii_buy: data.dii_buy,
            dii_sell: data.dii_sell,
            dii_net: data.dii_net,
            fii_idx_fut_long: data.fii_idx_fut_long,
            fii_idx_fut_short: data.fii_idx_fut_short,
            fii_idx_fut_net: data.fii_idx_fut_net,
            dii_idx_fut_long: data.dii_idx_fut_long,
            dii_idx_fut_short: data.dii_idx_fut_short,
            dii_idx_fut_net: data.dii_idx_fut_net,
            fii_stk_fut_long: data.fii_stk_fut_long,
            fii_stk_fut_short: data.fii_stk_fut_short,
            fii_stk_fut_net: data.fii_stk_fut_net,
            dii_stk_fut_long: data.dii_stk_fut_long,
            dii_stk_fut_short: data.dii_stk_fut_short,
            dii_stk_fut_net: data.dii_stk_fut_net,
            fii_idx_call_long: data.fii_idx_call_long,
            fii_idx_call_short: data.fii_idx_call_short,
            fii_idx_call_net: data.fii_idx_call_net,
            fii_idx_put_long: data.fii_idx_put_long,
            fii_idx_put_short: data.fii_idx_put_short,
            fii_idx_put_net: data.fii_idx_put_net,
            pcr: data.pcr,
            sentiment_score: data.sentiment_score,
            source: data._source || 'fetch-pipeline',
            updated_at: new Date().toISOString()
        }, { onConflict: 'date' });

    if (error) console.error('[SUPABASE] upsertDailyFlow error:', error.message);
    return error ? null : data;
}

async function getLatestFlow() {
    if (!isSupabaseEnabled) return null;
    const { data, error } = await supabase
        .from('daily_flows')
        .select('*')
        .order('date', { ascending: false })
        .limit(1)
        .single();
    if (error) return null;
    return data;
}

async function getFlowHistory(limit = 60) {
    if (!isSupabaseEnabled) return null;
    const { data, error } = await supabase
        .from('daily_flows')
        .select('*')
        .order('date', { ascending: false })
        .limit(limit);
    if (error) return null;
    return data;
}

// ── Helper: Agent State ──────────────────────────────────────────────────

async function getAgentState(agentName) {
    if (!isSupabaseEnabled) return null;
    const { data, error } = await supabase
        .from('agent_state')
        .select('state_data')
        .eq('agent_name', agentName)
        .single();
    if (error) return {};
    return data?.state_data || {};
}

async function setAgentState(agentName, stateData) {
    if (!isSupabaseEnabled) return null;
    const { error } = await supabase
        .from('agent_state')
        .upsert({
            agent_name: agentName,
            state_data: { ...stateData, _updated_at: new Date().toISOString() },
            updated_at: new Date().toISOString()
        }, { onConflict: 'agent_name' });
    if (error) console.error('[SUPABASE] setAgentState error:', error.message);
    return error ? null : stateData;
}

async function getAllAgentStates() {
    if (!isSupabaseEnabled) return null;
    const { data, error } = await supabase
        .from('agent_state')
        .select('agent_name, state_data');
    if (error) return {};
    const result = {};
    (data || []).forEach(row => { result[row.agent_name] = row.state_data; });
    return result;
}

// ── Helper: Agent Runs ───────────────────────────────────────────────────

async function logAgentRun(agentName, result) {
    if (!isSupabaseEnabled) return null;
    const { error } = await supabase
        .from('agent_runs')
        .insert({
            agent_name: agentName,
            status: result.error ? 'error' : 'ok',
            items_found: result.items_found || 0,
            alerts_sent: result.alerts_sent || 0,
            duration_ms: result.duration_ms || 0,
            error: result.error || null,
            result_data: result.data || null
        });
    if (error) console.error('[SUPABASE] logAgentRun error:', error.message);
}

async function getAgentRunHistory(limit = 50, agentFilter = null) {
    if (!isSupabaseEnabled) return null;
    let query = supabase
        .from('agent_runs')
        .select('*')
        .order('run_at', { ascending: false })
        .limit(limit);
    if (agentFilter) query = query.eq('agent_name', agentFilter);
    const { data, error } = await query;
    if (error) return [];
    return data;
}

// ── Helper: Sectors ──────────────────────────────────────────────────────

async function upsertSectors(sectors) {
    if (!isSupabaseEnabled) return null;
    for (const sector of sectors) {
        const { error } = await supabase
            .from('sectors')
            .upsert({
                name: sector.name,
                aum_pct: sector.aumPct || 0,
                fii_own: sector.fiiOwn || 0,
                alpha: sector.alpha || 0,
                fortnight_cr: sector.fortnightCr || 0,
                history_cr: sector.historyCr || [],
                date_code: sector.dateCode || null,
                updated_at: new Date().toISOString()
            }, { onConflict: 'name' });
        if (error) console.error('[SUPABASE] upsertSector error:', error.message);
    }
}

async function getSectors() {
    if (!isSupabaseEnabled) return null;
    const { data, error } = await supabase
        .from('sectors')
        .select('*')
        .order('name');
    if (error) return [];
    // Map back to the format agents expect
    return (data || []).map(s => ({
        name: s.name,
        aumPct: s.aum_pct,
        fiiOwn: s.fii_own,
        alpha: s.alpha,
        fortnightCr: s.fortnight_cr,
        historyCr: s.history_cr || [],
        dateCode: s.date_code
    }));
}

// ── Helper: Fetch Logs ───────────────────────────────────────────────────

async function logFetch(entry) {
    if (!isSupabaseEnabled) return null;
    const { error } = await supabase
        .from('fetch_logs')
        .insert({
            success: entry.success !== false,
            date: entry.date || null,
            action: entry.action || null,
            error: entry.error || null,
            reason: entry.reason || null
        });
    if (error) console.error('[SUPABASE] logFetch error:', error.message);
}

// ── Export ────────────────────────────────────────────────────────────────

module.exports = {
    supabase,
    isSupabaseEnabled,
    // Daily flows
    upsertDailyFlow,
    getLatestFlow,
    getFlowHistory,
    // Agent state
    getAgentState,
    setAgentState,
    getAllAgentStates,
    // Agent runs
    logAgentRun,
    getAgentRunHistory,
    // Sectors
    upsertSectors,
    getSectors,
    // Fetch logs
    logFetch
};
