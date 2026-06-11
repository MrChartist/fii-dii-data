# FII & DII Data — Feature & UX Roadmap

> Compiled June 2026 from a five-angle research sweep (competitor features, trader
> needs, dashboard UX practice, alerting/engagement, free data sources), with every
> load-bearing claim adversarially fact-checked by three independent passes.
> Confidence levels noted where it matters.

## The headline finding

Raw daily FII/DII tables are **commoditized** — Groww, 5paisa, Trendlyne and
Moneycontrol all ship them free. What traders actually act on (and currently
hand-compute) are **derived metrics and interpretation**: cumulative-flows-vs-Nifty
overlays, DII absorption ratios, multi-day streaks, and "is this cash selling hedged
in futures?" cross-references. This dashboard's existing differentiators — the NSDL
sector view, the Telegram bot, and the AI synthesis — are genuinely rare (no
competitor surveyed offers AI synthesis). The roadmap defends those and closes the
interpretation gap.

---

## Tier 1 — High impact, mostly uses data we already have

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1.1 | Nifty 50 overlay + cumulative flow view (7D/30D/90D/1Y) on the history chart | ✅ Shipped | `/api/nifty-history` (Yahoo proxy, cached) + "Cumulative" chart mode with Nifty on a secondary axis. The single most-requested chart traders build by hand. |
| 1.2 | Daily signal classification + 30-day replay timeline | ✅ Shipped | Quadrant classification (FII/DII buy-sell) rendered as a 30-session signal strip on the hero. Pattern proven by Sensibull's flagship free feature. |
| 1.3 | FII index-futures long-short ratio as a time series with percentile bands | ✅ Shipped | Ratio chart in the F&O tab with 10th/90th percentile bands — a single reading is meaningless without its own history. |
| 1.4 | Provisional vs confirmed data labeling | ✅ Shipped | "PROVISIONAL" chip + tooltip on the latest session explaining the NSE-evening vs custodian-confirmed reconciliation chain. Next step: auto-reconcile against NSDL daily FPI figures (`data/fpi_daily.json` already fetched). |
| 1.5 | Public Data & API documentation page + full-history CSV download | ✅ Shipped | `/data-api.html` documents every endpoint and offers one-click CSV of the full history — positions the site as the backtesting-friendly free option. |

## Tier 2 — UX ("more user friendly")

| # | Improvement | Status | Notes |
|---|-------------|--------|-------|
| 2.1 | Plain-language glossary tooltips on jargon (FII, DII, OI, PCR, long-short, absorption) | ✅ Shipped | Dotted-underline terms with tap/hover tooltips, applied at the hero and F&O headers. |
| 2.2 | Skippable first-visit tour (3 steps) | ✅ Shipped | One concept per step, dismissable, stored in localStorage. |
| 2.3 | Specific empty/stale states ("NSE publishes ~6 PM IST — tap to retry") | ✅ Shipped | Replaces generic spinners/blank panels for the data-wait window. |
| 2.4 | Colorblind-safe redundancy | ✅ Shipped | ± signs/▲▼ markers throughout, plus a diagonal texture on selling (red) bars in the 45-day matrices so direction never relies on hue alone. |
| 2.5 | Mobile column pruning for the daily archive | ✅ Shipped | Below 640px the gross buy/sell columns hide, keeping Date, FII Net, DII Net, Total. Full card-transform remains a future option. |
| 2.6 | Sticky top KPI strip on scroll | ✅ Shipped | Date + FII/DII/Net follow the user once the hero scrolls out of view. |

## Tier 3 — New data integrations (all free sources)

| # | Source | Unlocks | Status / Caveats |
|---|--------|---------|------------------|
| 3.1 | NSE bulk/block deals (`/api/snapshot-capital-market-largedeal`) | "Which stocks institutions traded today" panel | ✅ Shipped — `/api/large-deals` endpoint + Flow Analytics panel (top 12 deals by value; hidden gracefully when NSE blocks the host). NSE edge-blocks datacenter IPs; works from the production VPS context. |
| 3.2 | NSDL daily FPI trends | Reconcile provisional NSE numbers with custodian-settled figures | ✅ Shipped — `/api/fpi-daily` endpoint + hero line showing the NSDL custodian-confirmed equity net beside the provisional NSE number. Primary-vs-secondary column split remains a parser enhancement. |
| 3.3 | AMFI monthly MF/SIP flows (`portal.amfiindia.com/spages/am{mon}{yyyy}repo.xls`) | SIP-vs-FII narrative (SIPs grew ~7x FY17→FY26, verified vs AMFI) | Planned. URL pattern verified live and unauthenticated **but only resolves back to ~2019** — deeper history must be seeded manually. |
| 3.4 | India VIX + Nifty daily closes | VIX overlay on flow charts (near-unique) | ✅ Foundation shipped — every post-market fetch persists Nifty+VIX closes to `market_history.json`, served at `/api/market-history`. Chart overlay lands once enough history accrues. |
| 3.5 | CDSL FPI publications (daily trends xls, fortnightly sector, ODI/P-note) | Cross-check NSDL; country-wise AUC view | Planned. Verified live by two independent checks. |

**Verified caveat:** NSE's website terms permit personal/non-commercial use only —
keep monetization to donations/affiliates, never sell NSE-derived data. Prefer
`archives.nseindia.com` for historical backfills (more tolerant of scripted access).

## Tier 4 — Alerts & engagement

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 4.1 | Interactive Telegram commands: `/streaks`, `/absorption` | ✅ Shipped | Joins `/latest`, `/fno`, `/sector`, `/regime`, `/weekly`. The `/fiidii`-command pattern has Indian precedent (TxAction bot). |
| 4.2 | "What changed vs yesterday" framing in the AI brief | ✅ Shipped | Groq prompt now receives the previous session and leads with the delta — TLDR-newsletter format discipline (verified ~44–46% open rates). |
| 4.3 | User-set alert thresholds | ✅ Shipped | Telegram `/alert 5000` sets a personal ±₹ Cr FII-net threshold (once-per-session dedupe, `/alert off` to remove). |
| 4.4 | Quiet hours + digest-vs-instant alert choice | Planned | Per-category toggles already exist; add time windows. Note: precise "N pushes/week" benchmarks did **not** survive fact-checking — the durable lesson is caps and controls. |
| 4.5 | WhatsApp channel (potential premium tier) | Idea | Proven paid channel in India (Wegro: ₹129–1,399/mo with FII/DII as a headline category, verified). Mind DPDP Act separate-consent rules (deadline May 2027, verified). |

## Infrastructure hardening (shipped alongside)

- **Self-hosted Chart.js + html2canvas** (`public/vendor/`) with CDN fallback —
  charts survive CDN outages/blocks and work offline via the service worker;
  chart renderers guard against the library failing to load entirely.
- **Sector sparklines now plot real cumulative FPI flows** from `historyCr` —
  they were previously random curves regenerated on every render.
- **`npm run test:ui` contract refreshed** — stale "Pro Terminal 2.x" markers
  removed, 14 markers added covering every shipped roadmap feature (34 total).
- **Browser-verified**: 31 Playwright checks pass against a live server (tour,
  charts, rollups, theme persistence, sticky KPI, mobile pruning, endpoints).

## Explicitly out of scope

- **Per-stock FII holdings** — requires paid/bulk shareholding data.
- **Intraday institutional flows** — not published by any source.
- **Paywalling the core data** — the distribution advantage is being the free, fast, *interpreted* option.

## Fact-check appendix (claims that did NOT survive)

- "Oct 2024 DII absorption was ~60%" — **refuted**: DIIs bought a record ~₹1.07 lakh
  crore against ~₹0.94–1.14 lakh crore FII selling (absorption ~94–114%).
- "3+ weeks of FII selling → 3–8% Nifty drawdown" — circularly sourced to content
  farms; treat streaks as context, not a predictor.
- "43% disable notifications / 2–5 pushes per week sweet spot" — a marketing mashup;
  the Reuters figure has a different denominator and the sweet-spot range is
  contradicted by the survey it cites.
- "AMFI history to 1999 via URL pattern" — pattern only resolves to ~2019.
- "Skeleton screens cut abandonment 30%" — unsourced vendor stat; research shows
  mixed results (still worth doing for polish).
