# Server (`server/`)
`server.js` (repo root) only boots: crash handlers → `server/config.js` (env) → `server/app.js` (middleware + routes) → listen → `jobs/scheduler.js`.

| Folder | Files | Purpose |
|---|---|---|
| `routes/` | `pages` (HTML, OG injection, static) · `data` · `push` · `system` (refresh/status/health/stream) · `market` (Yahoo/NSE proxies) · `agents` · `admin` (one-time `.env` setup) | Thin HTTP handlers. Mount order is set in `app.js` and matters (pages before API). |
| `services/` | `feed` (only door to `scripts/feed`) · `pipeline` (what happens on a new session: SSE → clear AI cache → market close → agents → notifications) · `notify` · `push` · `sse` · `market` · `synthesis-cache` | Business logic, no Express. |
| `jobs/` | `scheduler` | Cron (UTC): post-market fetch every 15 min 6–9 PM IST, NSDL 10 AM, F&O recovery 10 PM/8 AM, weekly digest Fri 8 PM. |

Env: `PORT`, `API_KEYS`, `ALLOWED_ORIGINS`, `VAPID_PRIVATE_KEY`, `GROQ_API_KEY`, `SETUP_KEY`, `API_RATE_PER_MIN`. Access rules: `api-guard.js`.
