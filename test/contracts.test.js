'use strict';
const test = require('node:test');
const assert = require('node:assert');
const schema = require('../contracts/session-row.schema.json');
const history = require('../data/history.json');
const D = require('../lib/dates');

function check(row) {
    const errs = [];
    for (const k of schema.required) if (!(k in row)) errs.push(`missing ${k}`);
    for (const [k, def] of Object.entries(schema.properties)) {
        if (!(k in row)) continue;
        const types = [].concat(def.type);
        if (types.includes('number') && !(typeof row[k] === 'number' || (row[k] === null && types.includes('null')))) errs.push(`${k} not a number`);
        if (row[k] === null && !types.includes('null')) errs.push(`${k} is null`);
        if (def.pattern && !new RegExp(def.pattern).test(row[k])) errs.push(`${k} bad format`);
        if (def.enum && !def.enum.includes(row[k])) errs.push(`${k} not in enum`);
    }
    return errs;
}

test('every history row satisfies contracts/session-row.schema.json', () => {
    const bad = history.map(r => [r.date, check(r)]).filter(([, e]) => e.length);
    assert.deepStrictEqual(bad.slice(0, 3), []);
});
test('history is unique per date and sorted newest-first', () => {
    const dates = history.map(r => r.date);
    assert.strictEqual(new Set(dates).size, dates.length);
    assert.deepStrictEqual([...dates].sort((a, b) => D.compare(b, a)), dates);
});
