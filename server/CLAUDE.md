# Server

Layout and env vars: `README.md`. Boot order: `server.js` → `server/config.js` → `server/app.js` → listen → `jobs/scheduler.js`.

- Routes stay thin; logic goes in `services/` so a future Go port has clear units. `services/feed.js` is the only door into `scripts/feed`; `services/pipeline.js` is the single "new session landed" sequence (SSE → clear AI cache → market close → agents → notifications) shared by cron, `/api/refresh` and F&O recovery.
- Mount order in `app.js` matters: guard → agent-ready → pages/static → API routes.
- New or changed endpoint → also `contracts/api.openapi.yaml`. Rows may be net-only (`_partial`): gross legs are `null` in the raw API and in MCP output; `/api/history-full` adds `p: 1`.
- Access control lives in `api-guard.js` (same-origin browser or `x-api-key`). Loosening it is a product decision; say so in the commit.
- Cron is UTC with the timezone pinned; IST = UTC+5:30.
