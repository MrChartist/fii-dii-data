<p align="center">
  <img src="docs/dashboard_hero.png" alt="FII & DII Data Dashboard Hero" width="100%">
</p>

# 📊 FII & DII Data — Institutional Money Matrix

> **Live Dashboard** for tracking Foreign Institutional Investor (FII/FPI) and Domestic Institutional Investor (DII) flows in Indian equity markets.
>
> 🌐 **Live at:** [fii-diidata.mrchartist.com](https://fii-diidata.mrchartist.com/)
>
> Built by [@mr_chartist](https://twitter.com/mr_chartist)

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **Real-Time FII/DII Flows** | Latest net buy/sell data with flow strength meter |
| **45-Day Heatmaps** | GitHub-style concentration matrices for FII sell-off depth & DII absorption |
| **F&O Derivatives** | Participant-wise Open Interest (Long vs Short ratio bars) |
| **Multi-Timeframe Tables** | Daily, Weekly, Monthly & Annual archives with magnitude bars + expandable rows |
| **Interactive Charts** | Chart.js-powered flow visualizations with timeframe toggles |
| **Sector Allocation** | NSDL fortnightly FPI sector data with sparkline trends & zoom modal |
| **Dark / Light Mode** | OLED black dark mode & clean light theme |
| **Full-Page Export** | html2canvas-powered screenshot & Post to 𝕏 |
| **PWA Installable** | Progressive Web App with offline support |
| **SEO Optimized** | JSON-LD structured data, Open Graph, BreadcrumbList, canonical URL |
| **Security Hardened** | X-Content-Type-Options, X-Frame-Options, Referrer-Policy headers |

---

## 📸 Tab-by-Tab Walkthrough

### 1. FII/DII Data (Home)

The default landing view showing the **latest extracted session** with:

- **Hero Card** — FII/FPI Net vs DII Net with a red/green accent border indicating flow direction
- **Flow Strength Meter** — Visual split showing FII aggression vs DII support percentage
- **Streak Trackers** — Current consecutive buying/selling days with cumulative velocity
- **Quick Stats** — 5-Year cumulative flows, SIP run-rate, FII NSE500 ownership
- **45-Day Heatmaps** — Color-coded concentration matrices (FII sell depth & DII absorption)

![45-Day Heatmaps](docs/heatmaps.png)
![FII/DII Data Tab](public/screenshots/01_home_fii_dii_date.png)

---

### 2. F&O Positions

Derivatives positioning analysis with:

- **Sentiment Badge** — Mildly Bearish / Bullish / Neutral classification
- **Open Interest Breakdown** — FII vs DII positioning across Index Futures, Stock Futures, Index Calls & Puts
- **Long vs Short Ratio Bars** — Visual ratio indicators for each instrument
- **Historical Positioning Chart** — 20-period trajectory with toggleable FII Futures, Calls, Puts & DII Futures

![F&O Positions Tab](public/screenshots/02_fno_positions.png)

---

### 3. Flow Analytics

Complete institutional flow archive with:

- **Interactive FII/DII Chart** — Bar chart with 8-month history, hover for exact metrics
- **Multi-Timeframe Sub-Tabs** — Daily (expandable rows), Weekly (12W), Monthly (24M), Annual Tracker
- **Smart Filters** — FII Bloodbath (< -₹5k Cr), DII Absorption (> +₹5k Cr), Extreme Divergence
- **Date Range Filter** — Custom FROM/TO date filtering
- **CSV Export** — Download filtered data
- **Expandable Row Details** — Click any row for a breakdown chart + buy/sell ratios

![Databases Matrix](docs/matrix.png)
![Flow Analytics Tab](public/screenshots/03_databases_matrices.png)

---

### 4. Sectors

NSDL Fortnightly FPI Allocation data with:

- **Methodology Explainer** — How SEBI/NSDL sector data is calculated
- **24 Sector Cards** — AUM %, FII Ownership %, sparkline mini-charts, 1Y Flow & Momentum Alpha
- **Zoom Modal** — Click any sector card for a full-screen chart with 24-fortnight trend history, stat pills (1Y Flow, AUM Weight, FII Ownership, Fortnight Flow), hover tooltips
- **Interactive Sector Chart** — Toggleable Bar / Line / Scatter views
- **Sort Modes** — Total AUM, Fortnight Δ, 1Y Net Flow, A-Z
- **Backend Data** — Sector data served via `/api/sectors` endpoint

![Sectors Tab](public/screenshots/05_sectors.png)

---

### 5. Docs

Comprehensive documentation covering:

- **Dashboard Architecture** — 5-tab system overview
- **Data Sources** — NSE TRDREQ, NSDL FPI Reports, BSE Classification
- **Methodology** — How FII/DII data is extracted and processed
- **Formulas** — Flow Strength Meter, Momentum Alpha, Streak calculations
- **Export Tools** — Screenshot, CSV, Post to 𝕏

![Docs Tab](public/screenshots/06_docs.png)

---

## 🛠️ Tech Stack

| Technology | Usage |
|-----------|-------|
| **Node.js + Express** | Backend API server with cron-based NSE data fetching |
| **HTML5** | Single-file monolithic dashboard |
| **CSS3** | Custom properties, OLED dark mode, glassmorphism, ambient orbs |
| **JavaScript** | Vanilla JS with Chart.js 3.9.1 |
| **Chart.js** | Interactive bar/line charts + sector sparklines |
| **html2canvas** | Full-page screenshot export |
| **node-cron** | Automated data fetching (6:00, 6:30, 7:00 PM IST Mon-Fri) |
| **PWA** | Service Worker v5 + Web App Manifest |

## 📂 Project Structure

```
FII and DII data/
├── server.js                     # Express backend + cron scheduler
├── package.json                  # Dependencies & scripts
├── public/
│   ├── index.html                # Main dashboard (single-file SPA)
│   ├── manifest.json             # PWA manifest
│   ├── sw.js                     # Service Worker (network-first, API bypass)
│   ├── robots.txt                # Search engine crawler rules
│   ├── sitemap.xml               # XML sitemap for SEO
│   ├── icons/
│   │   ├── icon-192.png          # PWA icon (192x192)
│   │   └── icon-512.png          # PWA icon (512x512)
│   └── screenshots/              # Tab screenshots for README
│       ├── 01_home_fii_dii_date.png
│       ├── 02_fno_positions.png
│       ├── 03_databases_matrices.png
│       ├── 05_sectors.png
│       └── 06_docs.png
├── scripts/
│   ├── fetch_data.js             # NSE data fetcher + JSON storage
│   ├── seed_history.js           # Historical data seeder
│   └── seed_sectors.js           # Sector data seeder
├── data/
│   ├── history.json              # Rolling FII/DII daily history
│   ├── sectors.json              # Sector allocation data (24 sectors)
│   └── fetch-log.json            # Fetch activity log
└── README.md                     # This file
```

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Seed historical data (first time only)
node scripts/seed_history.js
node scripts/seed_sectors.js

# 3. Start the server
npm start
# → Server runs on http://localhost:3000

# 4. Development (auto-reload)
npm run dev
```

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/data` | Latest FII/DII snapshot |
| `GET` | `/api/history` | Last 60 days of history |
| `GET` | `/api/history-full` | Full history (800 records) for charts |
| `GET` | `/api/sectors` | Sector allocation with trend data |
| `GET` | `/api/market` | Nifty 50 & India VIX (Yahoo Finance proxy) |
| `GET` | `/api/status` | Server health + recent fetch logs |
| `POST` | `/api/refresh` | Trigger manual NSE data fetch |

## ☁️ Deployment

### Hostinger / VPS
```bash
npm install
NODE_ENV=production node server.js
```
Use a process manager like PM2: `pm2 start server.js --name fii-dii`

### Environment Variables
| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |

## 📊 Data Flow

```
NSE India API ──→ server.js (cron) ──→ data/history.json
                                    ──→ public/index.html (fetch on load)
                                    ──→ /api/* endpoints

NSDL FPI Reports ──→ seed_sectors.js ──→ data/sectors.json
                                     ──→ /api/sectors
```

## 🔐 Security Headers

All responses include:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

## 🔗 Links

- **Live Dashboard:** [fii-diidata.mrchartist.com](https://fii-diidata.mrchartist.com/)
- **Twitter/X:** [@mr_chartist](https://twitter.com/mr_chartist)

---

## 🤖 Agentic AI Road Map (2026)

**FII & DII Data** serves as our **Regime Detection Feed**. It identifies the institutional context for all other agents.

### Key Agent Integrations:
- **Regime Trigger Agent:** Switches TradeBook's risk parameters to 'Conservative' when institutional sell-off streaks are detected.
- **Sector Rotation Monitor:** Proactively alerts when FPI allocation rotates away from top watchlist sectors.
- **Flow Divergence Alert:** Autonomous signals when FII/DII divergence reaches historical extremes.

---

<p align="center">
  <b>Made with ❤️ by Mr. Chartist</b><br>
  <i>Institutional Money Matrix — Where the smart money flows</i>
</p>
