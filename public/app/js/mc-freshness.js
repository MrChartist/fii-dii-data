/* mc-freshness: trading-calendar helpers used to tell visitors honestly how
   current the data is. Works in the browser (window.MCFresh) and in Node (tests).
   Exchange holidays are not modelled — callers allow a small tolerance instead. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MCFresh = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var DAY = 86400000, IST = 5.5 * 3600000;
  var M = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  var PUBLISH_HOUR_IST = 19; // NSE posts provisional FII/DII figures by ~7 PM IST

  /* "30-Sep-2026" → Date at UTC midnight of that calendar day (or null) */
  function parse(str) {
    var p = String(str || '').split('-');
    if (p.length !== 3 || M[p[1]] === undefined) return null;
    var d = new Date(Date.UTC(parseInt(p[2], 10), M[p[1]], parseInt(p[0], 10)));
    return isNaN(d) ? null : d;
  }
  function isWeekday(d) { var w = d.getUTCDay(); return w >= 1 && w <= 5; }

  /* The most recent session whose figures should be published by `now`.
     Returned as UTC midnight of the IST calendar date. */
  function lastExpectedSession(now) {
    var ist = new Date((now || new Date()).getTime() + IST);
    var day = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()));
    if (!(isWeekday(day) && ist.getUTCHours() >= PUBLISH_HOUR_IST)) {
      do { day = new Date(day.getTime() - DAY); } while (!isWeekday(day));
    }
    return day;
  }

  /* Weekdays after `from` up to and including `to` */
  function sessionsBetween(from, to) {
    var n = 0;
    for (var t = from.getTime() + DAY; t <= to.getTime(); t += DAY) if (isWeekday(new Date(t))) n++;
    return n;
  }

  /* status: 'fresh' (up to date), 'lagging' (1–2 sessions: a holiday or a late
     publish), 'stale' (3+ sessions behind: the feed has stopped). */
  function assess(latestDateStr, now) {
    var latest = parse(latestDateStr);
    if (!latest) return { status: 'unknown', behind: 0, latest: null, expected: null };
    var expected = lastExpectedSession(now);
    var behind = latest >= expected ? 0 : sessionsBetween(latest, expected);
    return { status: behind === 0 ? 'fresh' : behind <= 2 ? 'lagging' : 'stale', behind: behind, latest: latest, expected: expected };
  }

  /* Calendar days between two session date strings (a newer than b) */
  function daysApart(a, b) {
    var x = parse(a), y = parse(b);
    return x && y ? Math.round((x - y) / DAY) : 0;
  }
  /* More than a long weekend apart → sessions are missing in between */
  function isGap(newer, older) { return daysApart(newer, older) > 6; }

  return { parse: parse, lastExpectedSession: lastExpectedSession, sessionsBetween: sessionsBetween, assess: assess, daysApart: daysApart, isGap: isGap };
});
