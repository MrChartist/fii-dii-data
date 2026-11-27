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
- **Source chain** (`scripts/feed/fetch_data.js`): NSE `fiidiiTradeReact` (authoritative, latest session only, **blocks cloud IPs incl. GitHub runners and our live server**) → public mirrors in `scripts/feed/sources/`: **Groww** (gross buy/sell/net, last ~10 sessions) cross-checked against **Moneycontrol** (net, last ~30). A mirror row is accepted only if net = buy − sell, all legs > 0, and Moneycontrol's net agrees (±0.02 Cr). Never overwrites an existing row; NSE data replaces a mirror row for the same date. Rows are tagged `_source: "mirror-groww"`.
- Mirror recovery runs when NSE fails **and** when NSE works but the last 14 days have weekday gaps. Holidays show as gaps and are simply not found on the mirrors.
- F&O (participant OI) comes from `nsearchives.nseindia.com` (reachable from CI), published later than cash; `backfillMissingFao()` fills it on later runs, including for mirror rows.
- Mirror parsers key on cell *content*, not CSS classes; if a site changes markup the parser returns `[]` and the chain falls through (fixtures in `test/fixtures/`). Mirrors are third-party sites: keep request volume tiny (2 GETs per run) and check their terms before commercial use.
- `npm run gaps` lists missing weekday sessions. Never fabricate rows; net-only older sessions (Moneycontrol, ~30 days) are NOT inserted because history requires gross buy/sell.

## Commands
`npm start` · `npm test` · `npm run seo` · `npm run gaps` · `npm run fetch` · `npm run agent:all`

## Shared-component contract (for reuse in sibling projects)
Anything in `public/ui/` stays free of FII/DII wording, data URLs and page ids; configuration via `data-*` attributes/globals; styling only through `mc.css` tokens. To lift a component: copy its numbered section from `mc.css` + its `mc-*.js`, list it in `public/ui/README.md`.
