# App layer (`public/app/` + page HTML)

Product-specific front end. File list: `README.md`.

- `js/dashboard.js` is ~3.2k lines: `grep -n "^function \|^async function \|^// ──"` to find your spot. Splitting it per tab is welcome (see `docs/ARCHITECTURE.md` debts); keep the load order explicit.
- **Net-only sessions** (`d.p === 1` in `/api/history-full`, `_partial` in the data): gross buy/sell is `null`. Render "—", never 0, and keep them out of gross sums. Net-based views (charts, streaks, regimes) include them.
- Dates in the browser: `MCFresh` (`js/mc-freshness.js`) mirrors `lib/dates.js`; change both together (tests cover both).
- Dashboard tabs and layout are fair game for redesign. When markers in `scripts/checks/verify_terminal_ui.js` no longer apply, update the list rather than keeping dead markup alive.
- Adding/moving assets: see the path note in `public/ui/CLAUDE.md` (service worker cache, tags, `?v=`).
