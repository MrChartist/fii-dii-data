'use strict';
/**
 * Agent-readiness surface: everything an AI agent needs to understand and use
 * the site without scraping the HTML dashboard.
 *
 *   GET  /            → Markdown when the client asks for it (Accept: text/markdown)
 *   GET  /index.md    → the same Markdown, always
 *   GET  /.well-known/mcp/server-card.json  (and /.well-known/mcp.json)
 *   POST /mcp         → read-only MCP server (Streamable HTTP, stateless)
 *
 * Scope is deliberately the same as what the public dashboard already shows a
 * visitor: the latest session, the recent sessions, current F&O positioning and
 * the sector board. The full archive stays behind the keyed /api routes.
 */
const fs = require('fs');
const path = require('path');

const SITE = (process.env.SITE_URL || 'https://fii-diidata.mrchartist.com').replace(/\/+$/, '');
const SERVER_INFO = { name: 'fii-dii-data', title: 'FII & DII Data (Mr. Chartist)', version: '1.0.0' };
const PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
const MAX_SESSIONS = 30;
const DISCLAIMER = 'Provisional exchange data sourced from NSE and NSDL, for information only. Not investment advice.';

const LINK_HEADER = [
    '</llms.txt>; rel="describedby"; type="text/plain"',
    '</index.md>; rel="alternate"; type="text/markdown"',
    '</.well-known/mcp/server-card.json>; rel="service-desc"; type="application/json"',
    '</sitemap.xml>; rel="sitemap"; type="application/xml"',
    '</terms.html>; rel="terms-of-service"',
    '</about.html>; rel="about"'
].join(', ');

// Sign comes from the rounded value so -0.25 prints "+₹0 Cr", not "-₹0 Cr"
const cr = (v) => { const r = Math.round(v) || 0; return `${r >= 0 ? '+' : '-'}₹${Math.abs(r).toLocaleString('en-IN')} Cr`; };
const hasFao = (r) => !!r && ((r.fii_idx_fut_long || 0) !== 0 || (r.fii_idx_fut_short || 0) !== 0);

// ── Data views (shared by Markdown and MCP tools) ────────────────────────────
function createViews({ getHistoryData, getSectorData }) {
    const history = (n) => (getHistoryData(Math.max(1, Math.min(n, MAX_SESSIONS))) || []);

    function session(r) {
        return {
            date: r.date,
            fii_net_cr: r.fii_net, fii_buy_cr: r.fii_buy, fii_sell_cr: r.fii_sell,
            dii_net_cr: r.dii_net, dii_buy_cr: r.dii_buy, dii_sell_cr: r.dii_sell,
            combined_net_cr: Math.round((r.fii_net + r.dii_net) * 100) / 100
        };
    }

    function streak(rows, key) {
        if (!rows.length) return null;
        const dir = rows[0][key] >= 0 ? 1 : -1;
        let days = 0, total = 0;
        for (const r of rows) { if ((r[key] >= 0 ? 1 : -1) !== dir) break; days++; total += r[key]; }
        return { direction: dir > 0 ? 'buying' : 'selling', sessions: days, cumulative_cr: Math.round(total * 100) / 100 };
    }

    function latest() {
        const rows = history(MAX_SESSIONS);
        if (!rows.length) return null;
        return {
            ...session(rows[0]),
            fii_streak: streak(rows, 'fii_net'),
            dii_streak: streak(rows, 'dii_net'),
            unit: 'INR crore', source: 'NSE (provisional)', disclaimer: DISCLAIMER, dashboard: SITE + '/'
        };
    }

    function recent(days) {
        return { unit: 'INR crore', sessions: history(days || 10).map(session), source: 'NSE (provisional)', disclaimer: DISCLAIMER };
    }

    function fno() {
        const rows = history(MAX_SESSIONS);
        const r = rows.find(hasFao);
        if (!r) return null;
        const ratio = r.fii_idx_fut_short ? Math.round((r.fii_idx_fut_long / r.fii_idx_fut_short) * 100) / 100 : null;
        return {
            date: r.date,
            latest_cash_session: rows[0].date,
            is_latest_session: r.date === rows[0].date,
            unit: 'contracts (open interest)',
            fii: {
                index_futures: { long: r.fii_idx_fut_long, short: r.fii_idx_fut_short, net: r.fii_idx_fut_long - r.fii_idx_fut_short, long_short_ratio: ratio },
                stock_futures: { long: r.fii_stk_fut_long, short: r.fii_stk_fut_short, net: r.fii_stk_fut_long - r.fii_stk_fut_short },
                index_calls: { long: r.fii_idx_call_long, short: r.fii_idx_call_short, net: r.fii_idx_call_long - r.fii_idx_call_short },
                index_puts: { long: r.fii_idx_put_long, short: r.fii_idx_put_short, net: r.fii_idx_put_long - r.fii_idx_put_short }
            },
            dii: {
                index_futures: { long: r.dii_idx_fut_long, short: r.dii_idx_fut_short, net: r.dii_idx_fut_long - r.dii_idx_fut_short },
                stock_futures: { long: r.dii_stk_fut_long, short: r.dii_stk_fut_short, net: r.dii_stk_fut_long - r.dii_stk_fut_short }
            },
            index_put_call_ratio: r.pcr || null,
            source: 'NSE participant-wise open interest', disclaimer: DISCLAIMER
        };
    }

    function sectors(limit) {
        const all = (getSectorData() || []).filter(s => s && s.name);
        if (!all.length) return null;
        const row = (s) => ({ sector: s.name, fortnight_net_cr: s.fortnightCr, one_year_net_cr: s.oneYearCr, share_of_fpi_assets_pct: s.aumPct });
        const byFlow = [...all].sort((a, b) => b.fortnightCr - a.fortnightCr);
        const n = Math.max(1, Math.min(limit || 5, 12));
        return {
            fortnight_ending: all[0].lastDate || null,
            unit: 'INR crore',
            top_inflows: byFlow.filter(s => s.fortnightCr > 0).slice(0, n).map(row),
            top_outflows: byFlow.filter(s => s.fortnightCr < 0).slice(-n).reverse().map(row),
            sectors_tracked: all.length,
            source: 'NSDL fortnightly FPI sector report', disclaimer: DISCLAIMER
        };
    }

    return { latest, recent, fno, sectors };
}

// ── Markdown representation of the homepage ──────────────────────────────────
function buildMarkdown(views) {
    const l = views.latest(), rec = views.recent(10), f = views.fno(), s = views.sectors(5);
    const out = [];
    out.push('# FII & DII Data — Indian institutional money flows', '');
    out.push('Daily FII/FPI and DII cash flows, F&O positioning and FPI sector rotation for Indian equities, by Mr. Chartist (Investology, SEBI Registered Research Analyst INH000015297).', '');
    if (l) {
        out.push(`## Latest session: ${l.date}`, '');
        out.push(`- **FII/FPI net:** ${cr(l.fii_net_cr)} (bought ₹${l.fii_buy_cr.toLocaleString('en-IN')} Cr, sold ₹${l.fii_sell_cr.toLocaleString('en-IN')} Cr)`);
        out.push(`- **DII net:** ${cr(l.dii_net_cr)} (bought ₹${l.dii_buy_cr.toLocaleString('en-IN')} Cr, sold ₹${l.dii_sell_cr.toLocaleString('en-IN')} Cr)`);
        out.push(`- **Combined net:** ${cr(l.combined_net_cr)}`);
        if (l.fii_streak) out.push(`- **FII streak:** ${l.fii_streak.sessions} session(s) of net ${l.fii_streak.direction}, ${cr(l.fii_streak.cumulative_cr)}`);
        if (l.dii_streak) out.push(`- **DII streak:** ${l.dii_streak.sessions} session(s) of net ${l.dii_streak.direction}, ${cr(l.dii_streak.cumulative_cr)}`);
        out.push('');
    } else {
        out.push('_No data is available right now._', '');
    }
    if (rec.sessions.length) {
        out.push('## Recent sessions (₹ crore)', '', '| Date | FII net | DII net | Combined |', '|---|---:|---:|---:|');
        rec.sessions.forEach(r => out.push(`| ${r.date} | ${cr(r.fii_net_cr)} | ${cr(r.dii_net_cr)} | ${cr(r.combined_net_cr)} |`));
        out.push('');
    }
    if (f) {
        const n = (v) => `${v >= 0 ? '+' : ''}${Number(v).toLocaleString('en-IN')}`;
        out.push(`## FII derivatives positioning (${f.date})`, '');
        if (!f.is_latest_session) out.push(`_NSE has not yet published participant open interest for ${f.latest_cash_session}; this is the most recent available._`, '');
        out.push('| Segment | Long | Short | Net |', '|---|---:|---:|---:|');
        const seg = [['Index futures', f.fii.index_futures], ['Stock futures', f.fii.stock_futures], ['Index calls', f.fii.index_calls], ['Index puts', f.fii.index_puts]];
        seg.forEach(([name, x]) => out.push(`| ${name} | ${Number(x.long).toLocaleString('en-IN')} | ${Number(x.short).toLocaleString('en-IN')} | ${n(x.net)} |`));
        out.push('', `Index-futures long/short ratio: ${f.fii.index_futures.long_short_ratio ?? 'n/a'}. Index put/call ratio: ${f.index_put_call_ratio ?? 'n/a'}.`, '');
    }
    if (s) {
        out.push(`## FPI sector rotation (fortnight ending ${s.fortnight_ending || 'latest'})`, '');
        if (s.top_inflows.length) out.push('**Largest inflows:** ' + s.top_inflows.map(x => `${x.sector} (${cr(x.fortnight_net_cr)})`).join(', '));
        if (s.top_outflows.length) out.push('**Largest outflows:** ' + s.top_outflows.map(x => `${x.sector} (${cr(x.fortnight_net_cr)})`).join(', '));
        out.push('');
    }
    out.push('## Sections', '',
        `- [FII/DII flows](${SITE}/) — today's cash flows, streaks and signals`,
        `- [F&O positioning](${SITE}/#t-fno) — participant-wise open interest`,
        `- [Flow analytics](${SITE}/#t-matrix) — daily, weekly, monthly and annual archive`,
        `- [Sector rotation](${SITE}/#t-sector) — NSDL fortnightly FPI allocation`,
        `- [Bulk & block deals](${SITE}/deals.html)`,
        `- [About](${SITE}/about.html) · [Contact](${SITE}/contact.html) · [Terms & disclaimer](${SITE}/terms.html)`, '');
    out.push('## For agents', '',
        `- Site summary: ${SITE}/llms.txt`,
        `- MCP server (read-only, no auth): \`POST ${SITE}/mcp\` — card at ${SITE}/.well-known/mcp/server-card.json`, '');
    out.push('## Sources and terms', '',
        'Cash flows: NSE provisional FII/DII figures, published after market close (about 6–7 PM IST). F&O: NSE participant-wise open interest. Sectors: NSDL fortnightly FPI reports.',
        '', `${DISCLAIMER} Personal, non-commercial use only; see ${SITE}/terms.html.`, '');
    return out.join('\n');
}

// ── MCP (Streamable HTTP, stateless, tools only) ─────────────────────────────
const TOOLS = [
    {
        name: 'get_latest_flows',
        title: 'Latest FII/DII cash flows',
        description: 'Net, gross buy and gross sell figures (INR crore) for Foreign (FII/FPI) and Domestic (DII) institutional investors in Indian equities for the most recent NSE session, plus the current buying/selling streak of each.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true, openWorldHint: false }
    },
    {
        name: 'get_recent_sessions',
        title: 'Recent FII/DII sessions',
        description: `Daily FII and DII cash-market figures (INR crore) for the most recent trading sessions, newest first. Up to ${MAX_SESSIONS} sessions.`,
        inputSchema: {
            type: 'object',
            properties: { days: { type: 'integer', minimum: 1, maximum: MAX_SESSIONS, default: 10, description: 'Number of trading sessions to return.' } },
            additionalProperties: false
        },
        annotations: { readOnlyHint: true, openWorldHint: false }
    },
    {
        name: 'get_fno_positioning',
        title: 'FII/DII derivatives positioning',
        description: 'Participant-wise open interest (contracts) for FIIs and DIIs: index futures, stock futures, index calls and index puts, with the FII index-futures long/short ratio and index put/call ratio. Returns the most recent session NSE has published.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true, openWorldHint: false }
    },
    {
        name: 'get_sector_flows',
        title: 'FPI sector rotation',
        description: 'Sectors with the largest FPI inflows and outflows (INR crore) in the latest NSDL fortnightly report, with one-year flow and share of FPI assets.',
        inputSchema: {
            type: 'object',
            properties: { limit: { type: 'integer', minimum: 1, maximum: 12, default: 5, description: 'How many sectors to list on each side.' } },
            additionalProperties: false
        },
        annotations: { readOnlyHint: true, openWorldHint: false }
    }
];

function callTool(views, name, args) {
    const a = args && typeof args === 'object' ? args : {};
    const int = (v, d) => (Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : d);
    switch (name) {
        case 'get_latest_flows': return views.latest();
        case 'get_recent_sessions': return views.recent(int(a.days, 10));
        case 'get_fno_positioning': return views.fno();
        case 'get_sector_flows': return views.sectors(int(a.limit, 5));
        default: return undefined;
    }
}

function serverCard() {
    const endpoint = `${SITE}/mcp`;
    return {
        $schema: 'https://static.modelcontextprotocol.io/schemas/mcp-server-card/v1.json',
        version: '1.0',
        protocolVersion: PROTOCOL_VERSIONS[0],
        name: SERVER_INFO.name,
        title: SERVER_INFO.title,
        description: 'Read-only access to daily FII/DII cash flows, F&O positioning and FPI sector rotation for Indian equities.',
        serverInfo: SERVER_INFO,
        url: endpoint,
        endpoint,
        transport: { type: 'streamable-http', endpoint: '/mcp', url: endpoint },
        capabilities: { tools: { listChanged: false } },
        authentication: { required: false, schemes: [] },
        tools: TOOLS.map(t => ({ name: t.name, title: t.title, description: t.description, inputSchema: t.inputSchema })),
        resources: [], prompts: [],
        instructions: 'All amounts are INR crore unless stated. Cash figures are provisional NSE numbers. Not investment advice.',
        documentationUrl: `${SITE}/llms.txt`,
        websiteUrl: `${SITE}/`,
        termsOfServiceUrl: `${SITE}/terms.html`,
        provider: { name: 'Mr. Chartist (Investology)', url: 'https://mrchartist.com' }
    };
}

// Small per-IP limiter so the open endpoint cannot be used to hammer the server
function limiter(maxPerMin) {
    const hits = new Map();
    setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (now - v.t > 60000) hits.delete(k); }, 60000).unref();
    return (ip) => {
        const now = Date.now(), e = hits.get(ip);
        if (!e || now - e.t > 60000) { hits.set(ip, { t: now, n: 1 }); return false; }
        return ++e.n > maxPerMin;
    };
}

function handleRpc(views, msg) {
    const reply = (result) => ({ jsonrpc: '2.0', id: msg.id, result });
    const fail = (code, message) => ({ jsonrpc: '2.0', id: msg.id ?? null, error: { code, message } });
    if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return fail(-32600, 'Invalid Request');
    const isNotification = msg.id === undefined || msg.id === null;
    switch (msg.method) {
        case 'initialize': {
            const asked = msg.params && msg.params.protocolVersion;
            return reply({
                protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
                capabilities: { tools: { listChanged: false } },
                serverInfo: SERVER_INFO,
                instructions: 'Read-only Indian institutional flow data. Amounts are INR crore; cash figures are provisional NSE numbers. Not investment advice.'
            });
        }
        case 'ping': return reply({});
        case 'tools/list': return reply({ tools: TOOLS });
        case 'tools/call': {
            const p = msg.params || {};
            if (!TOOLS.some(t => t.name === p.name)) return fail(-32602, `Unknown tool: ${p.name}`);
            let data;
            try { data = callTool(views, p.name, p.arguments); }
            catch (err) { return reply({ content: [{ type: 'text', text: `Tool failed: ${err.message}` }], isError: true }); }
            if (data == null) return reply({ content: [{ type: 'text', text: 'No data is available for this request right now.' }], isError: true });
            return reply({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }], structuredContent: data });
        }
        default:
            if (isNotification || msg.method.startsWith('notifications/')) return null; // nothing to answer
            return fail(-32601, `Method not found: ${msg.method}`);
    }
}

// ── Wiring ───────────────────────────────────────────────────────────────────
function mount(app, deps) {
    const views = createViews(deps);
    const express = require('express');
    const limited = limiter(Number(process.env.MCP_RATE_PER_MIN || 60));

    const sendMarkdown = (res) => {
        res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.setHeader('Vary', 'Accept');
        res.setHeader('Link', LINK_HEADER);
        res.send(buildMarkdown(views));
    };

    // A malformed JSON body should get a JSON error, not Express's HTML page
    // (which also prints a stack trace outside production)
    app.use((err, req, res, next) => {
        if (err && err.type === 'entity.parse.failed') {
            const body = req.path === '/mcp'
                ? { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }
                : { error: 'Invalid JSON body' };
            return res.status(400).json(body);
        }
        next(err);
    });

    // Homepage: advertise machine-readable resources, and serve Markdown to
    // clients that prefer it. Browsers send text/html first and fall through.
    app.get('/', (req, res, next) => {
        res.setHeader('Link', LINK_HEADER);
        res.setHeader('Vary', 'Accept');
        const accept = String(req.headers.accept || '');
        if (/text\/markdown/i.test(accept) && req.accepts(['text/markdown', 'text/html']) === 'text/markdown') {
            try { return sendMarkdown(res); } catch (err) { console.error('[AGENT] Markdown render failed:', err.message); }
        }
        next();
    });
    app.get(['/index.md', '/llms-full.txt'], (req, res) => {
        try { sendMarkdown(res); } catch (err) { res.status(500).type('text/plain').send('Markdown unavailable'); }
    });

    // express.static skips dot-directories, so the card needs explicit routes
    app.get(['/.well-known/mcp/server-card.json', '/.well-known/mcp.json'], (req, res) => {
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.json(serverCard());
    });

    app.options('/mcp', (req, res) => {
        res.set({ 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Accept, Mcp-Protocol-Version, Mcp-Session-Id' });
        res.sendStatus(204);
    });
    app.post('/mcp', express.json({ limit: '64kb' }), (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'no-store');
        if (limited(req.ip)) return res.status(429).json({ jsonrpc: '2.0', id: null, error: { code: -32000, message: 'Too many requests' } });
        const body = req.body;
        if (Array.isArray(body) || !body || typeof body !== 'object') {
            return res.status(400).json({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid Request' } });
        }
        const out = handleRpc(views, body);
        if (out === null) return res.sendStatus(202);
        res.json(out);
    });
    // Stateless server: no server-initiated stream and no session to delete
    app.all('/mcp', (req, res) => {
        res.setHeader('Allow', 'POST, OPTIONS');
        res.status(405).json({ jsonrpc: '2.0', id: null, error: { code: -32000, message: 'Method not allowed. Use POST.' } });
    });
}

module.exports = { mount, createViews, buildMarkdown, handleRpc, serverCard, TOOLS, LINK_HEADER, SITE };
