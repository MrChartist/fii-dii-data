# FII & DII Data — agent guide (read this first, then open only the module you need)

Architecture & future Go/Rust migration plan: `docs/ARCHITECTURE.md`.

Indian institutional-flow dashboard (FII/FPI + DII cash, F&O participant OI, NSDL sectors). Node/Express server + a static front end in `public/`. Data lives as JSON in `data/` and is committed by a GitHub Action.

## Module map — one folder = one concern. Work inside ONE row at a time.

| Concern | Folder | Open this first | Notes |
|---|---|---|---|
| **UI kit** (reusable across projects) | `public/ui/` | `public/ui/README.md` | Tokens, navbar, dock, buttons, popovers, toast, motion, charts helpers. No FII/DII logic here. |
| **App pages** (this product only) | `public/*.html`, `public/app/` | `public/app/README.md` | `index.html` dashboard, `deals.html`, legal pages. Dashboard-only CSS/JS in `public/app/`. |
| **SEO** | `seo/` + root files in `public/` | `seo/README.md` | `npm run seo` audits titles/meta/canonical/JSON-LD/sitemap. |
| **Data feed** (NSE/NSDL → `data/`) | `scripts/feed/` | this file, "Data feed" | `fetch_data.js` (cash+F&O), `fetch_nsdl.js` (sectors). Run by `.github/workflows/update_data.yml`. |
| **Contracts** (API + data shapes; read before porting any layer) | `contracts/` | `docs/ARCHITECTURE.md` | OpenAPI + JSON Schema. Language-agnostic; Go/Rust ports must satisfy them. |
| **Shared backend utils** | `lib/` | — | `dates.js` (ALL date maths), `store.js` (ALL JSON read/write). Never re-implement these. |
| **Agents** (signals) | `agents/`, `agent-runner.js` | `AGENTIC_AI_PLAN.md` | Each agent: `run()` → reads `data/`, writes `data/agent_state.json`. Shared helpers in `agents/agent-utils.js`. |
| **Server / API** | `server.js`, `api-guard.js`, `agent-ready.js` | — | `server.js` is large (route map via `grep -n "app\.\(get\|post\)" server.js`). `api-guard.js` = access control. `agent-ready.js` = Markdown/MCP/llms endpoints. |
| **One-off backfills / repairs** | `scripts/backfill/` | script header comment | Not run in CI. |
| **Checks** | `scripts/checks/`, `test/` | — | `npm test` = unit + data integrity + UI contract. |
| **Brand sources** | `brand-source/`, `scripts/brand/` | — | Generates `public/brand/*`. |
| **Docs / marketing / legacy** | `docs/`, `docs/marketing/`, `tools/legacy/` | — | `tools/legacy` is dead code kept for reference; do not extend. |

## Rules that save tokens and prevent bugs
1. **Dates**: canonical format is `DD-Mon-YYYY` (`20-Nov-2026`). Only use `lib/dates.js` (server) or `MCFresh` in `public/app/js/mc-freshness.js` (browser). Never `new Date(y, m, d)` (local tz) or hand-rolled month tables.
2. **Data files**: only via `lib/store.js`. Use `readJSON(f, def, true)` (strict) before any read-modify-write.
3. **Never read** `data/*.json` whole into context (history ≈ 190 KB, sector_history ≈ 360 KB). Use `node -e` or `jq` for a slice.
4. **Never read** `public/index.html` whole (≈ 5k lines). `grep -n` for an id/section, then read that range.
5. Front-end paths: `/ui/css/mc.css`, `/ui/js/mc-*.js`, `/app/...`. If you rename/move one, update `public/sw.js` (and bump `CACHE_NAME`), the `<script>/<link>` tags, `scripts/checks/verify_terminal_ui.js`.
6. After any change run `npm test && npm run seo`.
7. Commit data only via the workflow; code commits must not touch `data/*.json` except deliberate repairs.

## Data feed (why dates go stale)
- NSE's cash API returns **only the latest session**. If a run is blocked, that day is lost unless recovered.
- GitHub runners are frequently blocked by NSE (timeouts / 522). Fallback: our live server's `/api/history`. Enable by adding repo secrets **`LIVE_FEED_URL`** (e.g. `https://fii-diidata.mrchartist.com`) and **`LIVE_FEED_KEY`** (one value from the server's `API_KEYS` env). `recoverFromLiveServer()` in `scripts/feed/fetch_data.js` merges only validated, missing sessions.
- F&O (participant OI) publishes later than cash; `backfillMissingFao()` fills it on later runs.
- `npm run gaps` lists missing weekday sessions (holidays appear too — verify before backfilling).
- Gaps need real data: `scripts/backfill/` scripts or the live server's history; never fabricate rows.

## Commands
`npm start` · `npm test` · `npm run seo` · `npm run gaps` · `npm run fetch` · `npm run agent:all`

## Shared-component contract (for reuse in sibling projects)
Anything in `public/ui/` must stay free of FII/DII wording, data URLs and page ids, take config via `data-*` attributes or `window.MC_CONFIG`-style globals, and ship its own CSS in `ui/css/mc.css` (tokens → base → chrome → controls). To lift a component into another project: copy its section from `mc.css` (numbered headings 1–17) and its `mc-*.js`; list it in `public/ui/README.md`.
