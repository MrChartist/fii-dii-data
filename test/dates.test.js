'use strict';
const test = require('node:test');
const assert = require('node:assert');
const D = require('../lib/dates');

test('parse/format round-trip and reject junk', () => {
    assert.strictEqual(D.format(D.parse('05-Jan-2026')), '05-Jan-2026');
    assert.strictEqual(D.parse('2026-01-05'), null);
    assert.strictEqual(D.parse('31-Foo-2026'), null);
});
test('compare sorts chronologically across months and years', () => {
    const s = ['01-Jan-2027', '30-Dec-2026', '02-Feb-2026'].sort(D.compare);
    assert.deepStrictEqual(s, ['02-Feb-2026', '30-Dec-2026', '01-Jan-2027']);
});
test('istToday rolls over at 18:30 UTC, not midnight UTC', () => {
    assert.strictEqual(D.istDateKey(new Date('2026-11-26T18:29:00Z')), '2026-11-26');
    assert.strictEqual(D.istDateKey(new Date('2026-11-26T18:31:00Z')), '2026-11-27');
});
test('missingSessions lists weekday gaps only', () => {
    const got = D.missingSessions(['13-Nov-2026', '20-Nov-2026'], { until: D.parse('24-Nov-2026') });
    assert.deepStrictEqual(got, ['16-Nov-2026', '17-Nov-2026', '18-Nov-2026', '19-Nov-2026', '23-Nov-2026', '24-Nov-2026']);
});
