# 📈 Mr. Chartist: FII & DII Data — Technical Manual
**Elite Institutional Money Tracker & Flow Dashboard (V3 — Node.js + Express)**

Welcome to the ultimate FII/DII tracking dashboard. This tool provides crystal-clear insights into institutional liquidity flows within the Indian equity markets — combining automated data extraction with visually stunning matrices, heatmaps, sector analytics, and momentum indicators.

![Dashboard Hero Overview](dashboard_hero.png)

---

## 🏗️ Architecture Overview

```
┌──────────────────────────────────────────────┐
│                  Browser (PWA)               │
│    public/index.html (Single-File SPA)       │
│    • Chart.js charts & sparklines            │
│    • 5 tabs: FII/DII, F&O, Analytics,        │
│      Sectors, Docs                           │
│    • Zoom modal for sector deep-dives        │
└────────────────────┬─────────────────────────┘
                     │ fetch() API calls
┌────────────────────▼─────────────────────────┐
│              server.js (Express)             │
│    • /api/data — Latest FII/DII snapshot     │
│    • /api/history-full — 800-record history  │
│    • /api/sectors — 24 sectors + trends      │
│    • /api/market — Nifty/VIX proxy           │
│    • /api/refresh — Manual NSE fetch         │
│    • node-cron: 18:00, 18:30, 19:00 IST      │
│    • Security headers on all responses       │
└────────────────────┬─────────────────────────┘
                     │ read/write JSON
┌────────────────────▼─────────────────────────┐
│                 data/ (JSON Store)           │
│    • history.json — Daily FII/DII records    │
│    • sectors.json — 24 sectors + historyCr   │
│    • fetch-log.json — Audit trail            │
└──────────────────────────────────────────────┘
```

---

## 🌟 Core Features

### 1. Fully Autonomous Data Synchronization
- **Auto-Sync**: `node-cron` fetches NSE FII/DII APIs & F&O CSVs at 6:00, 6:30, 7:00 PM IST (Mon-Fri)
- **Live Indices**: Frontend fetches NIFTY 50 and INDIA VIX via server-side Yahoo Finance proxy (`/api/market`)
- **Manual Refresh**: Click "Force Sync" or `POST /api/refresh` to trigger an immediate fetch

### 2. Deep Derivatives Positioning (F&O)
- **4-Column Matrices**: Index Futures, Index Calls, Index Puts, Stock Futures — for both FII and DII
- **Long vs Short Ratio Bars**: Visual positioning indicators for each instrument
- **Historical Positioning Chart**: 20-period trajectory with mode toggles (FII Futures, Calls, Puts, DII Futures)

### 3. Sector Allocation & Zoom Modal
- **24 Sector Cards**: Data served from `/api/sectors` backend endpoint
- **Sparkline Trends**: Each card shows a mini 24-fortnight trend chart
- **Zoom Modal**: Click any card for an interactive Chart.js deep-dive with:
  - Sector title + Alpha performance badge
  - 4 stat pills: 1Y Flow, AUM Weight, FII Ownership, Fortnight Flow  
  - Large interactive chart with hover tooltips
  - Close via X button, Escape key, or backdrop click

### 4. Flow Analytics
- **Interactive Bar Chart**: 8-month FII vs DII flow history
- **Expandable Row Details**: Click any daily row for a breakdown chart + buy/sell ratios
- **Smart Filters**: FII Bloodbath (< -₹5k Cr), DII Absorption (> +₹5k Cr), Extreme Divergence
- **Date Range Filter**: Custom FROM/TO date filtering
- **CSV Export**: Download filtered data

![Flow Analytics Matrix](matrix.png)

### 5. The Flow Strength Meter & 45-Day Heatmaps
- Calculates total absolute flow (FII + DII volume) and visually maps aggression percentage
- Shows *who is pushing the market harder* today
- **45-Day Heatmaps**: GitHub-style activity grid visualizing flow intensity and identifying deep sell-offs and heavy accumulation.

![45-Day Flow Heatmaps](heatmaps.png)

### 6. Light & Dark Themes
- **Dark Mode**: OLED-black navy with high-contrast text, ambient background orbs
- **Light Mode**: Warm off-white with professional data visualization
- All charts, grids, tooltips, and sparklines adapt automatically

### 7. Social Sharing & Export
- **Snapshot Full Page**: html2canvas exports the entire screen as high-DPI PNG
- **Micro-Exports (📷)**: Hover any widget for a camera icon — exports that specific widget watermarked with "by Mr. Chartist"
- **Post to 𝕏**: Pre-filled tweet with latest Net Flow numbers

---

## 🔐 Production Security

All responses include hardened security headers:
| Header | Value |
|--------|-------|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `SAMEORIGIN` |
| `X-XSS-Protection` | `1; mode=block` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |

---

## 🔍 SEO & PWA

- **Structured Data**: WebApplication, FAQPage, BreadcrumbList (JSON-LD)
- **Open Graph**: Full OG tags for Facebook/LinkedIn sharing
- **Twitter Card**: `summary_large_image` with custom imagery
- **Canonical URL**: Points to production domain
- **Robots.txt**: Allows crawling, blocks `/api/` paths
- **Sitemap**: `sitemap.xml` with daily changefreq
- **PWA**: Service Worker v5 (network-first, API bypass), manifest with icons
- **Performance**: Font preloading (no render-blocking @import), ETag caching

---

## 📊 Data Sources

| Source | Data | Frequency |
|--------|------|-----------|
| NSE `fiidiiTradeReact` API | FII/DII daily cash flows | Every trading day |
| NSE F&O CSV (`fao_participant_oi_*.csv`) | Participant-wise OI | Every trading day |
| NSDL FPI Reports | Sector-wise FPI allocation | Every fortnight |
| Yahoo Finance | Nifty 50 & India VIX | Real-time proxy |

---

*Engine by Antigravity — Mr. Chartist Ecosystem*
