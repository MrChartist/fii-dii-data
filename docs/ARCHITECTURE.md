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
| **Feed** (fetch, validate, merge sessions) | `scripts/feed/`, `lib/` | writes `data/history.json`, `latest.json` per `contracts/session-row.schema.json`; invariants in the schema description. Source chain: NSE → Groww/Moneycontrol mirrors → net-only archives (`_partial` rows, gross = null) — see `scripts/feed/CLAUDE.md` | Node now → Rust candidate (single static binary, fast CI) |
| **Data store** | `data/*.json` | Schema + sorted newest-first + one row per `DD-Mon-YYYY` | unchanged (JSON in git); a SQL store can be added behind `lib/store.js` later |
| **API** | `server/`, `api-guard.js`, `agent-ready.js` | `contracts/api.openapi.yaml` (+ access rules in `api-guard.js`) | Node now → **Go** |
| **Agents** | `agents/` | read `history.json`; write only `data/agent_state.json`, `agent_runs.json` | stay Node until the API moves, then Go |
| **UI kit** | `public/ui/` | `public/ui/README.md` component table; no product logic | JS/CSS (framework-free) |
| **App pages** | `public/*.html`, `public/app/` | consume only the API contract | JS/CSS |
| **SEO** | `seo/`, root files in `public/` | `npm run seo` passes | — |
| **Brand tooling** | `scripts/brand/` (Python + Node) | outputs to `public/brand/` unchanged | Python → **Rust** (only Python left: `build_brand_assets.py`) |

## Migration playbook (any layer)
1. Implement the new component beside the old one (`services/api-go/`, `tools/brand-rs/`); never edit in place.
2. Point it at the same `contracts/` and run the same checks: `test/contracts.test.js` for data, an HTTP diff of old vs new for the API.
3. Switch traffic/CI step; keep the old one one release as fallback; then delete it.
4. Update the module map in `CLAUDE.md` and the table above.

## Shared-code boundaries
- `lib/` = backend primitives (dates, store). In a Go/Rust port these become one package each with the same function names (`parse`, `format`, `compare`, `istToday`, `missingSessions`; `readJSON`, `writeJSON` atomic).
- Browser↔server date logic is duplicated deliberately (`MCFresh` vs `lib/dates.js`); both are covered by tests — change both together.

## Known debts (ordered)
1. NSE blocks cloud IPs (CI and the live server). Mirrors (Groww + Moneycontrol) are the working fallback but are third-party; the durable fix is an NSE-reachable host (self-hosted runner on an Indian IP) so NSE stays the single authoritative source.
2. `public/app/js/dashboard.js` (3.2k lines) is still one file: split per tab (`hero`, `fno`, `analytics`, `sectors`, `export`) with a tiny module loader.
3. `mc-ui.js` §6 (live quotes) and footer links are product-specific inside the "reusable" kit (see `public/ui/README.md`).
4. `server/routes/market.js` holds two in-memory caches inline; move them to `services/` when the Go API port starts.
