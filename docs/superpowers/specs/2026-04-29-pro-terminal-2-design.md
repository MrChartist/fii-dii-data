# Pro Terminal 2.0 Design

Date: 2026-04-29
Project: FII and DII Data

## Goal

Turn the current polished-but-flat dashboard into a dark-first Mr Chartist Pro Terminal with stronger hierarchy, denser first-screen information, sharper table/blotter styling, and mobile behavior that feels like a compact market app.

## Approved Direction

Use the dark-first terminal-heavy option:

- Default the app to dark mode.
- Keep Plus Jakarta Sans, JetBrains Mono, and the Mr Chartist serif brand mark.
- Use near-black canvas, subtle glass panels, orange FII/DII active state, purple/blue actions, emerald profit, and red loss.
- Make the first viewport feel like a trading console instead of stacked admin cards.

## Visual Changes

- Tighten the shell spacing and reduce bulky vertical gaps.
- Make the header/product row darker, compact, and integrated with the terminal.
- Give the command strip a market-status feel with clear session, liquidity state, and refresh modules.
- Make the cash tape visually dominant without turning into a giant card.
- Improve secondary panels with consistent dark surfaces, stronger borders, and less washed-out gray.
- Make the 45-day matrix and recent sessions table feel like first-class terminal modules.
- Style the recent sessions table as a trading blotter with tighter rows, clearer sticky header, and better positive/negative scanning.

## Mobile Changes

- Keep the bottom nav.
- Default first mobile screen to the most important data: session, FII net, DII net, combined liquidity, streak.
- Stack panels in priority order without page-level horizontal overflow.
- Tables may scroll internally, but the page itself must not.

## Behavior

No data model or backend changes.

Preserve:

- Existing DOM IDs used by JavaScript.
- Theme toggle.
- Tab switching.
- Snapshot/share actions.
- F&O, sector, heatmap, and recent-session render pipelines.

## Testing

Run:

- `npm run test:ui`
- `npm run build`
- Headless browser smoke on desktop and mobile:
  - terminal visible,
  - recent sessions render,
  - sector tape renders,
  - no page-level horizontal overflow,
  - no console errors,
  - tabs switch,
  - theme toggle works.

## Out Of Scope

- Backend/data changes.
- Rebuilding as React.
- Adding new chart libraries.
- Changing FII/DII calculations.
