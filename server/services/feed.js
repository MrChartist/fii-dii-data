'use strict';
/** Single entry to the data feed (scripts/feed). Routes and jobs import from here, never from scripts/ directly. */
const f = require('../../scripts/feed/fetch_data');
const n = require('../../scripts/feed/fetch_nsdl');
module.exports = {
    fetchAndProcessData: f.fetchAndProcessData,
    getLatestData: f.getLatestData,
    getHistoryData: f.getHistoryData,
    getFetchLogs: f.getFetchLogs,
    getSectorData: f.getSectorData,
    backfillMissingFao: f.backfillMissingFao,
    fetchAllNSDL: n.fetchAllNSDL
};
