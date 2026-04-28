# Terminal Command Center UI/UX Redesign

Date: 2026-04-28
Project: FII & DII Data India
Status: Approved design direction, pending implementation plan

## Summary

Redesign the dashboard around a pro trader terminal experience. The current homepage is card-heavy and separates critical signals across tabs. The new experience should make the first screen a dense command center that combines the most important cash flow, F&O, sector, momentum, heatmap, and recent-session signals in one fast-scanning surface. Existing drill-down tabs remain, but their visual system should be tightened to match the same terminal language.

The target feel is closer to a professional market desk or TradingView-style data terminal than a marketing dashboard: compact, information-first, clear hierarchy, strong tables and charts, minimal decoration, and useful mobile ergonomics.

## Goals

- Replace the existing homepage with a unified institutional-flow command center.
- Preserve all existing useful data and actions while making the information faster to scan.
- Make every tab feel consistent with the new terminal system.
- Improve mobile so it behaves like a compact trading cockpit, not a squeezed desktop page.
- Keep the implementation within the current single-file app structure unless a narrow helper change is required.
- Avoid backend changes unless a summary value cannot be computed from existing frontend data.

## Non-Goals

- Do not rewrite the app into a new framework.
- Do not remove existing data views, exports, alerts, sharing, PWA install, or tab navigation.
- Do not introduce a marketing landing page.
- Do not create unrelated backend or data-pipeline changes.
- Do not redesign brand identity beyond tightening the dashboard presentation and replacing lingering FlowMatrix labels where visible.

## Primary User

The primary user is an active trader or market analyst who wants to understand institutional pressure quickly:

- What did FIIs and DIIs do in the latest session?
- Is the combined liquidity supportive or draining?
- Is the recent streak accelerating or fading?
- Does F&O positioning confirm or contradict cash-market flows?
- Which sectors show FPI rotation?
- What happened in the most recent sessions without opening a separate archive?

## Visual System

Use a professional terminal style:

- Dense but readable spacing.
- Smaller, consistent radii instead of soft oversized cards.
- Reduced decorative glow, ambient orbs, and hover spectacle.
- Strong tabular numbers using the existing mono font.
- Clear green/red/orange status semantics for buy, sell, warning, and neutral states.
- A restrained background with subtle surface contrast.
- Clear borders and section headers for scanability.
- Compact controls with icon-led affordances and readable labels where needed.

The interface should remain attractive, but the hierarchy should come from data structure, typography, contrast, and alignment rather than decorative cards.

## Information Architecture

Keep the existing main sections:

- FII/DII command center
- F&O positioning
- Flow analytics
- Sector rotation
- Docs/reference

The homepage becomes the command center and should include high-value summary slices from all other sections. Other tabs become drill-down views for deeper exploration.

## Homepage Command Center

The new homepage should replace the current hero/card stack with a dense command grid.

### Top Terminal Bar

The top bar should include:

- Brand: FII & DII Data
- Latest session date
- Sync/data status
- Refresh action
- Alerts action
- Theme toggle
- Snapshot/export action
- Share action

This bar should feel like a terminal header, not a marketing header. It can remain sticky on desktop if it does not fight the tab navigation.

### Primary Cash Flow Tape

Show the latest cash-market core values prominently:

- FII/FPI net
- DII net
- Combined liquidity
- FII aggression percentage
- DII support percentage
- Latest session date
- Current session badge such as Aggressive Selling, DII Absorption, or Balanced

The tape should be compact and number-led. It should make the latest institutional pressure legible within one glance.

### Signal Stack

Bring together high-level bias signals:

- Market strength score
- Stock strength score
- F&O sentiment
- AI regime if available

Each signal should include the current value and a short status label. Avoid long explanatory text on the homepage.

### Momentum Stack

Show recent-flow momentum:

- Current FII streak
- Current DII streak
- 5-day FII velocity
- Bloodbath day count
- DII absorption count
- Extreme divergence count if already available from the existing filters or daily data

This section should answer whether institutional pressure is persistent, accelerating, or fading.

### F&O Snapshot

Show a compressed derivative positioning panel:

- FII index futures long vs short
- FII calls long vs short
- FII puts long vs short
- DII futures long vs short
- Net positioning mini-chart or pressure bars
- F&O data date

The full F&O tab remains the deep-dive view.

### Sector Rotation Snapshot

Show the current sector leaders:

- Top fortnight inflow
- Top fortnight outflow
- Highest AUM sector
- Top 1-year net flow sector
- Last sector update date if available

This should be a compact board, not a full sector card grid.

### 45-Day Heatmap Rail

Condense the existing FII and DII heatmaps into a terminal rail:

- One row for FII
- One row for DII
- Tooltip or title for value/date
- Clear color intensity scale

The heatmap should help users see flow clustering without taking over the page.

### Recent Sessions Table

Include a visible recent-session table on the homepage:

- Last 10-15 sessions
- Trading date
- FII net
- DII net
- Combined liquidity
- Signal or regime

The Analytics tab remains responsible for full archive filters, pagination, CSV, and expanded row details.

## Drill-Down Tabs

### Analytics

Restyle as a data terminal:

- Cleaner summary stats row.
- Tighter chart container.
- Sticky or easy-to-reach filters.
- Stronger table alignment and numeric scanning.
- Keep daily, weekly, monthly, and annual sub-tabs.
- Preserve date range, anomaly filters, CSV export, pagination, and expandable rows.

### F&O

Restyle as a derivatives terminal:

- Keep sentiment badge and participant-wise OI breakdown.
- Make long/short bars denser and easier to compare.
- Keep historical positioning chart and mode toggles.
- Reduce banner copy and decorative spacing.

### Sectors

Restyle as a rotation board:

- Compact methodology disclosure or collapsible explainer.
- Sector cards should become denser and more table-like.
- Preserve sort modes, zoom modal, and interactive sector chart.
- Make top sector movements easier to compare.

### Docs

Restyle as a reference center:

- Reduce screenshot-heavy visual weight where possible.
- Use compact sections, stronger anchors, and simpler hierarchy.
- Keep methodology, sources, formulas, and utility guidance.

## Mobile UX

Mobile should become a one-thumb trading cockpit:

- Keep bottom navigation, but make it cleaner and icon-first.
- Stack homepage sections by decision priority:
  1. Cash Flow Tape
  2. Signal Stack
  3. Momentum Stack
  4. Recent Sessions
  5. F&O Snapshot
  6. Sector Rotation
  7. Heatmap Rail
- Use stable card heights where possible to avoid jumpy layout.
- Tables should use horizontal scroll with sticky first column where practical.
- Buttons should remain touch-sized but visually compact.
- Avoid text overlap and tiny unreadable labels.
- Keep charts shorter and more focused on mobile.

## Data Flow

Use existing frontend data where possible:

- Latest snapshot from `/api/data`.
- Historical daily data from `/api/history` and `/api/history-full`.
- Sector data from `/api/sectors`.
- Agent/regime data from existing agent endpoints if available.

The homepage should compute summary values client-side from already-loaded arrays unless that creates duplication that is hard to maintain.

## State And Interaction

Preserve current interactions:

- Main tab switching.
- Sub-tab switching.
- Theme toggle.
- Force sync.
- Snapshot/export.
- Share menu.
- Push alert settings.
- Sector chart toggle.
- Sector zoom modal.
- Daily filters and pagination.

Add or improve these homepage interactions:

- Quick jump from homepage snapshot panels into the relevant deep-dive tab.
- Compact hover/focus states for terminal panels.
- Clear loading and fallback states for each summary panel.

## Accessibility And Usability

- Maintain semantic landmarks and accessible labels for controls.
- Ensure color is not the only way to distinguish positive and negative values.
- Keep focus states visible.
- Preserve keyboard support for modals and tab controls where already present.
- Respect reduced motion by avoiding unnecessary entrance animation.
- Ensure mobile controls meet practical touch target sizes.

## Implementation Constraints

- Work primarily in `public/index.html`.
- Prefer new reusable CSS utility classes over expanding inline style usage.
- Preserve existing JavaScript behavior and only extract helpers when it reduces complexity.
- Avoid unrelated refactors in `server.js` or data files.
- Do not overwrite existing uncommitted user changes.

## Verification Plan

After implementation:

- Run the app locally.
- Verify desktop homepage at a normal wide viewport.
- Verify mobile homepage at a phone-sized viewport.
- Test tab switching across FII/DII, F&O, Analytics, Sectors, and Docs.
- Confirm charts render after theme changes and tab switches.
- Confirm key controls still work: refresh, theme, share, snapshot, alerts.
- Confirm recent-session table and drill-down tables remain readable.
- Check for text overlap, layout shift, and broken mobile navigation.

## Open Implementation Notes

- The current app contains a hidden `t-ai` panel but no visible nav tab for it. The redesign can surface AI regime as a small homepage signal if data is available, but should not make the AI panel a primary navigation item unless explicitly requested.
- There are visible references to FlowMatrix in the navigation brand title/text. The redesign should align visible brand text with FII & DII Data.
- The current CSS includes ambient orbs and large hover effects. The terminal redesign should remove or heavily reduce these in favor of compact data surfaces.
