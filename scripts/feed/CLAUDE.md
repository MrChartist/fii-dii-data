# Data feed

NSE and its fallbacks → `data/history.json` + `latest.json`. Run by `.github/workflows/update_data.yml` (`npm run fetch`) and by the live server's cron.

## Source chain
1. **NSE** `fiidiiTradeReact`: authoritative, latest session only, and it **times out from cloud IPs** (GitHub runners and our live server alike).
2. **Mirrors** (`sources/groww.js` gross buy/sell/net ~10 sessions, cross-checked with `sources/moneycontrol.js` net ~30): accepted only if net = buy − sell, all legs > 0 and Moneycontrol agrees (±0.02 Cr). Rows tagged `mirror-groww`. Runs when NSE fails, and when the last 14 days have weekday gaps.
3. **Archives, net only** (`sources/stockezee.js` primary ~1 year, `sources/niftytrader.js` + Moneycontrol as cross-checks) via `net_backfill.js` / `scripts/backfill/backfill_net_archives.js`: rows tagged `archive-net`, `_partial: true`, gross legs `null`. Estimated rows are replaced, holidays derived into `data/market_holidays.json`.
4. **F&O participant OI** from `nsearchives.nseindia.com` (works from CI, no cookies, published later than cash): `backfillMissingFao()`.

## Habits that pay off
- Parse by cell content or JSON keys, not CSS classes (they are build hashes). A parser that can't match returns empty and the chain moves on. Keep a fixture in `test/fixtures/` for each source.
- Reconcile before writing (net = buy − sell, cross-source agreement). New sources are welcome; verify them against rows we already trust before relying on them (StockeZee matched all 136 NSE-sourced rows).
- Real rows are never overwritten by a lower-quality source; NSE data replaces a mirror/archive row for the same date.
- Mirrors are third-party sites: keep request volume tiny (a few GETs per run) and check their terms before commercial use. The durable fix is an NSE-reachable host (self-hosted runner on an Indian IP).
- `npm run gaps` shows missing weekday sessions (known holidays excluded).
