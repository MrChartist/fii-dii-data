'use strict';
/**
 * seo/audit.js — static SEO audit of every public/*.html page.
 * Run: npm run seo     (exit 1 on any ERROR; warnings never fail)
 * Checks: <title> length, meta description, canonical, og:title/description/image,
 * exactly one <h1>, JSON-LD parses, sitemap.xml lists every indexable page, robots.txt links sitemap.
 */
const fs = require('fs');
const path = require('path');
const PUB = path.join(__dirname, '..', 'public');
const pages = fs.readdirSync(PUB).filter(f => f.endsWith('.html'));
const errors = [], warns = [];
const E = (p, m) => errors.push(`${p}: ${m}`), W = (p, m) => warns.push(`${p}: ${m}`);
const decode = (t) => t && t.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const tag = (h, re) => decode((h.match(re) || [])[1]);

for (const f of pages) {
    const h = fs.readFileSync(path.join(PUB, f), 'utf8');
    const title = tag(h, /<title>([^<]*)<\/title>/i);
    if (!title) E(f, 'missing <title>'); else if (title.length > 65) W(f, `title ${title.length} chars (>65 truncates in results)`);
    const desc = tag(h, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i);
    if (!desc) E(f, 'missing meta description'); else if (desc.length < 70 || desc.length > 170) W(f, `description ${desc.length} chars (aim 70–160)`);
    if (!/<link[^>]+rel=["']canonical["']/i.test(h)) E(f, 'missing canonical');
    for (const og of ['og:title', 'og:description', 'og:image']) if (!new RegExp(`property=["']${og}["']`, 'i').test(h)) W(f, `missing ${og}`);
    const h1s = (h.match(/<h1[\s>]/gi) || []).length;
    if (h1s !== 1) W(f, `${h1s} <h1> tags (want exactly 1)`);
    for (const m of h.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
        try { JSON.parse(m[1]); } catch (e) { E(f, 'invalid JSON-LD: ' + e.message); }
    }
}
const sitemap = fs.readFileSync(path.join(PUB, 'sitemap.xml'), 'utf8');
for (const f of pages) {
    const slug = f === 'index.html' ? '' : f.replace(/\.html$/, '');
    if (!new RegExp(`<loc>[^<]*/${slug}(\\.html)?</loc>|<loc>[^<]*/</loc>`).test(sitemap) && f !== 'index.html') W('sitemap.xml', `does not list ${f}`);
}
if (!/sitemap:/i.test(fs.readFileSync(path.join(PUB, 'robots.txt'), 'utf8'))) E('robots.txt', 'no Sitemap: line');

warns.forEach(w => console.log('WARN  ' + w)); errors.forEach(e => console.log('ERROR ' + e));
console.log(`SEO audit: ${pages.length} pages, ${errors.length} errors, ${warns.length} warnings`);
process.exit(errors.length ? 1 : 0);
