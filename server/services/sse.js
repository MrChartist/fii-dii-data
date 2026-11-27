'use strict';
/** Server-Sent Events fan-out — real-time "data-update" push to open dashboards. */
const sseClients = new Set();
function sseBroadcast(event, data) {
    const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of sseClients) {
        try { res.write(msg); } catch { sseClients.delete(res); }
    }
}

module.exports = { sseClients, sseBroadcast };
