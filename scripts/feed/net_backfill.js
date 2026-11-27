'use strict';
/**
 * Net-only backfill planner (pure — no I/O). Rules:
 *  1. A session exists only if the PRIMARY archive (StockeZee) lists it; a weekday it omits is a holiday.
 *  2. Any independent CHECK source (NiftyTrader, Moneycontrol) that lists the date must agree within `tol` Cr,
 *     otherwise the date is skipped and reported as a conflict.
 *  3. Real rows (NSE pipeline, live, Groww mirror, earlier archive rows) are never modified — a net
 *     disagreement is only reported.
 *  4. Estimated rows (`historical-seed`, `backfill-estimated`) are replaced by net-only rows; estimated rows on
 *     dates the primary does not list (holidays) are removed. Their invented gross/F&O numbers are discarded.
 *  5. Gross buy/sell is never guessed: null + `_partial`.
 */
const { parse, compare } = require('../../lib/dates');
const { netOnlyRow } = require('./row');

const ESTIMATED = new Set(['historical-seed', 'backfill-estimated']);

function planNetBackfill(history, primary, checks = [], { tol = 0.02 } = {}) {
    const byDate = new Map(history.map(r => [r.date, r]));
    const added = [], converted = [], removed = [], conflicts = [], disagreements = [];
    const agree = (a, b) => Math.abs(a.fii_net - b.fii_net) <= tol && Math.abs(a.dii_net - b.dii_net) <= tol;

    const times = [...primary.keys()].map(d => +parse(d)).filter(Boolean);
    const lo = Math.min(...times), hi = Math.max(...times);
    const next = new Map(byDate);

    for (const [date, net] of primary) {
        const covering = checks.map(c => c.get(date)).filter(Boolean);
        if (covering.some(c => !agree(net, c))) { conflicts.push(date); continue; }
        const existing = byDate.get(date);
        if (existing && !ESTIMATED.has(existing._source)) {
            if (!agree(net, existing)) disagreements.push(date);
            continue;
        }
        next.set(date, netOnlyRow(date, net, { crossChecked: covering.length > 0 }));
        (existing ? converted : added).push(date);
    }
    for (const r of history) {
        const t = +parse(r.date);
        if (ESTIMATED.has(r._source) && t >= lo && t <= hi && !primary.has(r.date)) { next.delete(r.date); removed.push(r.date); }
    }
    const rows = [...next.values()].sort((a, b) => compare(b.date, a.date));
    return { rows, added, converted, removed, conflicts, disagreements };
}

module.exports = { planNetBackfill, ESTIMATED };
