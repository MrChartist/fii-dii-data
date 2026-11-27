# FII & DII Data — project guide

Indian institutional-flow dashboard: FII/FPI + DII cash flows, F&O participant OI, NSDL sectors. Node/Express server + framework-free front end in `public/`. Data is JSON in `data/`, refreshed by a GitHub Action. Architecture and the planned Go/Rust migration: `docs/ARCHITECTURE.md`.

**How to use this guide.** Everything here is a default with a reason, not a wall. If a better approach exists, take it and update the guide in the same change so it stays true. Module-specific guidance lives next to the code (`<folder>/CLAUDE.md`) and loads only when you work there, so start in the folder you are changing.

## Module map
| Concern | Folder | Guide |
|---|---|---|
| UI kit (portable across projects) | `public/ui/` | `public/ui/CLAUDE.md` |
| App front end (this product) | `public/*.html`, `public/app/` | `public/app/CLAUDE.md` |
| SEO | `seo/`, root files of `public/` | `seo/CLAUDE.md` |
| Data feed (NSE / mirrors / archives → `data/`) | `scripts/feed/` | `scripts/feed/CLAUDE.md` |
| Server (API, jobs) | `server.js`, `server/`, `api-guard.js`, `agent-ready.js` | `server/CLAUDE.md` |
| Agents (signals) | `agents/` | `agents/CLAUDE.md` |
| Contracts (OpenAPI + JSON Schema) | `contracts/` | `docs/ARCHITECTURE.md` |
| Shared backend helpers | `lib/` | `lib/dates.js` (all date maths), `lib/store.js` (all JSON I/O) |
| Backfills / checks / brand | `scripts/backfill/`, `scripts/checks/`, `scripts/brand/` | script header comments |
| Docs | `docs/` | `docs/plans/` mention removed features (Telegram): history, not spec |

## Working agreements (short, and they exist to save time)
1. **Verify what you change.** `npm test` and `npm run seo` for code; for UI also open the page in headless Chromium (Playwright is preinstalled) and watch the console. Add a test when you fix a bug or add a parser.
2. **Real data only.** Unknown is `null` (or a flagged partial row), never a guessed number or a silent zero. This is the one firm rule, because wrong market figures look identical to right ones.
3. **Reuse the helpers.** Dates through `lib/dates.js` (canonical `DD-Mon-YYYY`), data files through `lib/store.js`. They exist because four hand-rolled date parsers had drifted apart.
4. **Contracts follow code.** Changing an API shape or a row field means updating `contracts/` and its test in the same change.
5. **Keep context cheap.** `data/*.json` and `public/app/js/dashboard.js` are large: slice with `node -e`/`jq` or `grep -n` first. A tip, not a prohibition.
6. **Data commits.** The workflow normally commits `data/`; deliberate repairs and backfills by hand are fine, just say so in the message.
7. **Leave it tidier.** Remove dead code you find; mention anything bigger in the summary.

## Commands
`npm start` · `npm test` · `npm run seo` · `npm run gaps` · `npm run fetch` · `npm run agent:all` · `node scripts/backfill/backfill_net_archives.js --dry`
