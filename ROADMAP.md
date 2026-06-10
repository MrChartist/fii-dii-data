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
| 2.4 | Colorblind-safe redundancy | Partial | ± signs and ▲/▼ markers exist in most views; remaining: lightness ramp + value labels inside the 45-day heatmap cells. Red/green hue alone fails ~8% of male users. |
| 2.5 | Mobile table→card transforms with column pruning | Planned | Stack label/value pairs per row-card, 3–4 key fields visible, rest behind a tap. |
| 2.6 | Sticky top KPI strip on scroll | Planned | Net FII/DII + stance always visible following F-pattern scanning. |

## Tier 3 — New data integrations (all free sources)

| # | Source | Unlocks | Status / Caveats |
|---|--------|---------|------------------|
| 3.1 | NSE bulk/block deals (`/api/snapshot-capital-market-largedeal`) | "Which stocks institutions traded today" panel | ✅ Endpoint shipped (`/api/large-deals`, cached, graceful failure). NSE edge-blocks datacenter IPs; works from the production VPS / GH Actions context. |
| 3.2 | NSDL daily FPI trends (equity/debt, **primary vs secondary** split) | Reconcile provisional NSE numbers; primary-market flows nobody shows clearly | Fetcher exists (`scripts/fetch_nsdl.js` → `fpi_daily.json`); UI panel pending. WAF requires browser UA; block is variable (403/503). |
| 3.3 | AMFI monthly MF/SIP flows (`portal.amfiindia.com/spages/am{mon}{yyyy}repo.xls`) | SIP-vs-FII narrative (SIPs grew ~7x FY17→FY26, verified vs AMFI) | Planned. URL pattern verified live and unauthenticated **but only resolves back to ~2019** — deeper history must be seeded manually. |
| 3.4 | India VIX daily closes | VIX overlay on flow charts (near-unique; StockEdge's VIX overlay unconfirmed) | Planned: persist daily close from the existing `/api/market` fetch into a history file. |
| 3.5 | CDSL FPI publications (daily trends xls, fortnightly sector, ODI/P-note) | Cross-check NSDL; country-wise AUC view | Planned. Verified live by two independent checks. |

**Verified caveat:** NSE's website terms permit personal/non-commercial use only —
keep monetization to donations/affiliates, never sell NSE-derived data. Prefer
`archives.nseindia.com` for historical backfills (more tolerant of scripted access).

## Tier 4 — Alerts & engagement

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 4.1 | Interactive Telegram commands: `/streaks`, `/absorption` | ✅ Shipped | Joins `/latest`, `/fno`, `/sector`, `/regime`, `/weekly`. The `/fiidii`-command pattern has Indian precedent (TxAction bot). |
| 4.2 | "What changed vs yesterday" framing in the AI brief | ✅ Shipped | Groq prompt now receives the previous session and leads with the delta — TLDR-newsletter format discipline (verified ~44–46% open rates). |
| 4.3 | User-set alert thresholds ("alert me when FII < −₹5,000 Cr") | Planned | Via Telegram command + push preference; the strongest cross-source pattern is user control + tiering. |
| 4.4 | Quiet hours + digest-vs-instant alert choice | Planned | Per-category toggles already exist; add time windows. Note: precise "N pushes/week" benchmarks did **not** survive fact-checking — the durable lesson is caps and controls. |
| 4.5 | WhatsApp channel (potential premium tier) | Idea | Proven paid channel in India (Wegro: ₹129–1,399/mo with FII/DII as a headline category, verified). Mind DPDP Act separate-consent rules (deadline May 2027, verified). |

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
