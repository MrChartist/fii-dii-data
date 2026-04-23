-- ═══════════════════════════════════════════════════════════════════════════
-- FII & DII Data — Supabase Schema
-- Ready for future migration from local JSON files
-- Currently NOT connected — all data runs on local JSON on Hostinger
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Daily FII/DII Cash + F&O Flow Data ───────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_flows (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    date            TEXT NOT NULL UNIQUE,                -- '01-Apr-2026' (NSE format)
    fii_buy         DECIMAL(14,2) DEFAULT 0,
    fii_sell        DECIMAL(14,2) DEFAULT 0,
    fii_net         DECIMAL(14,2) DEFAULT 0,
    dii_buy         DECIMAL(14,2) DEFAULT 0,
    dii_sell        DECIMAL(14,2) DEFAULT 0,
    dii_net         DECIMAL(14,2) DEFAULT 0,
    -- F&O Index Futures
    fii_idx_fut_long    BIGINT DEFAULT 0,
    fii_idx_fut_short   BIGINT DEFAULT 0,
    fii_idx_fut_net     BIGINT DEFAULT 0,
    dii_idx_fut_long    BIGINT DEFAULT 0,
    dii_idx_fut_short   BIGINT DEFAULT 0,
    dii_idx_fut_net     BIGINT DEFAULT 0,
    -- F&O Stock Futures
    fii_stk_fut_long    BIGINT DEFAULT 0,
    fii_stk_fut_short   BIGINT DEFAULT 0,
    fii_stk_fut_net     BIGINT DEFAULT 0,
    dii_stk_fut_long    BIGINT DEFAULT 0,
    dii_stk_fut_short   BIGINT DEFAULT 0,
    dii_stk_fut_net     BIGINT DEFAULT 0,
    -- F&O Options
    fii_idx_call_long   BIGINT DEFAULT 0,
    fii_idx_call_short  BIGINT DEFAULT 0,
    fii_idx_call_net    BIGINT DEFAULT 0,
    fii_idx_put_long    BIGINT DEFAULT 0,
    fii_idx_put_short   BIGINT DEFAULT 0,
    fii_idx_put_net     BIGINT DEFAULT 0,
    -- Derived
    pcr             DECIMAL(6,2) DEFAULT 0,
    sentiment_score DECIMAL(5,1) DEFAULT 50,
    -- Metadata
    source          TEXT DEFAULT 'fetch-pipeline',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_daily_flows_date ON daily_flows(date);

-- ── Agent State (Persistent Key-Value per Agent) ─────────────────────────
CREATE TABLE IF NOT EXISTS agent_state (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    agent_name      TEXT NOT NULL,
    state_data      JSONB NOT NULL DEFAULT '{}',
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_agent_state UNIQUE(agent_name)
);

CREATE INDEX idx_agent_state_name ON agent_state(agent_name);

-- ── Agent Run History ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_runs (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    agent_name      TEXT NOT NULL,
    run_at          TIMESTAMPTZ DEFAULT NOW(),
    status          TEXT DEFAULT 'ok',           -- 'ok' | 'error'
    items_found     INTEGER DEFAULT 0,
    alerts_sent     INTEGER DEFAULT 0,
    duration_ms     INTEGER DEFAULT 0,
    error           TEXT,
    result_data     JSONB,                       -- Full result payload
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_runs_name ON agent_runs(agent_name);
CREATE INDEX idx_agent_runs_time ON agent_runs(run_at DESC);

-- ── Sector Allocation (NSDL FPI Fortnightly) ─────────────────────────────
CREATE TABLE IF NOT EXISTS sectors (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name            TEXT NOT NULL,
    aum_pct         DECIMAL(6,2) DEFAULT 0,
    fii_own         DECIMAL(6,2) DEFAULT 0,
    alpha           DECIMAL(8,2) DEFAULT 0,
    fortnight_cr    DECIMAL(14,2) DEFAULT 0,
    history_cr      JSONB DEFAULT '[]',          -- Array of fortnight values
    date_code       TEXT,                         -- NSDL fortnight code
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_sector UNIQUE(name)
);

CREATE INDEX idx_sectors_name ON sectors(name);

-- ── Push Notification Subscriptions ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    endpoint        TEXT NOT NULL UNIQUE,
    expiration_time TEXT,
    keys            JSONB NOT NULL,              -- { p256dh, auth }
    categories      TEXT[] DEFAULT ARRAY['cash','fao','sectors'],
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_push_subs_endpoint ON push_subscriptions(endpoint);

-- ── Fetch Logs ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fetch_logs (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ts              TIMESTAMPTZ DEFAULT NOW(),
    success         BOOLEAN DEFAULT true,
    date            TEXT,
    action          TEXT,                         -- 'updated' | 'skipped' | 'idle'
    error           TEXT,
    reason          TEXT
);

CREATE INDEX idx_fetch_logs_ts ON fetch_logs(ts DESC);

-- ── Row-Level Security Policies ──────────────────────────────────────────
-- Enable RLS on all tables (read-only for anonymous, full for service role)

ALTER TABLE daily_flows       ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_state       ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE sectors           ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE fetch_logs        ENABLE ROW LEVEL SECURITY;

-- Public read access (anon key) for data tables
CREATE POLICY "Public read daily_flows"   ON daily_flows   FOR SELECT USING (true);
CREATE POLICY "Public read agent_state"   ON agent_state   FOR SELECT USING (true);
CREATE POLICY "Public read agent_runs"    ON agent_runs    FOR SELECT USING (true);
CREATE POLICY "Public read sectors"       ON sectors       FOR SELECT USING (true);

-- Service role only for writes (server-side operations)
CREATE POLICY "Service write daily_flows" ON daily_flows   FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');
CREATE POLICY "Service write agent_state" ON agent_state   FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');
CREATE POLICY "Service write agent_runs"  ON agent_runs    FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');
CREATE POLICY "Service write sectors"     ON sectors       FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');
CREATE POLICY "Service write push_subs"   ON push_subscriptions FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');
CREATE POLICY "Service write fetch_logs"  ON fetch_logs    FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');
