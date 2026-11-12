'use strict';
// Guards the committed data archive. Runs in CI and after every scheduled
// fetch, before the data is committed.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, '..', 'data');
const read = f => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));
const M = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
const DATE_RE = /^(\d{2})-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d{4})$/;
const ts = s => { const m = DATE_RE.exec(s); return Date.UTC(+m[3], M[m[2]], +m[1]); };

const history = read('history.json');

test('history.json is a substantial array', () => {
    assert.ok(Array.isArray(history));
    assert.ok(history.length >= 100, `only ${history.length} rows — archive looks truncated`);
});

test('every row has a valid, unique date, newest first', () => {
    const seen = new Set();
    let prev = Infinity;
    for (const r of history) {
        assert.match(r.date, DATE_RE, `bad date ${r.date}`);
        assert.ok(!seen.has(r.date), `duplicate date ${r.date}`);
        seen.add(r.date);
        const t = ts(r.date);
        assert.ok(t < prev, `${r.date} is out of order`);
        prev = t;
    }
});

test('cash figures are finite and net = buy − sell', () => {
    for (const r of history) {
        for (const k of ['fii_buy', 'fii_sell', 'fii_net', 'dii_buy', 'dii_sell', 'dii_net']) {
            assert.ok(Number.isFinite(r[k]), `${r.date} ${k} is not a number`);
        }
        // Seed rows are rounded to whole crores, hence the tolerance
        assert.ok(Math.abs(r.fii_buy - r.fii_sell - r.fii_net) <= 1.5, `${r.date} FII net does not reconcile`);
        assert.ok(Math.abs(r.dii_buy - r.dii_sell - r.dii_net) <= 1.5, `${r.date} DII net does not reconcile`);
        assert.ok(Math.abs(r.fii_net) < 100000 && Math.abs(r.dii_net) < 100000, `${r.date} net is implausible`);
    }
});

test('F&O is present for every session except the newest few', () => {
    const hasFao = r => (r.fii_idx_fut_long || 0) !== 0 || (r.fii_idx_fut_short || 0) !== 0;
    // NSE publishes participant OI later than cash, so the newest rows may lag.
    const missing = history.slice(3).filter(r => !hasFao(r)).map(r => r.date);
    assert.deepStrictEqual(missing, [], `sessions without F&O: ${missing.join(', ')}`);
    for (const r of history.filter(hasFao)) {
        assert.strictEqual(r.fii_idx_fut_net, r.fii_idx_fut_long - r.fii_idx_fut_short, `${r.date} futures net mismatch`);
        assert.ok(r.pcr > 0, `${r.date} has F&O but no PCR`);
    }
});

test('latest.json is the newest history row', () => {
    const latest = read('latest.json');
    assert.strictEqual(latest.date, history[0].date);
    assert.strictEqual(latest.fii_net, history[0].fii_net);
    assert.strictEqual(latest.dii_net, history[0].dii_net);
});
