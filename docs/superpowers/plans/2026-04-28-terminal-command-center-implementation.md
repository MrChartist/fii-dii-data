# Terminal Command Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved pro trader terminal UI/UX overhaul for the FII & DII dashboard.

**Architecture:** Keep the existing Express backend and single-file frontend. Add a small structural verification script, then update `public/index.html` with terminal design tokens, a new command-center homepage, homepage summary render helpers, and global drill-down polish.

**Tech Stack:** Node.js, Express, vanilla HTML/CSS/JavaScript, Chart.js, html2canvas, existing JSON APIs.

---

## File Structure

- Create: `scripts/verify_terminal_ui.js`
  - Reads `public/index.html` and verifies the new command-center UI contract exists.
- Modify: `package.json`
  - Add `test:ui` so the structural verification can be run consistently.
- Modify: `public/index.html`
  - Replace the existing homepage hero stack with the terminal command center.
  - Add terminal CSS tokens, responsive layout, and font changes.
  - Add `renderCommandCenter()` and helper functions that reuse `dailyData` and `SECTOR_DATA`.
  - Call the new renderer during data hydration and sector hydration.
  - Tighten global tables, cards, tabs, sector cards, and mobile layout.

## Task 1: Add Structural UI Verification

**Files:**
- Create: `scripts/verify_terminal_ui.js`
- Modify: `package.json`

- [ ] **Step 1: Write the failing UI contract test**

Create `scripts/verify_terminal_ui.js` with checks for these required strings:

```javascript
const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'public', 'index.html');
const html = fs.readFileSync(indexPath, 'utf8');

const requiredMarkers = [
  ['terminal theme class', 'terminal-shell'],
  ['command grid', 'terminal-command-grid'],
  ['cash tape', 'cmd-cash-tape'],
  ['signal stack', 'cmd-signal-stack'],
  ['momentum stack', 'cmd-momentum-stack'],
  ['F&O snapshot', 'cmd-fno-snapshot'],
  ['sector rotation', 'cmd-sector-rotation'],
  ['heatmap rail', 'cmd-heatmap-rail'],
  ['recent sessions body', 'cmd-recent-body'],
  ['command center renderer', 'function renderCommandCenter()'],
  ['new body font', 'IBM Plex Sans'],
  ['terminal mono font', 'JetBrains Mono'],
  ['FlowMatrix removed from visible nav', 'FII & DII']
];

const missing = requiredMarkers.filter(([, marker]) => !html.includes(marker));

if (html.includes('FLOWMATRIX')) {
  missing.push(['legacy nav brand still visible', 'FLOWMATRIX must be removed']);
}

if (missing.length) {
  console.error('Terminal UI contract failed:');
  for (const [label, marker] of missing) {
    console.error(`- Missing ${label}: ${marker}`);
  }
  process.exit(1);
}

console.log(`Terminal UI contract passed (${requiredMarkers.length} markers).`);
```

- [ ] **Step 2: Add npm script**

Add this script to `package.json`:

```json
"test:ui": "node scripts/verify_terminal_ui.js"
```

- [ ] **Step 3: Run the test and verify RED**

Run:

```bash
npm run test:ui
```

Expected: FAIL with missing terminal UI markers.

## Task 2: Implement Terminal Visual System

**Files:**
- Modify: `public/index.html`

- [ ] **Step 1: Update font imports**

Replace the current Google Fonts URL with IBM Plex Sans, IBM Plex Mono, Space Grotesk, and JetBrains Mono.

- [ ] **Step 2: Update CSS tokens**

Add terminal-focused font variables, compact radii, table colors, and terminal panel classes.

- [ ] **Step 3: Reduce decorative motion**

Reduce ambient orb visibility, card hover lift, large rounded corners, and heavy shadows.

## Task 3: Replace Homepage With Command Center

**Files:**
- Modify: `public/index.html`

- [ ] **Step 1: Replace the `t-hero` panel markup**

Build the command center with:

- `terminal-shell`
- `terminal-command-grid`
- `cmd-cash-tape`
- `cmd-signal-stack`
- `cmd-momentum-stack`
- `cmd-fno-snapshot`
- `cmd-sector-rotation`
- `cmd-heatmap-rail`
- `cmd-recent-body`

- [ ] **Step 2: Preserve existing IDs used by current renderers**

Keep IDs required by current logic where useful:

- `lFii`
- `lDii`
- `lNet`
- `lDate`
- `heroBadge`
- `pFii`
- `pDii`
- `meterFII`
- `meterDII`
- `streak-val`
- `streak-vol`
- `dii-streak-val`
- `dii-streak-vol`
- `vel5d`
- `vel5dDesc`
- `fii-heatmap`
- `dii-heatmap`

## Task 4: Wire Command Center Rendering

**Files:**
- Modify: `public/index.html`

- [ ] **Step 1: Add `renderCommandCenter()`**

Create a renderer that computes and fills:

- Market strength score and label.
- Stock strength score and label.
- F&O sentiment summary.
- F&O long/short pressure bars.
- Sector leaders.
- Recent session table.
- Bloodbath, absorption, and divergence counts.

- [ ] **Step 2: Call renderer after data loads**

Call `renderCommandCenter()` after `renderDashboard()` and after sector data loads.

- [ ] **Step 3: Keep drill-down navigation active**

Add quick-jump buttons that call `switchMainTab('t-matrix')`, `switchMainTab('t-fno')`, and `switchMainTab('t-sector')`.

## Task 5: Polish Drill-Down Tabs And Mobile

**Files:**
- Modify: `public/index.html`

- [ ] **Step 1: Add terminal density overrides**

Tighten `.hero-banner`, `.card`, `.card-glass`, `.tbl-wrap`, `th`, `td`, `.sector-card`, and `.sub-tabs`.

- [ ] **Step 2: Add mobile command center layout**

Stack panels by decision priority and keep bottom nav compact.

- [ ] **Step 3: Preserve existing controls**

Confirm refresh, theme, share, snapshot, alerts, charts, sector modal, and daily table controls remain present.

## Task 6: Verify

**Files:**
- Modify: none unless fixes are required.

- [ ] **Step 1: Run structural verification**

Run:

```bash
npm run test:ui
```

Expected: PASS.

- [ ] **Step 2: Run build script**

Run:

```bash
npm run build
```

Expected: PASS with "No build step required".

- [ ] **Step 3: Start local server**

Run:

```bash
npm start
```

Expected: server starts on `http://localhost:3000`.

- [ ] **Step 4: Browser verification**

Open the app in a browser and verify desktop and mobile:

- Homepage command center renders.
- Tab switching works.
- Theme toggle redraws charts.
- Recent sessions table is readable.
- F&O, Analytics, Sectors, and Docs still open.
- No obvious text overlap on mobile.
