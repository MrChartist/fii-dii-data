# FII & DII Data — agent guide (read this first, then open only the module you need)

Indian institutional-flow dashboard (FII/FPI + DII cash, F&O participant OI, NSDL sectors). Node/Express server + static front end in `public/`. Data is JSON in `data/`, committed by a GitHub Action. Architecture and the planned Go/Rust migration: `docs/ARCHITECTURE.md`.

## Module map — one folder = one concern. Work inside ONE row at a time.

| Concern | Folder | Open first | Notes |
|---|---|---|---|
| **UI kit** (reusable across projects) | `public/ui/` | `public/ui/README.md` | Tokens, navbar, dock, buttons, popovers, toast, motion, chart helpers. No FII/DII logic. |
| **App front end** (this product) | `public/*.html`, `public/app/` | `public/app/README.md` | `index.html` is markup only; behaviour in `app/js/dashboard.js` + `pwa.js`. |
| **SEO** | `seo/`, root files in `public/` | `seo/README.md` | `npm run seo` (runs in CI). |
| **Data feed** (NSE/NSDL → `data/`) | `scripts/feed/` | "Data feed" below | `fetch_data.js` (cash+F&O), `fetch_nsdl.js` (sectors). Run by `.github/workflows/update_data.yml`. |
| **Server** (API + jobs) | `server.js` → `server/` | `server/README.md` | `routes/` HTTP, `services/` logic, `jobs/` cron. `api-guard.js` access control, `agent-ready.js` Markdown/MCP/llms endpoints. |
| **Agents** (signals) | `agents/` | `agents/runner.js` header | Each agent `run()` reads `data/`, writes `data/agent_state.json`. Shared helpers `agents/agent-utils.js`. |
| **Contracts** | `contracts/` | `docs/ARCHITECTURE.md` | OpenAPI + JSON Schema. Language-agnostic; any port must satisfy them. |
| **Shared backend utils** | `lib/` | — | `dates.js` (ALL date maths), `store.js` (ALL JSON I/O). Never re-implement. |
| **One-off backfills** | `scripts/backfill/` | script header | Not run in CI. |
| **Checks** | `scripts/checks/`, `test/` | — | `npm test` = unit + contracts + data integrity + UI contract. |
| **Brand** | `brand-source/`, `scripts/brand/` | — | Generates `public/brand/*`. |
| **Docs** | `docs/` (`plans/`, `marketing/`, `manual.md`) | — | Plans mention removed features (Telegram); treat as history. |

## Rules that save tokens and prevent bugs
1. **Dates**: canonical `DD-Mon-YYYY` (`20-Nov-2026`). Server: `lib/dates.js`. Browser: `MCFresh` (`public/app/js/mc-freshness.js`). Never `new Date(y, m, d)` (local tz) or hand-rolled month tables.
2. **Data files**: only via `lib/store.js`; use `readJSON(f, def, true)` (strict) before read-modify-write.
3. **Never read whole**: `data/*.json` (history ≈ 190 KB, sector_history ≈ 360 KB) — slice with `node -e`/`jq`. `public/app/js/dashboard.js` (3.2k lines) — `grep -n` then read a range.
4. Front-end paths: `/ui/css/mc.css`, `/ui/js/mc-*.js`, `/app/...`. If you move/add one, update `public/sw.js` (and bump `CACHE_NAME`), the `<script>/<link>` tags, `scripts/checks/verify_terminal_ui.js`.
5. New server endpoint = add to the matching `server/routes/*.js` AND `contracts/api.openapi.yaml`.
6. After any change: `npm test && npm run seo`. UI change → also load the page in headless Chromium (Playwright is preinstalled) and check for console errors.
7. Data commits come from the workflow only; code commits must not touch `data/*.json` except deliberate repairs. Running agents locally modifies `data/agent_*.json` — `git checkout data/` afterwards.

## Data feed (why dates go stale)
- NSE's cash API returns **only the latest session**; a blocked run loses that day unless recovered.
- GitHub runners are often blocked by NSE (timeouts/522). Fallback: our live server's `/api/history`. Enable with repo secrets **`LIVE_FEED_URL`** (`https://fii-diidata.mrchartist.com`) and **`LIVE_FEED_KEY`** (one value of the server's `API_KEYS`). `recoverFromLiveServer()` in `scripts/feed/fetch_data.js` merges only validated, missing sessions.
- F&O publishes later than cash; `backfillMissingFao()` fills it on later runs (also from the live server's 10 PM / 8 AM IST jobs).
- `npm run gaps` lists missing weekday sessions (holidays appear too). Never fabricate rows.

## Commands
`npm start` · `npm test` · `npm run seo` · `npm run gaps` · `npm run fetch` · `npm run agent:all`

## Shared-component contract (for reuse in sibling projects)
Anything in `public/ui/` stays free of FII/DII wording, data URLs and page ids; configuration via `data-*` attributes/globals; styling only through `mc.css` tokens. To lift a component: copy its numbered section from `mc.css` + its `mc-*.js`, list it in `public/ui/README.md`.
