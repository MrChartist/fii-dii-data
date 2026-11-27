'use strict';
/** Report weekday sessions missing from data/history.json (holidays included — verify before backfilling).
 *  Usage: node scripts/checks/gaps.js [--days 60]   Exit 0 always; it is a report, not a gate. */
const { readJSON } = require('../../lib/store');
const D = require('../../lib/dates');
const days = Number((process.argv.find(a => a.startsWith('--days=')) || '--days=60').split('=')[1]);
const rows = readJSON('history.json', []);
const until = D.istToday();
const since = new Date(+until - days * D.DAY);
const missing = D.missingSessions(rows.map(r => r.date).filter(d => D.parse(d) >= since), { since, until });
const latest = rows.map(r => r.date).sort(D.compare).pop();
console.log(`Latest session: ${latest}  |  IST today: ${D.format(until)}`);
console.log(missing.length ? `Missing weekday sessions (last ${days}d, ${missing.length}): ${missing.join(', ')}` : 'No gaps.');
