# SEO module
Files crawlers need **must be served from the site root**, so they stay in `public/`; this folder owns the rules and the audit.

| Concern | Where | Rule |
|---|---|---|
| Titles / meta / canonical / OG | each `public/*.html` `<head>` | title ≤ 65 chars, description 70–160, one canonical, one `<h1>` |
| Structured data | JSON-LD in `<head>` (`index.html`) | must parse (`npm run seo`) |
| Crawl control | `public/robots.txt` (+ `.htaccess` headers) | must list the sitemap |
| Sitemap | `public/sitemap.xml` | `<lastmod>` auto-bumped by the feed on new sessions; add new pages by hand |
| AI discovery | `public/llms.txt`, `agent-ready.js` (Markdown endpoints, MCP) | keep in sync with real pages |
| Share cards / icons | `public/brand/share`, `brand-source/` | regenerate via `scripts/brand/` |

`npm run seo` → `seo/audit.js`. Current warnings (content decisions, not bugs): `index.html` title 69 chars and description 243 chars; `deals.html` title 68 chars.
