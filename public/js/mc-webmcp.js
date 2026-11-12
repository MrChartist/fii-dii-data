/* mc-webmcp: exposes the dashboard to in-browser AI agents through WebMCP
   (navigator.modelContext). Tools read the data the page has already loaded and
   can move the visitor to a section; nothing here writes or submits anything.
   Does nothing in browsers without WebMCP. */
(function () {
  'use strict';
  var mc = (typeof navigator !== 'undefined' && navigator.modelContext) ||
           (typeof document !== 'undefined' && document.modelContext);
  if (!mc || typeof mc.registerTool !== 'function') return;

  var NOTE = 'Amounts are INR crore. Provisional NSE/NSDL data, for information only. Not investment advice.';
  var SECTIONS = { flows: 't-hero', fno: 't-fno', analytics: 't-matrix', sectors: 't-sector' };

  /* dailyData / SECTOR_DATA are top-level bindings of the dashboard script */
  function rows() {
    try { return (typeof dailyData !== 'undefined' && Array.isArray(dailyData)) ? dailyData.filter(function (r) { return r && r.d && r.d !== 'N/A'; }) : []; }
    catch (e) { return []; }
  }
  function sectors() {
    try { return (typeof SECTOR_DATA !== 'undefined' && Array.isArray(SECTOR_DATA)) ? SECTOR_DATA : []; }
    catch (e) { return []; }
  }
  function session(r) {
    return { date: r.d, fii_net_cr: r.fn, fii_buy_cr: r.fb, fii_sell_cr: r.fs, dii_net_cr: r.dn, dii_buy_cr: r.db, dii_sell_cr: r.ds, combined_net_cr: Math.round((r.fn + r.dn) * 100) / 100 };
  }
  function streak(list, key) {
    if (!list.length) return null;
    var dir = list[0][key] >= 0 ? 1 : -1, n = 0, sum = 0;
    for (var i = 0; i < list.length; i++) { if ((list[i][key] >= 0 ? 1 : -1) !== dir) break; n++; sum += list[i][key]; }
    return { direction: dir > 0 ? 'buying' : 'selling', sessions: n, cumulative_cr: Math.round(sum * 100) / 100 };
  }
  function ok(data) { return { content: [{ type: 'text', text: JSON.stringify(data) }], structuredContent: data }; }
  function fail(msg) { return { content: [{ type: 'text', text: msg }], isError: true }; }
  var EMPTY = 'The dashboard has not finished loading its data yet. Try again in a moment.';

  var tools = [
    {
      name: 'get_latest_flows',
      description: 'Latest FII/FPI and DII cash-market figures for Indian equities shown on this dashboard: net, gross buy and gross sell in INR crore for the most recent NSE session, plus each side\'s current buying or selling streak.',
      inputSchema: { type: 'object', properties: {} },
      execute: function () {
        var r = rows(); if (!r.length) return fail(EMPTY);
        var out = session(r[0]);
        out.fii_streak = streak(r, 'fn'); out.dii_streak = streak(r, 'dn'); out.note = NOTE;
        return ok(out);
      }
    },
    {
      name: 'get_recent_sessions',
      description: 'Daily FII and DII net/gross cash flows (INR crore) for the most recent trading sessions, newest first.',
      inputSchema: { type: 'object', properties: { days: { type: 'integer', minimum: 1, maximum: 60, description: 'Number of trading sessions to return (default 10).' } } },
      execute: function (args) {
        var r = rows(); if (!r.length) return fail(EMPTY);
        var n = Math.max(1, Math.min(60, parseInt(args && args.days, 10) || 10));
        return ok({ sessions: r.slice(0, n).map(session), note: NOTE });
      }
    },
    {
      name: 'get_fno_positioning',
      description: 'FII and DII open interest in derivatives (contracts): index futures, stock futures, index calls and index puts, long versus short, for the most recent session NSE has published.',
      inputSchema: { type: 'object', properties: {} },
      execute: function () {
        var r = rows(), f = null;
        for (var i = 0; i < r.length; i++) { if ((r[i].fii_idx_fut_long || 0) !== 0 || (r[i].fii_idx_fut_short || 0) !== 0) { f = r[i]; break; } }
        if (!f) return fail('No F&O positioning is available right now.');
        var pair = function (l, s) { return { long: l || 0, short: s || 0, net: (l || 0) - (s || 0) }; };
        return ok({
          date: f.d, latest_cash_session: r[0].d, is_latest_session: f.d === r[0].d,
          fii: { index_futures: pair(f.fii_idx_fut_long, f.fii_idx_fut_short), stock_futures: pair(f.fii_stk_fut_long, f.fii_stk_fut_short), index_calls: pair(f.fii_idx_call_long, f.fii_idx_call_short), index_puts: pair(f.fii_idx_put_long, f.fii_idx_put_short) },
          dii: { index_futures: pair(f.dii_idx_fut_long, f.dii_idx_fut_short), stock_futures: pair(f.dii_stk_fut_long, f.dii_stk_fut_short) },
          index_put_call_ratio: f.pcr || null, note: 'Open interest in contracts. ' + NOTE
        });
      }
    },
    {
      name: 'get_sector_flows',
      description: 'FPI sector rotation from the latest NSDL fortnightly report: sectors with the largest inflows and outflows (INR crore), one-year flow and share of FPI assets.',
      inputSchema: { type: 'object', properties: { limit: { type: 'integer', minimum: 1, maximum: 12, description: 'How many sectors to list on each side (default 5).' } } },
      execute: function (args) {
        var s = sectors().filter(function (x) { return x && x.name; }); if (!s.length) return fail('Sector data has not loaded yet.');
        var n = Math.max(1, Math.min(12, parseInt(args && args.limit, 10) || 5));
        var row = function (x) { return { sector: x.name, fortnight_net_cr: x.fortnightCr, one_year_net_cr: x.oneYearCr, share_of_fpi_assets_pct: x.aumPct }; };
        var by = s.slice().sort(function (a, b) { return b.fortnightCr - a.fortnightCr; });
        return ok({
          fortnight_ending: s[0].lastDate || null,
          top_inflows: by.filter(function (x) { return x.fortnightCr > 0; }).slice(0, n).map(row),
          top_outflows: by.filter(function (x) { return x.fortnightCr < 0; }).slice(-n).reverse().map(row),
          note: NOTE
        });
      }
    },
    {
      name: 'open_section',
      description: 'Show a section of the dashboard to the user: "flows" (today\'s FII/DII cash flows), "fno" (derivatives positioning), "analytics" (historical archive and charts) or "sectors" (FPI sector rotation).',
      inputSchema: { type: 'object', properties: { section: { type: 'string', enum: ['flows', 'fno', 'analytics', 'sectors'], description: 'Section to open.' } }, required: ['section'] },
      execute: function (args) {
        var id = SECTIONS[args && args.section];
        if (!id || typeof window.switchMainTab !== 'function') return fail('Unknown section. Use one of: flows, fno, analytics, sectors.');
        window.switchMainTab(id);
        return ok({ opened: args.section });
      }
    }
  ];

  var registered = [];
  tools.forEach(function (t) {
    try { mc.registerTool(t); registered.push(t.name); }
    catch (e) { /* already registered or API shape differs: skip this tool */ }
  });
  window.MC_WEBMCP_TOOLS = registered;
})();
