# UI kit (`public/ui/`)

Look-and-feel and behaviour meant to be reusable across Mr. Chartist projects. Component table and CSS section index: `README.md`.

**This area is open for experimentation.** Motion, transitions, glass/blur effects, micro-interactions, new components and visual refreshes change fast; try things, keep what works, and don't wait for permission or a rule change. Checks worth doing, not blockers:
- **Portability is the goal.** Prefer `data-*` attributes and CSS tokens over product wording or page ids. If a piece needs product logic, put it in `public/app/` and say why in the commit; that's fine.
- **Tokens first.** New colours, radii, motion curves go in `mc.css` §1 so themes (dark default, `html[data-theme=light]`) and high-contrast stay consistent.
- **Accessibility.** Honour `prefers-reduced-motion` / `prefers-reduced-transparency`; keep focus styles. Motion should degrade, not disappear into a broken layout.
- **Phones.** Check ~390px wide (modal cards sit above the bottom dock; keep them opaque).
- **Paths.** `/ui/css/mc.css`, `/ui/js/mc-*.js`. When you add/move a file update `public/sw.js` (bump `CACHE_NAME`), the `<script>/<link>` tags and `scripts/checks/verify_terminal_ui.js`; bump the `?v=` query on a changed asset.
- **Extraction backlog** is in `README.md`.
- **Caching.** The server revalidates `.css`/`.js` on every load (ETag/304), so a redesign shows up on the next reload. Still bump the `?v=` on a changed asset: it is what rescues browsers holding an older cached copy.
- **Palette: black/white glass.** Backgrounds are neutral: dark = near-black glass over black, light = white glass over off-white; no coloured glows, per-card tints or gradient buttons. The accent token (`--mc-accent`) is white in dark and black in light. Colour is kept only where it carries data (green/red figures, bull/bear meters, the signal legend). New surfaces should use `--glass-fill` + `--card-sheen`.
