# SEO

Reference table and file locations: `README.md`. `npm run seo` (also in CI) checks title/description length, canonical, one `<h1>`, Open Graph, JSON-LD parses, sitemap + robots.

- Length limits are search-result guidance, not law. If a longer title or description serves users better, accept the warning or adjust `audit.js` with a reason.
- New public page → add it to `public/sitemap.xml` and give it the same head metadata as its siblings.
- Dynamic bits (the homepage `og:description` is rewritten per request in `server/routes/pages.js`) must keep the original `<meta>` tags matchable by their regex.
- AI/agent discovery (`public/llms.txt`, `agent-ready.js`, WebMCP) should describe pages that really exist.
