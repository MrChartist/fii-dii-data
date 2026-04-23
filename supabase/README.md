# Supabase Integration — FII & DII Data

> **STATUS: PREPARED — NOT CONNECTED**
> 
> All files are ready for Supabase integration but currently inactive.
> The app runs entirely on local JSON files on Hostinger.

## Files

| File | Purpose |
|------|---------|
| `schema.sql` | Database schema — run this in Supabase SQL editor first |
| `client.js` | Supabase client with all CRUD helpers (auto-detects if configured) |
| `migrate.js` | One-time migration script: local JSON → Supabase |

## How to Connect (When Ready)

### 1. Create Supabase Project
- Go to [supabase.com](https://supabase.com) and create a new project
- Note your **Project URL** and **Service Role Key**

### 2. Run Schema
- Open the SQL editor in your Supabase dashboard
- Paste and run `schema.sql`

### 3. Install Dependency
```bash
npm install @supabase/supabase-js
```

### 4. Set Environment Variables
Add to your `.env` file:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOi...your-service-role-key
```

### 5. Migrate Data
```bash
node supabase/migrate.js
```

### 6. Switch Data Layer
The `client.js` auto-detects Supabase credentials. Once `.env` is configured:
- `isSupabaseEnabled` becomes `true`
- All helpers (`upsertDailyFlow`, `getAgentState`, etc.) become active
- In your code, use the pattern:
```javascript
const { isSupabaseEnabled, getLatestFlow } = require('./supabase/client');
// Use Supabase if available, else fallback to JSON
const data = isSupabaseEnabled ? await getLatestFlow() : getLatestData();
```

## Table Summary

| Table | Local JSON Source | Records |
|-------|------------------|---------|
| `daily_flows` | `data/history.json` | ~800 days |
| `agent_state` | `data/agent_state.json` | 6 agents |
| `agent_runs` | `data/agent_runs.json` | Last 500 runs |
| `sectors` | `data/sectors.json` | 24 sectors |
| `push_subscriptions` | `data/subscriptions.json` | Variable |
| `fetch_logs` | `data/fetch-log.json` | Last 100 |
