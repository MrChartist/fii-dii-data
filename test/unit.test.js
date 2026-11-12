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
