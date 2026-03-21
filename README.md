<p align="center">
  <img src="screenshots/01_home_fii_dii_date.png" alt="FII & DII Data Dashboard" width="100%">
</p>

# 📊 FII & DII Data — Institutional Money Matrix

> **Live Dashboard** for tracking Foreign Institutional Investor (FPI/FII) and Domestic Institutional Investor (DII) flows in Indian equity markets.
>
> 🌐 **Live at:** [fii-diidata.mrchartist.com](https://fii-diidata.mrchartist.com/)
>
> Built by [@mr_chartist](https://twitter.com/mr_chartist)

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| ⚡ **Real-Time FII/DII Flows** | Latest net buy/sell data with flow strength meter, streak trackers, and 45-day heatmaps |
| 📊 **FPI Macro Analytics** | Daily, monthly, quarterly & yearly FPI investment trends from NSDL (2005–present) |
| 🌐 **Sector Allocation** | Fortnightly NSDL FPI sector data with gradient sparklines and on-hover spaghetti chart |
| 🤿 **Deep Dive Module** | Country-wise AUC donut chart, trade-wise ISIN-mapped equity flows, debt utilisation & ODI/PN |
| 🗄️ **Multi-Timeframe Archives** | Daily, Weekly, Monthly & Annual databases with magnitude bars, filters & CSV export |
| 🎲 **Live F&O Derivatives** | Participant-wise Open Interest from NSE — FII/DII index futures, stock futures, calls & puts |
| 📖 **Built-in Documentation** | Comprehensive in-app user manual with formulas, data sources & methodology |
| 🌙 **Dark / Light Mode** | OLED black dark mode & clean light theme |
| 📷 **Full-Page Export** | html2canvas-powered screenshot & Post to 𝕏 |
| 📱 **PWA Installable** | Progressive Web App with offline support |
| 🔍 **SEO Optimized** | JSON-LD structured data, Open Graph, Twitter Cards, canonical URL |
| 📑 **Data Source Citations** | Every tab has clickable source badges linking to official NSE/NSDL/SEBI pages with detailed tooltips |

---

## 📸 Tab-by-Tab Walkthrough

### 1. ⚡ Live NSE (Home)
The default landing view covering immediately actionable institutional activity.
- **Hero Card**: FII/FPI Net vs DII Net with visual aggression borders
- **Flow Strength Meter**: `FII_NET / (|FII_NET| + |DII_NET|) × 100` — visual split of FII aggression vs DII support
- **Streak Trackers**: Consecutive buying/selling days with aggregated capital velocity
- **45-Day Heatmaps**: GitHub-style concentration matrices — FII sell-off depth & DII absorption density
- **Quick Stats**: 5-Year cumulative flows, SIP run-rate, FII NSE500 ownership

### 2. 📊 FPI Macro
Macro-level historical trajectories and systemic liquidity shifts sourced from NSDL.
- **FPI Daily Summary**: Latest equity, debt, and hybrid net investment with summary stat cards
- **Institutional Flow Canvas**: Chart.js canvas plotting FII vs DII flows (Daily/Weekly/Monthly/Annual toggles)
- **Quarterly FPI Breakdown**: Quarter-over-quarter equity and debt allocations (2015–present)
- **Yearly & Monthly Heatmap**: Multi-year monthly data (2005–2026) showing FPI investment patterns

### 3. 🌐 Sectors
Fortnightly FPI Allocation tracking from NSDL/CDSL to spot smart-money industry rotation.
- **Sector Cards**: AUM %, FII Ownership %, and 24-fortnight sparkline charts with gradient fills
- **FPI Sector Flow Trend**: Interactive 8-sector comparative line chart with on-hover focus fading
- **Scoreboard**: Top 8 inflows/outflows ranked by cumulative net flow with progress bars
- **Sort Modes**: Total AUM, Fortnight Δ, 1-Year Net Flow, or Alphabetical

### 4. 🤿 Deep Dive
Advanced datasets bridging macroeconomic demographics and debt thresholds.
- **Trade-Wise Engine**: Granular monthly flow tracking mapped to Nifty 500 via ISIN cross-referencing
- **Country AUC**: Donut chart of FPI capital sources (USA, Singapore, Luxembourg, Mauritius, etc.)
- **ODI / P-Notes**: Offshore Derivative Instrument tracking — capital entering India via P-Notes
- **Debt Utilisation**: FPI debt investment limits vs actual utilisation with progress indicators

### 5. 🗄️ Databases
Complete institutional flow archives with Bloomberg-terminal grade tabular rendering.
- **4 Timeframes**: Daily (Last 15), Weekly (12W), Monthly (24M), Annual Tracker
- **Filters**: FII Bloodbath (< -₹5k Cr), DII Absorption, Divergence
- **CSV Export**: Custom FROM/TO date range with instant download

### 6. 🎲 F&O Derivatives
Live participant-wise Open Interest from NSE `participant-wise-open-interest` API.
- **OI Breakdown**: FII/DII Long vs Short for Index Futures, Stock Futures, Index Calls & Puts
- **Sentiment Engine**: Heuristic scoring algorithm → Highly Bullish / Mildly Bullish / Neutral / Mildly Bearish / Highly Bearish
- **Historical Chart**: 20-period trajectory for FII Futures, Calls, Puts, and DII Futures
- **3-Tier Proxy**: Express server → corsproxy.io → allorigins.win for reliable data fetching

### 7. 📖 Docs
Built-in user manual with 8 detailed sections covering every feature, formula, and data source.

---

## 💻 Step-by-Step Installation Guide

The tracker runs via its **Node.js + Express backend** (live scraping + API proxy) or as a **static site** with JSON fallbacks.

### 🍏 macOS
```bash
# 1. Install prerequisites (via Homebrew)
brew install node git

# 2. Clone & enter repo
git clone https://github.com/MrChartist/fii-dii-data.git
cd fii-dii-data

# 3. Install dependencies
npm install

# 4. Start the server
node server.js

# 5. Open http://localhost:3000
```

### 🪟 Windows
```cmd
REM 1. Install Node.js from https://nodejs.org and Git from https://git-scm.com

REM 2. Clone & enter repo
git clone https://github.com/MrChartist/fii-dii-data.git
cd fii-dii-data

REM 3. Install dependencies
npm install

REM 4. Start the server
node server.js

REM 5. Open http://localhost:3000
```

### 🐧 Linux (Ubuntu/Debian)
```bash
# 1. Install prerequisites
sudo apt update && sudo apt install -y nodejs npm git

# 2. Clone & enter repo
git clone https://github.com/MrChartist/fii-dii-data.git
cd fii-dii-data

# 3. Install dependencies
npm install

# 4. Start the server
node server.js

# 5. Open http://localhost:3000
```

### 🌍 Static Deployment (No Server Required)
Simply open `fii_dii_india_flows_dashboard.html` directly in a browser. All data endpoints fall back to local JSON files in `/data/`.

---

## 🌳 Project Structure

```
📁 fii-dii-data/
├── 📄 fii_dii_india_flows_dashboard.html   # Main Client App (HTML/CSS/JS Monolith)
├── 📄 server.js                            # Express backend + API proxies
├── 📄 package.json                         # Dependencies
├── 📄 manifest.json                        # PWA manifest
├── 📄 sw.js                                # Service Worker
├── 📄 robots.txt                           # Search engine crawler rules
├── 📄 sitemap.xml                          # XML sitemap for SEO
├── 📄 vercel.json                          # Vercel deployment config
│
├── 📁 data/                                # Local JSON fallbacks
│   ├── country_auc.json                    # Country-wise Assets Under Custody
│   ├── debt_utilisation.json               # FPI debt limit utilisation
│   ├── fpi_daily.json                      # Daily FPI investment data
│   ├── fpi_monthly_history.json            # Monthly historical FPI flows
│   ├── fpi_quarterly.json                  # Quarterly FPI breakdown
│   ├── fpi_yearly_monthly.json             # Multi-year monthly data (2005–2026)
│   ├── odi_pn.json                         # Offshore Derivatives / P-Notes
│   ├── sector_history.json                 # Historical sector allocation
│   ├── sector_latest.json                  # Latest fortnightly sector data
│   └── latest.json                         # Latest NSE cash + F&O snapshot
│
├── 📁 scripts/                             # Automation & Scraping
│   ├── fetch_nsdl.js                       # Puppeteer scraper for NSDL reports
│   ├── fetch_nsdl_daily_backfill.js        # Historical daily backfill
│   ├── fetch_tradewise_backfill.js         # Trade-wise monthly extraction
│   ├── build_isin_map.js                   # Nifty 500 ISIN-to-Symbol mapper
│   ├── append_2015_2019.js                 # Historical data append scripts
│   ├── append_2010_2014.js
│   └── append_2005_2009.js
│
├── 📁 icons/                               # PWA icons
│   ├── icon-192.png
│   └── icon-512.png
│
└── 📁 screenshots/                         # Tab screenshots for README
```

---

## 🛠️ Technology Stack

| Technology | Usage |
|-----------|-------|
| **HTML5 / CSS3** | Custom properties, OLED dark mode, glassmorphism, flex grids |
| **Vanilla JS** | Zero-dependency DOM manipulation and state management |
| **Chart.js v3** | Spaghetti lines, donut charts, bar combos, sparklines |
| **Node.js + Express** | API routing, static serving, CORS proxy endpoints |
| **Puppeteer** | Headless Chrome automation for NSDL `.aspx` grid scraping |
| **Socket.IO** | Real-time WebSocket updates (future-proofed) |
| **html2canvas** | Full-page screenshot export with watermarks |
| **PWA** | Service Worker + Web App Manifest for offline support |

---

## 📡 Data Sources

| Source | Data | Frequency |
|--------|------|-----------|
| **NSE TRDREQ** | FII/DII cash market buy/sell/net | Daily (market hours) |
| **NSE Participant OI** | F&O Open Interest by participant | Daily (EOD) |
| **NSDL FPI Reports** | Equity, Debt, Hybrid investment | Daily / Monthly |
| **NSDL Sector Allocation** | Fortnightly BSE sector-wise FPI holdings | Fortnightly |
| **NSDL Country AUC** | Country-wise Assets Under Custody | Monthly |
| **NSDL Debt Utilisation** | FPI debt limit vs utilisation | Monthly |
| **NSDL ODI/PN** | Offshore Derivative Instruments | Monthly |

---

## ☁️ Deployment

### Vercel
```bash
npx vercel --prod
```
The included `vercel.json` handles routing automatically.

### VPS / Hostinger
```bash
npm install
NODE_ENV=production node server.js
# Or use PM2: pm2 start server.js --name fii-dii
```

---

## 🔗 Links

- **Live Dashboard:** [fii-diidata.mrchartist.com](https://fii-diidata.mrchartist.com/)
- **GitHub:** [github.com/MrChartist/fii-dii-data](https://github.com/MrChartist/fii-dii-data)
- **Twitter/X:** [@mr_chartist](https://twitter.com/mr_chartist)

---

<p align="center">
  <b>Built for professional traders. Made with ❤️ by Mr. Chartist</b><br>
  <i>Institutional Money Matrix — Mapping where the smart money flows.</i>
</p>
