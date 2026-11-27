'use strict';
/**
 * lib/dates.js — the ONLY place that parses/formats/compares dates.
 *
 * Canonical date format everywhere in data/*.json is the NSE one: "DD-Mon-YYYY"
 * (e.g. "20-Nov-2026"). All maths is done in UTC on calendar days, so results
 * never depend on the server's timezone (CI runs in UTC, the live server in IST).
 */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_IDX = Object.fromEntries(MONTHS.map((m, i) => [m, i]));
const NSE_DATE_RE = /^\d{2}-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{4}$/;
const DAY = 86400000;
const IST_OFFSET_MS = 5.5 * 3600000;

/** "20-Nov-2026" → Date at UTC midnight of that day, or null if invalid. */
function parse(str) {
    const p = String(str || '').split('-');
    if (p.length !== 3 || MONTH_IDX[p[1]] === undefined) return null;
    const d = new Date(Date.UTC(parseInt(p[2], 10), MONTH_IDX[p[1]], parseInt(p[0], 10)));
    return isNaN(d) ? null : d;
}

/** Date → "20-Nov-2026" using its UTC calendar day. */
function format(d) {
    return `${String(d.getUTCDate()).padStart(2, '0')}-${MONTHS[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
}

/** Comparator for sort(): a - b in ms. Unparseable dates compare equal (0). */
function compare(a, b) {
    const x = parse(a), y = parse(b);
    return x && y ? x - y : 0;
}

/** The calendar day in India right now, as a UTC-midnight Date. */
function istToday(now = new Date()) {
    const ist = new Date(now.getTime() + IST_OFFSET_MS);
    return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()));
}

/** Today in India as "YYYY-MM-DD" (dedupe keys, logs). */
function istDateKey(now = new Date()) {
    return istToday(now).toISOString().slice(0, 10);
}

function isWeekday(d) { const w = d.getUTCDay(); return w >= 1 && w <= 5; }

/** Mon–Fri days strictly after `from`, up to and including `to`. */
function weekdaysBetween(from, to) {
    const out = [];
    for (let t = from.getTime() + DAY; t <= to.getTime(); t += DAY) {
        const d = new Date(t);
        if (isWeekday(d)) out.push(d);
    }
    return out;
}

/**
 * Weekday sessions missing from `dates` (array of "DD-Mon-YYYY"), between the
 * oldest date supplied (or `since`) and `until`. Exchange holidays can't be
 * told apart from outages without a calendar, so callers treat the list as
 * "candidates to recover" and a failed recovery of a holiday is expected.
 */
function missingSessions(dates, { since, until = istToday() } = {}) {
    const have = new Set(dates.map(s => { const d = parse(s); return d && +d; }).filter(Boolean));
    const start = since || (dates.length ? dates.map(parse).filter(Boolean).sort((a, b) => a - b)[0] : null);
    if (!start) return [];
    return weekdaysBetween(new Date(+start - DAY), until).filter(d => !have.has(+d)).map(format);
}

module.exports = { MONTHS, NSE_DATE_RE, DAY, parse, format, compare, istToday, istDateKey, isWeekday, weekdaysBetween, missingSessions };
