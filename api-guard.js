'use strict';
/**
 * API access control.
 *
 * The public API is NOT offered to third parties. Access is limited to:
 *   1. Our own dashboard (same-origin browser requests), rate-limited per IP.
 *   2. Approved partners presenting a key from API_KEYS (comma-separated env var)
 *      in the `x-api-key` header (or `Authorization: Bearer <key>`).
 * Admin/operational routes (agent runs, API docs) need a key always.
 *
 * Note: browser headers can be forged by non-browser clients, so same-origin
 * checking deters casual scraping only. Real protection comes from keys + rate
 * limits; anything that must stay private should be admin-only.
 */
const crypto = require('crypto');

const OWN_HOSTS = (process.env.ALLOWED_ORIGINS ||
    'fii-diidata.mrchartist.com,mrchartist.com,www.mrchartist.com')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const DEV_HOSTS = ['localhost', '127.0.0.1', '[::1]'];
const IS_PROD = process.env.NODE_ENV === 'production';

const KEYS = (process.env.API_KEYS || '').split(',').map(s => s.trim()).filter(Boolean);

// Routes that need a key even from our own origin.
const ADMIN_ROUTES = [
    /^\/api\/agents\/docs/, /^\/api\/agents\/runs/, /^\/api\/agents\/run(\/|-all)/
];
// Routes with their own authentication (setup-env checks SETUP_KEY).
const SELF_AUTH = [/^\/api\/setup-env$/];

function safeEq(a, b) {
    const x = Buffer.from(String(a)), y = Buffer.from(String(b));
    return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function presentedKey(req) {
    const h = req.headers['x-api-key'] || (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    return h ? String(h) : '';
}
function hasValidKey(req) {
    const k = presentedKey(req);
    return !!k && KEYS.some(v => safeEq(k, v));
}
function hostOf(u) { try { return new URL(u).hostname.toLowerCase(); } catch { return ''; } }
function isAllowedHost(h) {
    return OWN_HOSTS.includes(h) || (!IS_PROD && DEV_HOSTS.includes(h));
}
function isOwnBrowser(req) {
    const site = req.headers['sec-fetch-site'];
    const origin = req.headers.origin ? hostOf(req.headers.origin) : '';
    const referer = req.headers.referer ? hostOf(req.headers.referer) : '';
    if (origin) return isAllowedHost(origin);
    if (referer) return isAllowedHost(referer);
    // Same-origin GETs carry no Origin; browsers still send Sec-Fetch-Site.
    return site === 'same-origin';
}

// Simple in-memory per-IP limiter for keyless browser traffic.
const hits = new Map();
const WINDOW_MS = 60 * 1000, MAX_HITS = Number(process.env.API_RATE_PER_MIN || 240);
setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (now - v.t > WINDOW_MS) hits.delete(k); }, WINDOW_MS).unref();
function limited(ip) {
    const now = Date.now(); const e = hits.get(ip);
    if (!e || now - e.t > WINDOW_MS) { hits.set(ip, { t: now, n: 1 }); return false; }
    return ++e.n > MAX_HITS;
}

function apiGuard(req, res, next) {
    // Express matches routes case-insensitively and ignores duplicate slashes,
    // so normalise before testing — otherwise /API/agents/run-all walks past
    // every check below and still reaches the handler.
    const p = req.path.toLowerCase().replace(/\/{2,}/g, '/');
    if (!p.startsWith('/api/')) return next();
    res.setHeader('Cache-Control', res.getHeader('Cache-Control') || 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    if (SELF_AUTH.some(r => r.test(p))) return next();

    const keyOk = hasValidKey(req);
    const admin = ADMIN_ROUTES.some(r => r.test(p));
    if (admin) {
        if (keyOk) return next();
        return res.status(404).json({ error: 'Not found' });   // do not reveal these exist
    }
    if (keyOk) return next();
    if (isOwnBrowser(req)) {
        if (limited(req.ip)) return res.status(429).json({ error: 'Too many requests' });
        return next();
    }
    return res.status(403).json({ error: 'API access is restricted' });
}

// CORS: only our own origins (partners with keys should call server-to-server).
function corsOptions() {
    return {
        origin(origin, cb) {
            if (!origin) return cb(null, false);
            const h = hostOf(origin);
            cb(null, isAllowedHost(h));
        },
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type', 'x-api-key', 'Authorization']
    };
}

module.exports = { apiGuard, corsOptions };
