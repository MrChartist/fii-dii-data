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

## ✨ What's New (The "Deep Dive" Update)

| Feature | Description |
|---------|-------------|
| 🕸️ **Comprehensive NSDL Scraping** | Fully automated Puppeteer scraping of Daily, Monthly, Quarterly, and Yearly FPI data from NSDL endpoints. |
| 🛡️ **Serverless JSON Fallbacks** | Dashboard elegantly falls back to local `.json` data when the Express server is offline, supporting static deployment! |
| 📱 **Premium UI & UX Polish** | iOS-style mobile floating dock navigation, custom slim scrollbars, and smoothed glassmorphism box-shadows. |
| 🍝 **Interactive Chart Upgrades** | FPI Sector *Spaghetti Chart* now isolates active trends on hover. Sector Cards feature premium gradient sparklines. |
| 🤿 **New "Deep Dive" Analytics** | Live integration of Country-wise AUC (Donut Chart), Trade-wise Equity Flows mapped via ISIN, and Debt Utilisation. |

---

## 📸 Tab-by-Tab Walkthrough & Documentation

### 1. ⚡ Live NSE (Home)
The default landing view covering immediately actionable institutional activity.
- **Hero Card**: FII/FPI Net vs DII Net with visual aggression borders.
- **Streak Trackers**: Tracks consecutive buying/selling days with aggregated capital velocity.
- **Concentration Matrices**: GitHub-inspired 45-Day heatmaps visualizing FII sell-off depth and DII absorption density.

### 2. 📊 FPI Macro
Macro-level historical trajectories and systemic liquidity shifts.
- **Institutional Flow Canvas**: Grand Chart.js canvas visualizing Net Flows across Daily, Weekly, and Monthly resolutions.
- **Daily & Periodic Trends**: Breakdowns of Equity, Debt, and Hybrid injections with dynamically populated summary cards.

### 3. 🌐 Sectors
Fortnightly FPI Allocation tracking to spot smart-money industry rotation.
- **Screener-style Sector Cards**: Displays sector AUM, FII ownership percentage, and highly stylized 24-fortnight visual sparklines.
- **Flow Trend Chart**: Interactive 8-sector comparative historical line chart (spaghetti UI) featuring on-hover focus fading.

### 4. 🤿 Deep Dive
Advanced datasets bridging macroeconomic demographics and debt thresholds.
- **Country AUC**: Donut chart illustrating FPI capital sources (USA, Singapore, Luxembourg, etc.).
- **Trade-wise Engine**: Granular monthly flow tracking mapped exactly to the Nifty 500 via ISIN cross-referencing.
- **Debt & ODI**: Debt utilisation progress bars and Offshore Derivative Instrument (ODI) trackers.

### 5. 🗄️ Databases
Complete institutional flow archives with magnitude bars and CSV exports.

### 6. 🎲 F&O Positions
Derivatives positioning analysis mapping Index/Stock Futures and Call/Put option Long-Short ratios for sentiment indication.

### 7. 📖 Docs
A built-in user manual detailing mathematical formulas for Momentum Alpha, Data source citations (NSE TRDREQ vs NSDL), and system architectures.

---

## 💻 Step-by-Step Installation Guide

The tracker can run fully featured via its **Node.js + Express backend** (which powers live web scraping) or as a static lightweight site utilizing local JSON fallbacks.

### 🍏 Mac OS Installation
1. **Install Prerequisites**: Open Terminal and install Node.js and Git (requires Homebrew).
   ```bash
   brew install node git
   ```
2. **Clone & Enter Repo**: 
   ```bash
   git clone https://github.com/MrChartist/fii-dii-data.git
   cd fii-dii-data
   ```
3. **Install Dependencies**: `npm install`
4. **Start the Engine**: `node server.js`
5. **View Dashboard**: Open your browser to `http://localhost:3000`

### 🪟 Windows Installation
1. **Install Prerequisites**: Download and install [Node.js](https://nodejs.org/) and [Git](https://git-scm.com/).
2. **Clone & Enter Repo**: Open Command Prompt (or PowerShell):
   ```cmd
   git clone https://github.com/MrChartist/fii-dii-data.git
   cd fii-dii-data
   ```
3. **Install Dependencies**: `npm install`
4. **Start the Engine**: `node server.js`
5. **View Dashboard**: Open your browser to `http://localhost:3000`

### 🐧 Linux (Ubuntu/Debian) Installation
1. **Install Prerequisites**: 
   ```bash
   sudo apt update
   sudo apt install nodejs npm git
   ```
2. **Clone & Enter Repo**: 
   ```bash
   git clone https://github.com/MrChartist/fii-dii-data.git
   cd fii-dii-data
   ```
3. **Install Dependencies**: `npm install`
4. **Start the Engine**: `node server.js`
5. **View Dashboard**: Open your browser to `http://localhost:3000`

---

## 🌳 Git & Architecture Graph

```text
* c5fcdda (HEAD -> main) feat: Complete dashboard overhaul with NSDL data, sector charts & UI polish
* 2a1b3c4 chore: Initial FII DII Dashboard commit

📁 fii-dii-data/
├── 📄 fii_dii_india_flows_dashboard.html   # Main Client Application (HTML/CSS/JS Monolith)
├── 📄 server.js                            # Express backend + Puppeteer automation APIs
├── 📄 package.json                         # Node.js backend dependencies
│
├── 📁 data/                                # Fallback JSON datasets for Serverless deployment
│   ├── country_auc.json
│   ├── debt_utilisation.json
│   ├── fpi_daily.json
│   ├── fpi_quarterly.json
│   ├── fpi_yearly_monthly.json
│   ├── sector_history.json
│   └── sector_latest.json
│
├── 📁 scripts/                             # Cron-Ready Automation & Scraping Tools
│   ├── fetch_nsdl.js                    # Daily Puppeteer scraper for core NSDL
│   ├── fetch_tradewise_backfill.js      # Monthly trade-wise extraction & aggregation
│   └── build_isin_map.js                # NSE Nifty 500 ISIN-to-Symbol taxonomy generator
│
└── 📄 README.md                            # Documentation
```

---

## 🛠️ Core Technology Stack

| Technology | Usage |
|-----------|-------|
| **HTML5 / CSS3** | Custom properties, OLED dark mode, glassmorphism UI, flex grids |
| **Vanilla JS** | Zero-dependency DOM manipulation and state management |
| **Chart.js v3** | Interactive canvas visualizations (Spaghetti lines, Doughnuts, Bar combos) |
| **Node.js** | Core server runtime environment |
| **Express.js** | API routing and static file serving (`server.js`) |
| **Puppeteer** | Headless Chrome browser automation for scraping complex NSDL `.aspx` grids |
| **Socket.IO** | Future-proofed for instantaneous market WebSocket broadcasts |

---

<p align="center">
  <b>Built for professional traders. Made with ❤️ by Mr. Chartist</b><br>
  <i>Institutional Money Matrix — Mapping where the smart money flows.</i>
</p>
