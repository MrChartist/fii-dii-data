'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

test('package-lock.json satisfies package.json', () => {
    const pkg = require('../package.json');
    const lock = require('../package-lock.json');
    const root = lock.packages[''];
    assert.deepStrictEqual(root.dependencies, pkg.dependencies, 'run `npm install` and commit package-lock.json');
    assert.deepStrictEqual(root.devDependencies, pkg.devDependencies);
});

test('parseFao reads the real NSE participant-OI file (title row + CRLF)', () => {
    const { parseFao } = require('../scripts/fetch_data');
    const csv = fs.readFileSync(path.join(__dirname, 'fixtures', 'fao_participant_oi.csv'), 'utf8');
    assert.ok(csv.startsWith('""Participant wise'), 'fixture must keep the malformed title row');
    const out = parseFao(csv);
    assert.deepStrictEqual(out.FII, {
        idx_fut_long: 32698, idx_fut_short: 304677, stk_fut_long: 4058928, stk_fut_short: 3329768,
        idx_call_long: 521246, idx_call_short: 798673, idx_put_long: 930475, idx_put_short: 399488
    });
    assert.strictEqual(out.DII.idx_fut_long, 68620);
    assert.strictEqual(out.DII.stk_fut_short, 4650791);
});

test('parseFao tolerates junk and a missing title row', () => {
    const { parseFao } = require('../scripts/fetch_data');
    assert.deepStrictEqual(parseFao('<!DOCTYPE html><html>404</html>'), {});
    assert.deepStrictEqual(parseFao(''), {});
    const csv = fs.readFileSync(path.join(__dirname, 'fixtures', 'fao_participant_oi.csv'), 'utf8');
    const noTitle = csv.split(/\r?\n/).slice(1).join('\n');
    assert.strictEqual(parseFao(noTitle).FII.idx_fut_long, 32698);
});

test('apiGuard cannot be bypassed by changing the path case', () => {
    const { apiGuard } = require('../api-guard');
    const call = (p, headers = {}) => {
        let status = 200, passed = false;
        const res = { setHeader() {}, getHeader() {}, status(c) { status = c; return this; }, json() {} };
        apiGuard({ path: p, headers, ip: '1.2.3.4' }, res, () => { passed = true; });
        return passed ? 'next' : status;
    };
    assert.strictEqual(call('/api/agents/run-all'), 404);
    assert.strictEqual(call('/API/agents/run-all'), 404);
    assert.strictEqual(call('/Api/Telegram/delivery-log', { origin: 'https://mrchartist.com' }), 404);
    assert.strictEqual(call('/API/data'), 403);
    assert.strictEqual(call('/api/data', { 'sec-fetch-site': 'same-origin' }), 'next');
    assert.strictEqual(call('/index.html'), 'next');
});

test('F&O message does not invent signals when F&O is absent', () => {
    const { buildDerivativesMessage } = require('../telegram-messages');
    const msg = buildDerivativesMessage({ date: '12-Nov-2026', fii_net: 100, pcr: 0, sentiment_score: 50 });
    assert.match(msg, /not published yet/);
    assert.doesNotMatch(msg, /Extreme Fear|LONG HEAVY/);
});

test('trading-calendar helpers', () => {
    const cal = require('../public/js/mc-freshness.js');
    const d = (y, m, day) => new Date(Date.UTC(y, m - 1, day));
    // Thu 12 Nov 2026, before the evening publish → expect Wed 11 Nov
    assert.strictEqual(cal.lastExpectedSession(new Date('2026-11-12T08:00:00Z')).toISOString().slice(0, 10), '2026-11-11');
    // …after ~7 PM IST → expect the same day
    assert.strictEqual(cal.lastExpectedSession(new Date('2026-11-12T14:30:00Z')).toISOString().slice(0, 10), '2026-11-12');
    // Monday morning → previous Friday
    assert.strictEqual(cal.lastExpectedSession(new Date('2026-11-16T03:00:00Z')).toISOString().slice(0, 10), '2026-11-13');
    assert.strictEqual(cal.sessionsBetween(d(2026, 9, 30), d(2026, 11, 12)), 31);
    assert.strictEqual(cal.sessionsBetween(d(2026, 11, 13), d(2026, 11, 16)), 1);
    assert.strictEqual(cal.sessionsBetween(d(2026, 11, 12), d(2026, 11, 12)), 0);
});

test('NSDL daily parser reads net (not gross purchases) and ignores the derivatives table', () => {
    const { parseDailyTrends } = require('../scripts/fetch_nsdl');
    const html = fs.readFileSync(path.join(__dirname, 'fixtures', 'nsdl_latest.html'), 'utf8');
    const out = parseDailyTrends(html);
    assert.strictEqual(out.rows.length, 1);
    assert.deepStrictEqual(out.latest, {
        date: '12-Nov-2026', equity_net: 14693.72, debt_net: 1295.24, hybrid_net: 44.45, total_net: 16028.21
    });
});

test('agent-ready: Markdown, MCP protocol and server card', () => {
    const ar = require('../agent-ready');
    const { getHistoryData, getSectorData } = require('../scripts/fetch_data');
    const views = ar.createViews({ getHistoryData, getSectorData });

    const md = ar.buildMarkdown(views);
    assert.match(md, /^# FII & DII Data/);
    assert.match(md, /## Latest session: \d{2}-[A-Z][a-z]{2}-\d{4}/);
    assert.doesNotMatch(md, /-₹0 Cr|NaN|undefined/);

    const rpc = (m) => ar.handleRpc(views, { jsonrpc: '2.0', ...m });
    const init = rpc({ id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } });
    assert.strictEqual(init.result.protocolVersion, '2025-06-18');
    assert.ok(init.result.capabilities.tools);
    assert.strictEqual(rpc({ method: 'notifications/initialized' }), null);
    const names = rpc({ id: 2, method: 'tools/list' }).result.tools.map(t => t.name);
    assert.deepStrictEqual(names, ['get_latest_flows', 'get_recent_sessions', 'get_fno_positioning', 'get_sector_flows']);
    // The archive must stay capped no matter what is asked for
    const many = rpc({ id: 3, method: 'tools/call', params: { name: 'get_recent_sessions', arguments: { days: 100000 } } });
    assert.ok(many.result.structuredContent.sessions.length <= 30);
    assert.strictEqual(rpc({ id: 4, method: 'tools/call', params: { name: 'nope' } }).error.code, -32602);
    assert.strictEqual(rpc({ id: 5, method: 'resources/list' }).error.code, -32601);

    const card = ar.serverCard();
    assert.ok(card.name && card.version && card.capabilities.tools);
    assert.match(card.endpoint, /^https:\/\/.+\/mcp$/);
});

test('agent-ready static files', () => {
    const pub = (f) => fs.readFileSync(path.join(__dirname, '..', 'public', f), 'utf8');
    assert.match(pub('robots.txt'), /^Content-Signal: .*ai-train=no/m);
    assert.match(pub('llms.txt'), /^# FII & DII Data\n\n> /);
    const html = pub('index.html');
    assert.strictEqual((html.match(/<h1[\s>]/g) || []).length, 1, 'exactly one <h1> on the homepage');
    for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) JSON.parse(m[1]);
    for (const f of ['about.html', 'contact.html', 'terms.html']) {
        assert.strictEqual((pub(f).match(/<h1[\s>]/g) || []).length, 1, f);
        assert.ok(pub('js/mc-ui.js').includes('href="/' + f), 'footer links ' + f);
    }
});
