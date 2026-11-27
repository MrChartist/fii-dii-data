'use strict';
/** Shape of one session row (data/history.json item). Single definition used by every feed path. */

const istStamp = () => new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) + ' IST';

/** Row with every numeric field present (F&O zeros until participant OI is published). */
function emptyRow() {
    const z = {};
    for (const side of ['fii', 'dii']) for (const k of ['buy', 'sell', 'net']) z[`${side}_${k}`] = 0;
    for (const side of ['fii', 'dii']) for (const k of ['idx_fut', 'stk_fut']) for (const t of ['long', 'short', 'net']) z[`${side}_${k}_${t}`] = 0;
    for (const k of ['idx_call', 'idx_put']) for (const t of ['long', 'short', 'net']) z[`fii_${k}_${t}`] = 0;
    return { date: '', ...z, pcr: 0, sentiment_score: 50 };
}

/**
 * Net-only row: the session's net flows are known (published by archives) but gross buy/sell
 * is not, so those four legs are null — never a guess. `_partial` lets UI/tests treat it honestly.
 */
function netOnlyRow(date, { fii_net, dii_net }, { crossChecked = false } = {}) {
    return {
        ...emptyRow(), date,
        fii_buy: null, fii_sell: null, dii_buy: null, dii_sell: null,
        fii_net, dii_net,
        _updated_at: istStamp(), _source: 'archive-net', _partial: true, _cross_checked: crossChecked
    };
}

const GROSS = ['fii_buy', 'fii_sell', 'dii_buy', 'dii_sell'];
const isPartial = (r) => !!r && r._partial === true;

module.exports = { istStamp, emptyRow, netOnlyRow, isPartial, GROSS };
