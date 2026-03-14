# 📈 Mr. Chartist: India Flow Intelligence
**Elite Institutional Money Tracker & Flow Dashboard**

Welcome to the ultimate FII/DII tracking dashboard. This tool is designed to provide crystal-clear insights into institutional liquidity flows within the Indian equity markets. It combines raw data extraction with visually stunning matrices, heatmaps, and momentum indicators.

---

## 🌟 Core Features

### 1. Live Data Synchronization
The dashboard automatically attempts to fetch the latest FII and DII cash market data directly from the NSE India endpoints. 
*   **Auto-Sync**: On load, it checks for fresh data.
*   **Status Indicator**: The top right pill will flash <span style="color:#00D09E">● LIVE SYNC (ACTIVE)</span> when successfully connected to the NSE, or <span style="color:#FF9F0A">● LOCAL ARCHIVE</span> if the market is closed or the API is unreachable.
*   **Force Sync**: At any time, click the **Force Sync** button in the header to manually re-trigger the data extraction.

### 2. The Flow Strength Meter
Located right in the Hero Section, under the net liquidity numbers.
*   **What it does:** Calculates the total absolute flow (FII Volume + DII Volume) and visually maps the percentage of aggression.
*   **Why it matters:** If FIIs sell ₹10,000 Cr and DIIs buy ₹9,000 Cr, the meter will show FIIs dominating the liquidity pool at ~52%. It helps you understand *who is pushing the market harder* today.

### 3. Light & Dark Themes (Matte UI)
The entire dashboard is built on a custom "Matte" design system that eliminates overly-glassy distractions in favor of clean, professional data visualization.
*   **Dark Mode (Default)**: Uses the `Night` background, `Cyprus` green cards, and high-visibility `Sand` text. Best for low-light trading environments.
*   **Light Mode**: Click the **Light Mode** button to instantly invert the theme. The cards turn crisp white, maintaining perfect contrast ratios for daytime analysis. Chart grids and fonts adapt automatically.

### 4. 𝕏 (Twitter) Integration & Snappable Components
This dashboard is highly shareable. 
*   **Snapshot Full Page**: Exports the entire visible screen into a high-DPI `.png` image.
*   **Micro-Exports (📷)**: Hover over *any* specific widget (like the Momentum card or the Heatmaps). A small camera icon will appear. Clicking this exports ONLY that specific widget, beautifully watermarked with `"by Mr. Chartist"` for sharing on social media. 
*   **Post to 𝕏**: Generates a pre-filled tweet containing the latest Net Flow numbers, ready for you to attach your exported snapshot.

---

## 🔍 Analytical Views

### 🗄️ Databases & Matrices Tab
*   **Daily Flow Ledger**: A clean table showing the exact Buy/Sell/Net numbers for the last 15 sessions. Includes visual proportion bars so you can see the scale of the flows instantly. Filters allow you to isolate heavily FII Sold days or Divergence days (FII selling while DII buys).
*   **Weekly & Monthly Rollups**: Aggregated data to help you spot medium-to-long term trends in accumulation or distribution.

### 🌡️ Visual Flow Heatmaps Tab
*   **45-Day Concentration**: A visual "GitHub style" contribution graph. Dark Red means extreme selling pressure, Bright Green means heavy accumulation.
*   Allows you to scan 1.5 months of data in 2 seconds to see the *density* of sell-offs or buying streaks without looking at a single number.

### 📊 Historical Charts Tab
*   **Monthly Trajectory**: A 12-month bar chart comparing FII (Red) and DII (Green) forces side-by-side.
*   **Long-Term Year-over-Year (YoY)**: A line chart showing the brutal, multi-year divergence spanning all the way back to 2013.

---

## ⚙️ Maintenance & Customization

The dashboard is entirely self-contained within the `fii_dii_india_flows_dashboard.html` file. 

*   **Colors**: If you ever want to tweak the brand colors, simply open the file in a text editor and adjust the `:root` variables at the very top of the CSS file.
*   **Data Structure**: Historical data (Weekly, Monthly, Yearly) is hardcoded into arrays (`const weeklyData`, `const monthlyData`) around line 500. You can easily add new specific data points here as the months roll over.
*   **Libraries**: It relies on standard CDNs for `Chart.js` (for rendering charts) and `html2canvas.js` (for the image exports). Ensure you have an internet connection for these to load.

Enjoy the Elite Institutional Money Tracker!
*- Engine by Antigravity*
