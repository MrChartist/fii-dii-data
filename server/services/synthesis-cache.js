'use strict';
/** AI synthesis cache (24h TTL; cleared whenever a new session lands). */
const SYNTH_TTL = 24 * 60 * 60 * 1000;
let cache = { text: null, ts: 0 };
module.exports = {
    SYNTH_TTL,
    get: () => cache,
    set: (text) => { cache = { text, ts: Date.now() }; },
    clear: () => { cache = { text: null, ts: 0 }; }
};
