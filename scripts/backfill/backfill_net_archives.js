#!/usr/bin/env node
'use strict';
/**
 * Backfill missing sessions as NET-ONLY rows from the public archives, fix estimated rows, derive holidays,
 * then fill F&O from NSE's archive. Rules live in scripts/feed/net_backfill.js.
 *   node scripts/backfill/backfill_net_archives.js [--dry]
 * Sources: StockeZee (primary, ~1 year) cross-checked by NiftyTrader (~90 sessions) and Moneycontrol (~30).
 */
const { readJSON, writeJSON } = require('../../lib/store');
const D = require('../../lib/dates');
const { fetchStockezee } = require('../feed/sources/stockezee');
const { fetchNiftytrader } = require('../feed/sources/niftytrader');
const { fetchMoneycontrol } = require('../feed/sources/moneycontrol');
const { planNetBackfill } = require('../feed/net_backfill');
const feed = require('../feed/fetch_data');

(async () => {
    const dry = process.argv.includes('--dry');
    const primary = await fetchStockezee();
    if (primary.size < 100) throw new Error(`StockeZee returned only ${primary.size} sessions — refusing to proceed`);
    const checks = [];
    for (const f of [fetchNiftytrader, fetchMoneycontrol]) {
        try {
            const r = await f();
            checks.push(r instanceof Map ? r : new Map(r.map(x => [x.date, x])));
        } catch (e) { console.warn('check source unavailable:', e.message); }
    }
    const history = readJSON('history.json', [], true);
    const plan = planNetBackfill(history, primary, checks);
    const summary = (k) => `${plan[k].length}${plan[k].length ? ' (' + plan[k].slice(0, 6).join(', ') + (plan[k].length > 6 ? ', …' : '') + ')' : ''}`;
    console.log(`primary ${primary.size} sessions; checks: ${checks.map(c => c.size).join(', ')}`);
    console.log(`added ${summary('added')}\nconverted(estimated→net-only) ${summary('converted')}\nremoved(holiday fakes) ${summary('removed')}\nconflicts ${summary('conflicts')}\ndisagreements ${summary('disagreements')}`);
    if (dry) return;

    writeJSON('history.json', plan.rows);
    writeJSON('latest.json', plan.rows[0]);

    // Weekdays the primary archive omits inside its own range are exchange holidays
    const times = [...primary.keys()].map(d => +D.parse(d));
    const lo = new Date(Math.min(...times)), hi = new Date(Math.max(...times));
    const holidays = D.weekdaysBetween(new Date(+lo - D.DAY), hi).map(D.format).filter(d => !primary.has(d));
    writeJSON('market_holidays.json', { note: 'Weekdays with no session, derived from archives (absent from StockeZee within its range). Used only to silence gap reports.', range: [D.format(lo), D.format(hi)], dates: holidays });
    console.log(`holidays derived: ${holidays.length}`);

    const filled = await feed.backfillMissingFao(400);
    console.log(`F&O filled for ${filled.length} sessions`);
})().catch(e => { console.error(e.message); process.exit(1); });
