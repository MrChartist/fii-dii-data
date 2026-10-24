/* mc-deals: renderer for /deals.html. Same endpoint as the dashboard (/api/large-deals).
   Adds filters, search, sortable columns, deal value, summary tiles and incremental rendering on phones. */
(function () {
  'use strict';
  var rows = [], filter = 'all', query = '', asOn = '', shown = 0, PAGE = 60;
  var sort = { key: 'value', dir: 'desc' };
  var $ = function (s) { return document.querySelector(s); };
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function inr(n) { return Number(n || 0).toLocaleString('en-IN'); }
  function cr(n) { n = Number(n || 0) / 1e7; return '₹' + (n >= 100 ? Math.round(n).toLocaleString('en-IN') : n >= 10 ? n.toFixed(1) : n.toFixed(2)) + ' Cr'; }
  function isBuy(d) { return /b/i.test(d.side); }
  function dateKey(s) { var m = /(\d{1,2})-([A-Za-z]{3})-(\d{4})/.exec(String(s || '')); if (!m) return 0; var mon = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 }[m[2].toLowerCase()]; return Date.UTC(+m[3], mon || 0, +m[1]); }

  function visible() {
    var q = query.trim().toUpperCase();
    var list = rows.filter(function (r) { return (filter === 'all' || r.type === filter) && (!q || r.symbol.toUpperCase().indexOf(q) > -1 || String(r.client || '').toUpperCase().indexOf(q) > -1); });
    var k = sort.key, dir = sort.dir === 'asc' ? 1 : -1;
    list.sort(function (a, b) {
      var x = a[k], y = b[k];
      if (k === 'date') { x = dateKey(a.date); y = dateKey(b.date); }
      if (k === 'side') { x = isBuy(a) ? 1 : 0; y = isBuy(b) ? 1 : 0; }
      if (typeof x === 'string') return x.localeCompare(y) * dir;
      return ((x || 0) - (y || 0)) * dir;
    });
    return list;
  }
  function rowHtml(d) {
    var buy = isBuy(d);
    return '<tr><td class="dt">' + esc(d.date || asOn || '—') + '</td><td><span class="os-tag ' + (d.type === 'Block' ? 'block' : 'bulk') + '">' + d.type + '</span></td>' +
      '<td class="sym">' + esc(d.symbol) + '</td><td class="cli" title="' + esc(d.client) + '">' + esc(d.client) + '</td>' +
      '<td class="' + (buy ? 'pos' : 'neg') + '">' + (buy ? 'Buy' : 'Sell') + '</td>' +
      '<td class="num">' + inr(d.qty) + '</td><td class="num">₹' + inr(d.price) + '</td><td class="num">' + cr(d.value) + '</td></tr>';
  }
  function render() {
    var list = visible(), card = $('#large-deals-card'), empty = $('#deals-empty'), more = $('#deals-more');
    if (!list.length) {
      card.hidden = true; empty.hidden = false;
      empty.textContent = rows.length ? (query ? 'No deals match "' + query.trim() + '".' : 'No ' + filter.toLowerCase() + ' deals in the latest list.') : 'No large deals are available right now. NSE publishes them after the session, so please check again later.';
    } else {
      card.hidden = false; empty.hidden = true;
      var n = Math.min(list.length, shown || PAGE);
      $('#tbLargeDeals').innerHTML = list.slice(0, n).map(rowHtml).join('');
      more.hidden = n >= list.length;
      if (!more.hidden) $('#deals-more-btn').textContent = 'Show ' + Math.min(PAGE, list.length - n) + ' more of ' + list.length;
    }
    var th = document.querySelectorAll('.os-deals-table th.sortable');
    for (var i = 0; i < th.length; i++) { var on = th[i].getAttribute('data-sort') === sort.key; th[i].classList.toggle('sorted', on); th[i].classList.toggle('asc', on && sort.dir === 'asc'); th[i].setAttribute('aria-sort', on ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'); }
    var b = rows.filter(function (r) { return r.type === 'Bulk'; }).length;
    $('#deals-summary').textContent = rows.length
      ? rows.length + ' large deals on NSE: ' + b + ' bulk and ' + (rows.length - b) + ' block. Sorted by deal value unless you pick another column.'
      : 'Large single-client trades on NSE. They show which stocks big players are buying or selling.';
  }
  function summarise() {
    var box = $('#deals-kpis'); if (!rows.length) { box.hidden = true; return; }
    var bulk = 0, block = 0, buys = 0, sells = 0, total = 0, top = rows[0];
    rows.forEach(function (r) { if (r.type === 'Bulk') bulk++; else block++; if (isBuy(r)) buys++; else sells++; total += r.value; if (r.value > top.value) top = r; });
    $('#dk-count').textContent = rows.length; $('#dk-count-note').textContent = bulk + ' bulk · ' + block + ' block';
    $('#dk-value').textContent = cr(total);
    $('#dk-side').innerHTML = '<span class="pos">' + buys + '</span> <span style="color:var(--t4)">/</span> <span class="neg">' + sells + '</span>';
    $('#dk-top').textContent = top.symbol; $('#dk-top-note').textContent = cr(top.value) + ' · ' + (isBuy(top) ? 'bought' : 'sold') + ' by ' + (top.client || '').toLowerCase().replace(/\b\w/g, function (c) { return c.toUpperCase(); });
    box.hidden = false;
  }
  function counts() {
    var c = { all: rows.length, Bulk: 0, Block: 0 };
    rows.forEach(function (r) { c[r.type]++; });
    document.querySelectorAll('[data-count]').forEach(function (el) { el.textContent = c[el.getAttribute('data-count')] || 0; });
  }

  $('#deals-filter').addEventListener('click', function (e) {
    var t = e.target.closest('.os-seg-btn'); if (!t) return;
    filter = t.getAttribute('data-deal'); shown = 0;
    Array.prototype.forEach.call(this.children, function (c) { var on = c === t; c.classList.toggle('active', on); c.setAttribute('aria-pressed', String(on)); });
    render();
  });
  var sT = null;
  $('#deals-search').addEventListener('input', function () { clearTimeout(sT); var v = this.value; sT = setTimeout(function () { query = v; shown = 0; render(); }, 120); });
  $('#deals-more-btn').addEventListener('click', function () { shown = (shown || PAGE) + PAGE; render(); });
  document.querySelector('.os-deals-table thead').addEventListener('click', function (e) {
    var th = e.target.closest('th.sortable'); if (!th) return;
    var k = th.getAttribute('data-sort');
    if (sort.key === k) sort.dir = sort.dir === 'asc' ? 'desc' : 'asc';
    else { sort.key = k; sort.dir = (k === 'symbol' || k === 'client' || k === 'type') ? 'asc' : 'desc'; }
    shown = 0; render();
  });

  fetch('/api/large-deals').then(function (r) { return r.ok ? r.json() : null; }).then(function (data) {
    if (data) {
      rows = (data.bulk || []).map(function (d) { d.type = 'Bulk'; return d; })
        .concat((data.block || []).map(function (d) { d.type = 'Block'; return d; }))
        .filter(function (d) { return d.symbol; })
        .map(function (d) { d.qty = Number(d.qty || 0); d.price = Number(d.price || 0); d.value = d.qty * d.price; d.symbol = String(d.symbol); return d; });
      asOn = data.as_on || '';
      var t = '';
      if (data.fetched_at) { try { t = ' · updated ' + new Date(data.fetched_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) + ' IST'; } catch (e) {} }
      var chip = $('#ld-date'); if (asOn) { chip.textContent = 'As on ' + asOn + t; chip.hidden = false; }
    }
    counts(); summarise(); render();
  }).catch(function () { counts(); render(); });
})();
