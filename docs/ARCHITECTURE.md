# Architecture

## Principle: contract-first, language-agnostic seams
Components talk only through **files and HTTP shapes that are written down in `contracts/`**. Any component can be re-implemented in another language (Go, Rust, …) by honouring its contract; nothing else changes.

```
 NSE / NSDL ──► FEED ──► data/*.json ──► API ──► UI kit + App pages (browser)
                 │            ▲             │
                 │            └── AGENTS ◄──┘ (read data, write data/agent_*.json)
                 └─ fallback: live server /api/history
 SEO (static files + audit) · BRAND (asset generation) · CI (.github/workflows)
```

| Layer | Today (folder) | Contract it must keep | Planned language |
|---|---|---|---|
| **Feed** (fetch, validate, merge sessions) | `scripts/feed/`, `lib/` | writes `data/history.json`, `latest.json` per `contracts/session-row.schema.json`; invariants in the schema description | Node now → Rust candidate (single static binary, fast CI) |
| **Data store** | `data/*.json` | Schema + sorted newest-first + one row per `DD-Mon-YYYY` | unchanged (JSON in git); Postgres/Supabase later via `supabase/` |
| **API** | `server.js`, `api-guard.js`, `agent-ready.js` | `contracts/api.openapi.yaml` (+ access rules in `api-guard.js`) | Node now → **Go** |
| **Agents** | `agents/` | read `history.json`; write only `data/agent_state.json`, `agent_runs.json` | stay Node until the API moves, then Go |
| **UI kit** | `public/ui/` | `public/ui/README.md` component table; no product logic | JS/CSS (framework-free) |
| **App pages** | `public/*.html`, `public/app/` | consume only the API contract | JS/CSS |
| **SEO** | `seo/`, root files in `public/` | `npm run seo` passes | — |
| **Brand tooling** | `scripts/brand/` (Python + Node) | outputs to `public/brand/` unchanged | Python → **Rust** (only Python left: `build_brand_assets.py`; `tools/legacy/*.py` are dead) |

## Migration playbook (any layer)
1. Implement the new component beside the old one (`services/api-go/`, `tools/brand-rs/`); never edit in place.
2. Point it at the same `contracts/` and run the same checks: `test/contracts.test.js` for data, an HTTP diff of old vs new for the API.
3. Switch traffic/CI step; keep the old one one release as fallback; then delete it.
4. Update the module map in `CLAUDE.md` and the table above.

## Shared-code boundaries
- `lib/` = backend primitives (dates, store). In a Go/Rust port these become one package each with the same function names (`parse`, `format`, `compare`, `istToday`, `missingSessions`; `readJSON`, `writeJSON` atomic).
- Browser↔server date logic is duplicated deliberately (`MCFresh` vs `lib/dates.js`); both are covered by tests — change both together.

## Known debts (ordered)
1. `server.js` (~1.2k lines) mixes routing, notifications, market polling and cron → split into `routes/`, `jobs/`, `notify/` before the Go port so the port has clear units.
2. `public/index.html` (~4.9k lines) inlines the dashboard → extract sections into `public/app/` modules, one per tab.
3. `mc-ui.js` §6 and `mc.css` §13 are product-specific inside the "reusable" kit (see `public/ui/README.md`).
4. NSE blocks GitHub runners; real fix is running the feed on the live server (or a self-hosted runner) — the live-server fallback is the stopgap.
