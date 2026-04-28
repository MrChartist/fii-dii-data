# Main Website Aligned Pro Terminal Design

Date: 2026-04-28
Project: FII and DII Data
Reference brand source: D:\AG\Main Website- Mr Chartist

## Goal

Redesign the FII and DII frontend into a polished Mr Chartist Pro Terminal: dense, fast, data-first, and visually aligned with the main Mr Chartist website. The homepage must become the primary terminal experience and include all important institutional flow, F&O, sector, heatmap, and recent session information without feeling sparse on desktop or cramped on mobile.

## Brand Alignment

Use the main website's visual language as the source of truth:

- UI/display font: Plus Jakarta Sans.
- Numeric/market font: JetBrains Mono.
- Brand accent font, where appropriate and minimal: DM Serif Display italic for the Mr. Chartist mark only.
- Dark base: near-black rather than blue-slate.
- Surface system: glass/card layers with subtle borders, low opacity fills, and restrained shadows.
- Brand accents: purple primary, orange/amber active trading actions, blue alerts, violet community/channel, emerald profit, red loss.
- Shape language: compact rounded pills for nav/actions, 8-16px card radii depending on component size, no oversized decorative cards.

## Recommended Approach

Implement the "Mr Chartist Pro Terminal" option.

This keeps the trading terminal density from the current redesign but replaces the remaining generic dashboard feel with the main website's brand rhythm. It should look like a dedicated product inside the Mr Chartist ecosystem, not a disconnected utility.

## Desktop Layout

The desktop homepage should use a full-width terminal canvas instead of a narrow centered column:

- Top universal product bar:
  - Mr. Chartist brand mark.
  - Product identity: FII and DII Data.
  - Section tabs.
  - Alerts/channel/actions.
  - Compact, sticky, and visually close to the main website nav.
- Terminal command header:
  - Date, market state, live refresh status, and primary actions in one tight row.
  - Avoid duplicate title/action rows.
- Primary grid:
  - Main left column: cash flow tape, liquidity balance, FII/DII key figures, pressure meter.
  - Center/right analytics: signal stack, momentum stack, F&O snapshot, sector rotation.
  - Bottom/data row: recent sessions table and 45-day flow matrix.
- Make the grid wider on large screens and remove empty right-side dead space.
- Keep data visible above decoration. Use background texture only as a subtle terminal grid/vignette.

## Mobile Layout

Mobile must keep the same information, but prioritize it:

- Sticky compact nav with icon-first tabs and horizontally scrollable actions.
- First screen should show:
  - Date/state/live refresh.
  - FII net, DII net, combined liquidity.
  - Buy/sell streak summary.
- Follow with collapsible-looking but visible cards:
  - Signal stack.
  - Recent sessions table with fewer columns or horizontal scroll inside the table only.
  - F&O snapshot.
  - Sector rotation.
  - 45-day matrix.
- No page-level horizontal overflow.
- Tables may scroll internally, but text and buttons must not clip.

## Component Changes

Update these existing frontend areas:

- Global CSS variables and font imports in `public/index.html`.
- Floating nav styling and mobile breakpoints.
- Terminal command center markup and CSS.
- Recent sessions table density and readability.
- F&O snapshot panel so it does not leave large empty space.
- Sector and heatmap panels so they feel like first-class terminal modules.
- Footer colors and typography to match the new brand tokens.

## Data And Behavior

No data model change is required.

The redesign should continue using the existing render pipeline:

- `renderCommandCenter()`
- FII/DII latest cash data.
- F&O snapshot data.
- Sector tape data.
- Recent sessions table data.
- Theme toggle.
- Snapshot/share/export flows.

The visible UI can be reorganized, but existing IDs that JavaScript depends on must stay available or be updated consistently.

## Testing

Verification must include:

- `npm run build`
- Existing UI smoke check, or updated equivalent, for:
  - terminal visible on desktop and mobile,
  - recent sessions render,
  - sector tape renders,
  - no page-level horizontal overflow,
  - no console errors,
  - tabs still switch sections,
  - theme toggle still works.

Manual visual review should confirm:

- The product feels aligned with the main Mr Chartist website.
- The terminal uses Plus Jakarta Sans and JetBrains Mono correctly.
- Desktop uses available width well.
- Mobile keeps all key information reachable and readable.

## Out Of Scope

- Rebuilding as React.
- Changing backend/data fetch logic.
- Adding paid/auth flows.
- Replacing the chart/data computation model.
- Creating browser mockups before implementation.

## Approval

Approved direction from user: redesign now using the recommended Mr Chartist Pro Terminal approach.
