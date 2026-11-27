'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { parseGroww, toNseDate } = require('../scripts/feed/sources/groww');
const { parseMoneycontrol } = require('../scripts/feed/sources/moneycontrol');
const { validateData } = require('../scripts/feed/fetch_data');

const fx = (f) => fs.readFileSync(path.join(__dirname, 'fixtures', f), 'utf8');

test('Groww parser reads gross buy/sell/net for FII and DII, ignoring other tables', () => {
    const rows = parseGroww(fx('groww_fii_dii.html'));
    assert.strictEqual(rows.length, 3);
    assert.deepStrictEqual(rows[0], { date: '26-Nov-2026', fii_buy: 17879.74, fii_sell: 12036.41, fii_net: 5843.33, dii_buy: 24352.87, dii_sell: 18722.15, dii_net: 5630.72 });
    assert.ok(rows.every(validateData), 'every parsed row passes the feed validator');
});
test('Groww parser tolerates junk and markup without a table', () => {
    assert.deepStrictEqual(parseGroww(''), []);
    assert.deepStrictEqual(parseGroww(null), []);
    assert.deepStrictEqual(parseGroww('<tr><td>x</td></tr>'), []);
    assert.strictEqual(toNseDate('5 Dec 2026'), '05-Dec-2026');
    assert.strictEqual(toNseDate('31 Foo 2026'), null);
});
test('Moneycontrol parser converts ISO dates and comma/negative numbers', () => {
    const rows = parseMoneycontrol(fx('moneycontrol_next_data.html'));
    assert.deepStrictEqual(rows[2], { date: '23-Nov-2026', fii_net: 5672.99, dii_net: -2760.12 });
    assert.deepStrictEqual(parseMoneycontrol('<html>no data</html>'), []);
});

// ── recoverFromMirrors: isolate in a temp cwd so data/ is untouched ──
function inTempData(history, fn) {
    const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'mirror-'));
    fs.mkdirSync(path.join(dir, 'data'));
    fs.writeFileSync(path.join(dir, 'data', 'history.json'), JSON.stringify(history));
    const cwd = process.cwd();
    process.chdir(dir);
    // fresh module instances so DATA_DIR resolves to the temp cwd
    for (const k of Object.keys(require.cache)) if (/lib[\\/]store|scripts[\\/]feed[\\/]fetch_data/.test(k)) delete require.cache[k];
    return Promise.resolve(fn(require('../scripts/feed/fetch_data'), dir)).finally(() => process.chdir(cwd));
}
const G = parseGroww(fx('groww_fii_dii.html'));
const MC = parseMoneycontrol(fx('moneycontrol_next_data.html'));
const stub = (grow, mc) => ({ fetchGroww: async () => grow, fetchMoneycontrol: async () => mc });

test('recoverFromMirrors adds only missing, validated, cross-checked sessions and never overwrites', async () => {
    const existing = [{ date: '25-Nov-2026', fii_net: 1, _source: 'fetch-pipeline' }];
    await inTempData(existing, async (feed, dir) => {
        const added = await feed.recoverFromMirrors(stub(G, MC));
        assert.deepStrictEqual(added.map(r => r.date), ['26-Nov-2026', '23-Nov-2026'].filter(d => G.some(g => g.date === d)));
        const hist = JSON.parse(fs.readFileSync(path.join(dir, 'data', 'history.json'), 'utf8'));
        assert.strictEqual(hist.find(r => r.date === '25-Nov-2026').fii_net, 1, 'existing row untouched');
        assert.strictEqual(hist[0].date, '26-Nov-2026', 'sorted newest-first');
        assert.strictEqual(hist[0]._source, 'mirror-groww');
        assert.strictEqual(hist[0]._cross_checked, true);
        assert.strictEqual(JSON.parse(fs.readFileSync(path.join(dir, 'data', 'latest.json'), 'utf8')).date, '26-Nov-2026');
    });
});
test('recoverFromMirrors rejects a session when the two mirrors disagree on net', async () => {
    await inTempData([], async (feed) => {
        const badMc = MC.map(r => r.date === '26-Nov-2026' ? { ...r, fii_net: r.fii_net + 50 } : r);
        const added = await feed.recoverFromMirrors(stub(G, badMc));
        assert.ok(!added.some(r => r.date === '26-Nov-2026'));
    });
});
test('recoverFromMirrors rejects rows whose net does not equal buy - sell, and survives a dead mirror', async () => {
    await inTempData([], async (feed) => {
        const broken = G.map(r => ({ ...r, fii_net: r.fii_net + 500 }));
        assert.deepStrictEqual(await feed.recoverFromMirrors(stub(broken, [])), []);
        const dead = { fetchGroww: async () => { throw new Error('boom'); }, fetchMoneycontrol: async () => MC };
        assert.deepStrictEqual(await feed.recoverFromMirrors(dead), []);
    });
});
