# Pro Terminal 2.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the FII/DII frontend dark-first, denser, sharper, and more like a premium Mr Chartist trading terminal.

**Architecture:** Continue using the existing static `public/index.html` app and preserve all JavaScript IDs/data renderers. Implement the improvement as a scoped CSS/markup polish pass plus the default theme change.

**Tech Stack:** Static HTML, CSS custom properties, vanilla JavaScript, Node UI contract test, headless Chrome smoke test.

---

## Files

- Modify: `public/index.html`
  - Default theme attribute.
  - Theme tokens and terminal polish CSS.
  - Header/terminal panel/table/mobile styling.
- Modify: `scripts/verify_terminal_ui.js`
  - Add markers for dark-first terminal contract if needed.

## Task 1: Dark-First Default

- [ ] Change `<html lang="en" data-theme="light">` to `<html lang="en" data-theme="dark">`.
- [ ] Update the mobile/browser theme color to the dark canvas.
- [ ] Keep the theme toggle behavior unchanged.

## Task 2: Terminal Surface Polish

- [ ] Add a Pro Terminal 2 override layer near the end of the main CSS before `</style>`.
- [ ] Tighten `.wrap`, `header`, `.terminal-strip`, `.terminal-panel`, and `.tabs-wrap`.
- [ ] Make cards dark/glass by default and reduce the washed-out gray look.
- [ ] Keep light mode usable with explicit `[data-theme="light"]` overrides.

## Task 3: First Viewport Hierarchy

- [ ] Make `.cmd-cash-tape` the dominant first card with stronger value typography and a glow-left accent.
- [ ] Make `.cmd-signal-stack`, `.cmd-momentum-stack`, `.cmd-fno-snapshot`, and `.cmd-sector-rotation` read as compact terminal modules.
- [ ] Reduce panel padding and repeated borders so the screen feels denser.
- [ ] Keep the heatmap and recent table as full-width terminal modules lower on the page.

## Task 4: Trading Blotter Table

- [ ] Restyle `.terminal-table-wrap`, `.terminal-table`, `th`, and `td`.
- [ ] Use darker sticky headers, tighter rows, tabular numbers, and stronger positive/negative colors.
- [ ] Preserve internal horizontal scrolling for small screens.

## Task 5: Mobile Density

- [ ] Tighten the mobile `.wrap`, terminal panel padding, values, and summary cells.
- [ ] Keep the bottom nav usable and compact.
- [ ] Ensure no page-level horizontal overflow.

## Task 6: Verification

- [ ] Run `npm run test:ui`.
- [ ] Run `npm run build`.
- [ ] Run headless Chrome smoke on desktop and mobile:
  - terminal visible,
  - recent rows render,
  - sector tape renders,
  - no horizontal overflow,
  - no console errors,
  - tabs switch,
  - theme toggle works.

## Self-Review

Spec coverage: The plan covers dark-first default, hierarchy, terminal surfaces, table/blotter styling, mobile density, and verification.

Placeholder scan: No TODO, TBD, or undefined implementation steps remain.

Scope check: This is a single frontend polish pass and does not require backend/data changes.
