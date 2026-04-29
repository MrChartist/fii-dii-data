# Main Website Aligned Terminal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the FII and DII frontend as a polished, dense Mr Chartist Pro Terminal aligned with the main website brand.

**Architecture:** Keep the current static Express-served HTML application and existing JavaScript data pipeline. Update `public/index.html` in place by replacing global tokens, terminal layout CSS, navigation chrome, homepage terminal markup, and mobile behavior while preserving existing JavaScript IDs. Update the UI contract test to assert the new brand system.

**Tech Stack:** Static HTML, CSS custom properties, vanilla JavaScript, Express, Node UI contract test.

---

## Files

- Modify: `public/index.html`
  - Font imports and CSS variables.
  - Top nav/product bar CSS.
  - Terminal command center CSS.
  - Homepage terminal markup.
  - Responsive desktop/mobile layout.
- Modify: `scripts/verify_terminal_ui.js`
  - Update marker checks from the earlier IBM Plex based terminal to the main-site aligned Plus Jakarta/JetBrains/DM Serif system.

## Task 1: Brand Tokens And Font System

- [ ] **Step 1: Replace the font import in `public/index.html`.**

Use:

```html
<link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap">
```

- [ ] **Step 2: Replace root variables with the Mr Chartist token bridge.**

Set `--font-display` and `--font-body` to Plus Jakarta Sans, `--font-brand` to DM Serif Display, and `--font-mono` to JetBrains Mono. Set dark mode to near-black `hsl(240, 14%, 3%)`, card `hsl(220, 18%, 13%)`, primary purple `hsl(252, 36%, 54%)`, trading orange `hsl(24, 94%, 53%)`, amber `hsl(38, 92%, 50%)`, blue `hsl(217, 91%, 60%)`, emerald `hsl(160, 84%, 39%)`, and red `hsl(0, 72%, 51%)`.

- [ ] **Step 3: Run the UI contract test and expect it to fail until the marker script is updated.**

Run:

```powershell
npm run test:ui
```

Expected: failure mentioning old font markers.

## Task 2: Terminal Shell And Navigation Polish

- [ ] **Step 1: Update `.wrap`, `.tabs-wrap`, `.tab`, `.nav-brand`, and action button CSS.**

Make the app use more desktop width:

```css
.wrap {
  width: min(100% - 32px, 1680px);
  max-width: none;
  margin: 0 auto;
  padding: 92px 0 96px;
}
```

Make the nav match the main site:

```css
.tabs-wrap {
  top: 14px;
  max-width: min(100% - 24px, 1280px);
  border-radius: 20px;
  background: var(--nav-bg);
  border: 1px solid var(--glass-border);
}
```

- [ ] **Step 2: Add a compact product identity area to the homepage terminal.**

In the `t-hero` terminal markup, add a `terminal-product-row` before the command strip with brand, product, status, and actions. Preserve existing controls and IDs used by JavaScript.

- [ ] **Step 3: Remove duplicate visual hierarchy from the command strip.**

Keep the command strip for session state and key metrics, not as another large title block.

## Task 3: Pro Terminal Homepage Grid

- [ ] **Step 1: Replace terminal grid CSS with a wider command deck.**

Use:

```css
.terminal-command-grid {
  display: grid;
  grid-template-columns: minmax(420px, 1.35fr) minmax(300px, 0.8fr) minmax(320px, 0.9fr) minmax(300px, 0.85fr);
  gap: 12px;
}
```

- [ ] **Step 2: Rebalance panel spans.**

Cash tape spans two rows. Recent sessions spans two columns. Heatmap spans two columns. F&O snapshot and sector rotation stay compact with filled content.

- [ ] **Step 3: Improve F&O snapshot content density.**

Add a compact `pressure-summary` row above the existing pressure list using existing IDs and generated values where possible.

## Task 4: Mobile Terminal

- [ ] **Step 1: Replace mobile terminal layout rules.**

At `max-width: 768px`, use a single-column command feed, bottom tab bar, and full-width terminal panels. Keep only table wrappers horizontally scrollable.

- [ ] **Step 2: Add mobile priority ordering.**

Set order: product/status, cash tape, momentum, signal, recent sessions, F&O, sector, heatmap.

- [ ] **Step 3: Tighten mobile typography.**

Use Plus Jakarta for headings and JetBrains Mono for data. Reduce terminal values and ensure long rupee values wrap cleanly.

## Task 5: Contract Test And Verification

- [ ] **Step 1: Update `scripts/verify_terminal_ui.js`.**

Required markers must include:

```js
['main website display font', 'Plus Jakarta Sans'],
['brand serif font', 'DM Serif Display'],
['terminal mono font', 'JetBrains Mono'],
['product row', 'terminal-product-row'],
['command summary', 'terminal-summary-grid']
```

- [ ] **Step 2: Run tests.**

Run:

```powershell
npm run test:ui
npm run build
```

Expected: both pass.

- [ ] **Step 3: Browser smoke with Playwright or equivalent.**

Verify desktop and mobile:

- terminal visible,
- recent rows render,
- sector tape renders,
- no horizontal overflow,
- no console errors,
- tabs switch,
- theme toggle works.

## Self-Review

Spec coverage: The plan covers brand alignment, desktop layout, mobile layout, component updates, data preservation, and verification.

Placeholder scan: No TODO, TBD, or unspecified implementation steps remain.

Type consistency: The plan preserves existing JavaScript IDs and adds only CSS/HTML markers that can be checked by the UI contract test.
