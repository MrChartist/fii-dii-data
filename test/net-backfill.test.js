'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { parseStockezee } = require('../scripts/feed/sources/stockezee');
const { parseNiftytrader } = require('../scripts/feed/sources/niftytrader');
const { planNetBackfill } = require('../scripts/feed/net_backfill');

const fx = (f) => fs.readFileSync(path.join(__dirname, 'fixtures', f), 'utf8');
const M = (o) => new Map(Object.entries(o));

test('StockeZee and NiftyTrader parsers read net figures by DD-Mon-YYYY date', () => {
    const sz = parseStockezee(fx('stockezee_rows.html'));
    assert.deepStrictEqual(sz.get('01-Oct-2026'), { fii_net: -9484.22, dii_net: 10041.84 });
    const nt = parseNiftytrader(fx('niftytrader_rows.html'));
    assert.deepStrictEqual(nt.get('05-Oct-2026'), { fii_net: -4699.14, dii_net: 5181.62 });
    assert.strictEqual(parseStockezee('<html></html>').size, 0);
    assert.strictEqual(parseNiftytrader(null).size, 0);
});

const real = (date, f, d) => ({ date, fii_buy: 10, fii_sell: 5, fii_net: f, dii_buy: 3, dii_sell: 1, dii_net: d, _source: 'fetch-pipeline' });
const seed = (date, f, d) => ({ date, fii_buy: 99, fii_sell: 98, fii_net: f, dii_buy: 9, dii_sell: 8, dii_net: d, fii_idx_fut_long: 5, _source: 'historical-seed' });
const primary = M({ '01-Oct-2026': { fii_net: -100, dii_net: 120 }, '05-Oct-2026': { fii_net: 50, dii_net: -40 }, '06-Oct-2026': { fii_net: 7, dii_net: 8 }, '07-Oct-2026': { fii_net: 1, dii_net: 2 } });

test('adds missing sessions as net-only rows with null gross and cross-check flag', () => {
    const plan = planNetBackfill([], primary, [M({ '01-Oct-2026': { fii_net: -100, dii_net: 120 } })]);
    assert.deepStrictEqual(plan.added.sort(), ['01-Oct-2026', '05-Oct-2026', '06-Oct-2026', '07-Oct-2026']);
    const r = plan.rows.find(x => x.date === '01-Oct-2026');
    assert.strictEqual(r._partial, true);
    assert.strictEqual(r._cross_checked, true);
    assert.deepStrictEqual([r.fii_buy, r.fii_sell, r.dii_buy, r.dii_sell], [null, null, null, null]);
    assert.strictEqual(plan.rows.find(x => x.date === '05-Oct-2026')._cross_checked, false);
    assert.strictEqual(plan.rows[0].date, '07-Oct-2026', 'newest first');
});
test('never modifies real rows; reports a net disagreement', () => {
    const plan = planNetBackfill([real('01-Oct-2026', -100, 120), real('05-Oct-2026', 999, -40)], primary);
    assert.deepStrictEqual(plan.disagreements, ['05-Oct-2026']);
    assert.strictEqual(plan.rows.find(x => x.date === '05-Oct-2026').fii_net, 999);
    assert.strictEqual(plan.rows.find(x => x.date === '01-Oct-2026')._source, 'fetch-pipeline');
});
test('skips a date when an independent check source disagrees', () => {
    const plan = planNetBackfill([], primary, [M({ '06-Oct-2026': { fii_net: 7.5, dii_net: 8 } })]);
    assert.deepStrictEqual(plan.conflicts, ['06-Oct-2026']);
    assert.ok(!plan.rows.some(r => r.date === '06-Oct-2026'));
});
test('replaces estimated rows (dropping invented gross/F&O) and removes estimated rows on holidays', () => {
    const plan = planNetBackfill([seed('05-Oct-2026', 1, 1), seed('02-Oct-2026', 1, 1), seed('30-Sep-2026', 1, 1)], primary);
    assert.deepStrictEqual(plan.converted, ['05-Oct-2026']);
    assert.deepStrictEqual(plan.removed, ['02-Oct-2026'], '02-Oct is inside the archive range but not a session');
    const r = plan.rows.find(x => x.date === '05-Oct-2026');
    assert.strictEqual(r.fii_net, 50);
    assert.strictEqual(r.fii_idx_fut_long, 0, 'invented F&O discarded');
    assert.ok(plan.rows.some(x => x.date === '30-Sep-2026'), 'estimated row outside the archive range is left alone');
});
