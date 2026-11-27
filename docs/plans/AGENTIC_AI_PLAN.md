# 🤖 FII & DII Data — Complete Agentic AI Plan

> **From Institutional Flow Dashboard → Autonomous Regime Detection Engine**
>
> Built by [Mr. Chartist](https://mrchartist.com) — SEBI Registered Research Analyst (INH000015297)
>
> 🌐 **Live:** [fii-diidata.mrchartist.com](https://fii-diidata.mrchartist.com/)

---

## 📋 Current State (What Exists Today)

### Core Platform
- **Node.js + Express Backend** (`server.js`) with cron-based NSE data fetching
- **Automated Fetcher** — pulls FII/DII data at 6:00, 6:30, 7:00 PM IST (Mon-Fri)
- **History Engine** — 800+ days of rolling FII/DII daily data in `data/history.json`
- **Sector Allocation** — NSDL fortnightly FPI data across 24 sectors in `data/sectors.json`
- **F&O Positioning** — Participant-wise OI breakdown (FII vs DII long/short ratios)
- **45-Day Heatmaps** — GitHub-style concentration matrices for sell-off depth & DII absorption
- **Streak Trackers** — Consecutive buying/selling day detection with cumulative velocity
- **PWA Dashboard** — Single-file HTML5 SPA with Chart.js, dark/light mode, export tools

### Key API Endpoints

| Endpoint | Data |
|----------|------|
| `GET /api/data` | Latest FII/DII snapshot |
| `GET /api/history` | Last 60 days of history |
| `GET /api/history-full` | Full 800-day history |
| `GET /api/sectors` | 24-sector FPI allocation with trend data |
| `GET /api/market` | NIFTY50 & India VIX (Yahoo Finance proxy) |
| `GET /api/status` | Server health + fetch logs |
| `POST /api/refresh` | Trigger manual NSE data fetch |

---

## 🎯 Full Agentic Vision

### The Role: Ecosystem Regime Detector

FII/DII Data doesn't generate trading signals directly — it sets the **institutional context** for every other agent in the ecosystem. Think of it as the barometer that tells all agents whether to be aggressive or defensive.

```
FII/DII Data → Sets REGIME
                    │
    ┌───────────────┼────────────────┐
    ▼               ▼                ▼
Corporate Decode  OptionsDesk     TradeBook
"Only alert on    "Increase GEX   "Switch to
 bullish filings   sensitivity"    conservative
 if regime is                      risk limits"
 bullish"
```

### The 5 Agent Tiers

```
TIER 1: STREAK INTELLIGENCE (🔜 Phase 1)
  └─ Detect → Measure → Alert on FII sell/buy streaks ≥ 5 days

TIER 2: REGIME CLASSIFICATION (🔜 Phase 1)
  └─ Aggregate → Classify → Broadcast market regime to all agents

TIER 3: SECTOR ROTATION MONITOR (🔜 Phase 2)
  └─ Track fortnightly → Detect allocation shifts → Alert on rotation

TIER 4: FLOW DIVERGENCE ENGINE (🔮 Phase 2)
  └─ Compare FII vs DII → Detect extremes → Contrarian signals

TIER 5: CROSS-PLATFORM REGIME BROADCASTER (🔮 Phase 3)
  └─ Push regime state → All ecosystem agents adjust behaviour
```

---

## 📅 Phased Implementation

### Phase 1: Core Detection Agents

#### 1A. FII Sell Streak Detector
**What:** Detects sustained FII selling pressure and alerts when streaks become significant.

```
PERCEPTION: Reads /api/history daily at 7:30 PM IST
REASONING:
  Rule 1: IF FII net selling ≥ 5 consecutive days → ⚠️ WARNING
  Rule 2: IF FII net selling ≥ 10 consecutive days → 🚨 CRITICAL
  Rule 3: IF cumulative sell volume in streak > ₹20,000 Cr → 🔴 EXTREME
  Rule 4: IF DII absorption < 50% of FII sell → "DII not absorbing — RISK"
  Rule 5: IF DII absorption > 100% of FII sell → "DII fully absorbing — STABLE"
ACTION: Telegram alert with streak count, daily breakdown, absorption ratio
```

**Implementation:**
- `agents/fii-streak-agent.js`
- State: Tracks `last_alerted_streak_length` to avoid re-alerting
- Also detects FII buying streaks (≥ 5 days) for bullish regime shifts

#### 1B. Market Regime Classifier Agent
**What:** Classifies the current institutional environment into one of 5 regimes.

```
REGIMES:
  🟢 STRONG BULLISH  — FII buying + DII buying (both net positive ≥ 5 days)
  🟡 MILD BULLISH    — FII mixed + DII buying OR FII buying alone
  ⚪ NEUTRAL          — No clear trend (alternating days)
  🟠 MILD BEARISH    — FII selling < 5 days OR moderate outflow
  🔴 STRONG BEARISH  — FII selling streak ≥ 5 days + cumulative > ₹10k Cr

LOGIC:
  Evaluates trailing 10-day FII/DII data
  Considers: streak length, cumulative flow, absorption ratio, VIX level
  Publishes regime to /api/agents/regime (consumed by all ecosystem agents)
```

**Implementation:**
- `agents/regime-classifier.js`
- Writes regime to `agent_state` table: `{regime: "STRONG_BEARISH", since: "2026-04-01"}`
- Exposes `/api/agents/regime` for other projects to consume
- Alerts only on regime TRANSITIONS (e.g., Neutral → Bearish)

#### 1C. Flow Strength Monitor
**What:** Real-time alert when daily FII/DII flow hits extreme levels.

```
RULES:
  FII selling > ₹5,000 Cr in a single day → "🔴 FII BLOODBATH"
  FII buying > ₹3,000 Cr in a single day → "🟢 FII MEGA BUY"
  DII buying > ₹5,000 Cr in a single day → "🟢 DII MASSIVE ABSORPTION"
  FII-DII divergence > ₹8,000 Cr → "⚡ EXTREME DIVERGENCE"
```

**Implementation:**
- `agents/flow-strength.js`
- Runs after each data fetch (6 PM, 6:30 PM, 7 PM IST)
- One-shot alert per extreme event per day

---

### Phase 2: Intelligence Agents

#### 2A. Sector Rotation Monitor
**What:** Detects when FPI allocation rotates between sectors — early warning for sector trends.

```
PERCEPTION: Reads /api/sectors after each NSDL fortnight update
REASONING:
  Rule 1: IF sector AUM drops > 1% in single fortnight → "FPI reducing" 
  Rule 2: IF sector AUM rises > 1% in single fortnight → "FPI increasing"
  Rule 3: IF 3+ consecutive fortnights of decline → "Sustained FPI exit"
  Rule 4: Compare top 5 vs bottom 5 sectors → Rotation pattern
ACTION: Telegram alert with sector rotation summary + sparklines
```

**Implementation:**
- `agents/sector-rotation.js`
- Reads `data/sectors.json` which contains 24 sectors × 12+ fortnights
- Tracks `last_sector_state` for change detection

#### 2B. Flow Divergence Signal Agent
**What:** Detects when FII and DII flow patterns diverge to historical extremes — often a contrarian signal.

```
RULES:
  1. IF FII selling heavily BUT DII absorbing 120%+ → CONTRARIAN BULLISH
     (Smart money leaving, but domestic institutions confident)
  2. IF FII and DII both selling → PANIC MODE
     (Rare — indicates systemic risk)
  3. IF FII buying + DII selling → EUPHORIA CHECK
     (Foreign money inflowing but domestics reducing)
```

**Implementation:**
- `agents/flow-divergence.js`
- Uses 30-day rolling averages for signal stability
- Compares current divergence to historical percentile

#### 2C. Weekly Institutional Digest
**What:** Automated end-of-week intelligence report summarizing institutional activity.

```
CRON: Every Friday at 8:00 PM IST
GATHER:
  - Weekly FII/DII net totals
  - Current streaks
  - Sector rotation highlights
  - VIX trend
  - Regime classification
FORMAT: Structured Telegram report
```

---

### Phase 3: Cross-Platform Regime Broadcasting

#### 3A. Regime API for Ecosystem
**What:** Expose a simple API that all other projects can query to adjust their agent behaviour.

```
GET /api/agents/regime
→ {
    "regime": "STRONG_BEARISH",
    "since": "2026-03-28",
    "fii_streak": -7,
    "dii_absorption_pct": 85,
    "vix": 18.5,
    "recommendation": "Reduce risk, tighten stops"
  }
```

**Consumers:**
- **Corporate Decode**: Only alert on bullish filings if regime ≥ NEUTRAL
- **OptionsDesk**: Increase GEX sensitivity, favour hedging strategies
- **TradeBook**: Switch risk parameters to conservative mode
- **Scanner Pro**: Prioritize short-selling setups over breakouts

#### 3B. TradeBook Risk Modifier
**What:** When regime shifts to STRONG_BEARISH, automatically update TradeBook risk parameters.

```
FLOW:
  Regime → STRONG_BEARISH
  → API call to TradeBook: reduce max position size to 1%
  → API call to TradeBook: tighten default stop loss to 1.5%
  → Telegram: "⚠️ Risk Guardian activated — conservative mode"
```

---

## 🛠️ Technical Architecture

### Agent System Design

```
FII and DII data/
├── agents/
│   ├── fii-streak-agent.js       🔜 Phase 1A
│   ├── regime-classifier.js      🔜 Phase 1B
│   ├── flow-strength.js          🔜 Phase 1C
│   ├── sector-rotation.js        🔮 Phase 2A
│   ├── flow-divergence.js        🔮 Phase 2B
│   └── weekly-digest.js          🔮 Phase 2C
├── agent-runner.js               🔜 Central cron scheduler
├── server.js                     ✅ Express + NSE fetcher
├── scripts/
│   ├── fetch_data.js             ✅ NSE data fetcher
│   ├── seed_history.js           ✅ Historical data seeder
│   └── seed_sectors.js           ✅ Sector data seeder
└── data/
    ├── history.json              ✅ 800+ days of FII/DII data
    └── sectors.json              ✅ 24 sectors × 12+ fortnights
```

### Database Additions

```sql
-- Agent tables (added to server.js SQLite or JSON state)
-- Since FII/DII uses JSON files, agents will use a small SQLite DB

CREATE TABLE agent_runs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_name  TEXT    NOT NULL,
    run_at      TEXT    NOT NULL,
    status      TEXT    DEFAULT 'ok',
    items_found INTEGER DEFAULT 0,
    alerts_sent INTEGER DEFAULT 0,
    error       TEXT,
    duration_ms INTEGER
);

CREATE TABLE agent_state (
    agent_name  TEXT NOT NULL,
    key         TEXT NOT NULL,
    value       TEXT,
    updated_at  TEXT,
    PRIMARY KEY (agent_name, key)
);
```

### New API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/agents/status` | GET | All agent statuses |
| `/api/agents/regime` | GET | Current regime classification (consumed by ecosystem) |
| `/api/agents/streaks` | GET | Active FII/DII streaks |
| `/api/agents/runs` | GET | Agent execution history |

---

## 📡 Telegram Alert Formats

### FII Streak Alert
```
🔴 FII SELL STREAK — DAY 7
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 7 consecutive days of FII selling
💰 Cumulative outflow: -₹14,280 Cr

📉 Daily Breakdown:
  Day 7: -₹1,850 Cr
  Day 6: -₹2,100 Cr
  Day 5: -₹1,950 Cr
  Day 4: -₹2,300 Cr
  Day 3: -₹1,800 Cr
  Day 2: -₹2,180 Cr
  Day 1: -₹2,100 Cr

🛡️ DII Response:
  DII absorbed: ₹12,150 Cr (85%)
  ⚠️ DII not fully absorbing → NET NEGATIVE

📊 Impact: NIFTY -3.2% since streak started
🌡️ VIX: 18.5 (elevated)

🏷️ Regime: 🔴 STRONG BEARISH

🤖 FII Streak Detector
@Mr_Chartist
```

### Regime Transition Alert
```
⚡ REGIME SHIFT DETECTED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🟡 MILD BULLISH → 🔴 STRONG BEARISH

📊 What changed:
  • FII selling streak crossed 5 days
  • Cumulative outflow > ₹10,000 Cr
  • DII absorption dropped below 80%
  • VIX climbed above 15

💡 Ecosystem Impact:
  📌 Corporate Decode: Filtering for defensive filings
  📌 OptionsDesk: GEX sensitivity increased
  📌 TradeBook: Risk limits tightened
  📌 Scanner: Prioritizing short-selling setups

🤖 Regime Classifier Agent
@Mr_Chartist
```

---

## 📊 Success Metrics

| Metric | Target |
|--------|--------|
| Streak detection | Same-day alert (within 1 hour of data publish) |
| Regime classification accuracy | > 75% correlation with next-week NIFTY direction |
| Sector rotation lead time | > 1 fortnight ahead of price action |
| Cross-platform regime latency | < 5 minutes from detection to all agents updated |
| Flow extreme detection | 100% capture of ₹5k+ Cr single-day events |

---

*Part of the Mr. Chartist Agentic AI Ecosystem · SEBI RA INH000015297*
*Last Updated: April 2026*
