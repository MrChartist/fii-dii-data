# UI kit (`public/ui/`) — reusable across projects

Served at `/ui/...`. Look-and-feel and behaviour meant to be reusable across Mr. Chartist projects. Guidance (and permission to experiment freely with motion and visuals): `CLAUDE.md`.

## CSS — `ui/css/mc.css` (numbered sections; grep `── N.`)
1 Tokens (colours, fonts, spacing; dark default, `html[data-theme=light]`) · 2 Base · 3 Layout · 4 Brand lockup · 5 Capsule navbar (desktop) · 6 Controls/buttons · 7 Badges · 8 Surfaces (glass cards) · 9 Tables · 10 Info popovers/tooltips · 11 Overlays (sheets, modals, tour) · 12 Footer · 13 Page header / search / KPI grid / empty state · 14 Motion · 15 Mobile top capsule + dock · 16 Context notes, skeletons, notices · 17 Accessibility (jump strip, high contrast)

## JS — `ui/js/`
| File | Provides | Depends on |
|---|---|---|
| `mc-scale.js` | QHD/4K zoom → `window.MC_ZOOM` (load first, blocking) | — |
| `mc-brand.js` | `window.MCBrand` logo lockup | — |
| `mc-ui.js` | Shared chrome mounted once per page: navbar, dropdown, dock, info popovers, toast, theme sync, back-to-top, keyboard shortcuts, live-quote poll (⚠ quotes/footer links are product-specific) | mc.css |
| `mc-motion.js` | Scroll/number reveal animations | mc.css §14 |
| `mc-charts.js` | Chart.js defaults, DPR handling | `vendor/chart-*.js`, `MC_ZOOM` |
| `mc-ranges.js` | Date-range preset controls | — |

## Extraction backlog (do before the next sibling project)
- `mc-ui.js` §6 (live quotes) and its footer link list are product-specific → move to `app/js/`.
- Add a standalone `clock` component (currently inline in the dashboard).
