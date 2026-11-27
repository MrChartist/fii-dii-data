# App layer (`public/app/`) — this product only
- `js/dashboard.js` — the dashboard (tabs, data load, tables, heatmaps, export/share). Large: `grep -n` before reading.
- `js/pwa.js` — service-worker registration, install prompt, push opt-in.
- `js/mc-freshness.js` — trading-calendar + staleness (`MCFresh`), also `require`d by tests.
- `js/mc-deals.js` — bulk/block deals page. `js/mc-webmcp.js` — WebMCP tools for browser agents.
- `css/mc-dashboard.css` — dashboard sections. `css/deals.css` — deals table.
Pages: `../index.html` (markup only), `deals`, `about`, `contact`, `privacy`, `terms`.
