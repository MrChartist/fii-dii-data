/* os27-deals: standalone renderer for /deals.html. Same endpoint as the dashboard panel (/api/large-deals). */
(function () {
  'use strict';
  var rows = [], filter = 'all', asOn = '';
  var $ = function (s) { return document.querySelector(s); };
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function inr(n) { return Number(n || 0).toLocaleString('en-IN'); }
  function render() {
    var list = rows.filter(function (r) { return filter === 'all' || r.type === filter; });
    var card = $('#large-deals-card'), empty = $('#deals-empty');
    if (!list.length) {
      card.hidden = true; empty.hidden = false;
      empty.textContent = rows.length ? 'No ' + filter.toLowerCase() + ' deals in the latest list.' : 'No large deals are available right now. NSE publishes them after the session, so please check again later.';
    } else {
      card.hidden = false; empty.hidden = true;
      $('#tbLargeDeals').innerHTML = list.map(function (d) {
        var buy = /b/i.test(d.side);
        return '<tr><td class="dt">' + esc(d.date || asOn || '\u2014') + '</td><td><span class="os-tag ' + (d.type === 'Block' ? 'block' : 'bulk') + '">' + d.type + '</span></td>' +
          '<td class="sym">' + esc(d.symbol) + '</td><td class="cli" title="' + esc(d.client) + '">' + esc(d.client) + '</td>' +
          '<td class="' + (buy ? 'pos' : 'neg') + '">' + (buy ? 'Buy' : 'Sell') + '</td>' +
          '<td class="num">' + inr(d.qty) + '</td><td class="num">&#8377;' + inr(d.price) + '</td></tr>';
      }).join('');
    }
    var b = rows.filter(function (r) { return r.type === 'Bulk'; }).length;
    $('#deals-summary').textContent = rows.length
      ? rows.length + ' large deals listed: ' + b + ' bulk and ' + (rows.length - b) + ' block, sorted by traded value.'
      : 'Large single-client trades on NSE. They show which stocks big players are buying or selling.';
  }
  document.getElementById('deals-filter').addEventListener('click', function (e) {
    var t = e.target.closest('.os-seg-btn'); if (!t) return;
    filter = t.getAttribute('data-deal');
    Array.prototype.forEach.call(this.children, function (c) { var on = c === t; c.classList.toggle('active', on); c.setAttribute('aria-pressed', String(on)); });
    render();
  });
  fetch('/api/large-deals').then(function (r) { return r.ok ? r.json() : null; }).then(function (data) {
    if (data) {
      rows = (data.bulk || []).map(function (d) { d.type = 'Bulk'; return d; })
        .concat((data.block || []).map(function (d) { d.type = 'Block'; return d; }))
        .filter(function (d) { return d.symbol; })
        .sort(function (a, b) { return (b.qty * b.price) - (a.qty * a.price); });
      asOn = data.as_on || '';
      var t = '';
      if (data.fetched_at) { try { t = ' \u00b7 updated ' + new Date(data.fetched_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) + ' IST'; } catch (e) {} }
      if (asOn) $('#ld-date').textContent = 'As on ' + asOn + t;
    }
    render();
  }).catch(function () { render(); });
})();
