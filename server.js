'use strict';
/** Entry point. Structure lives in server/ — see CLAUDE.md "Module map". */
process.on('uncaughtException', (err) => console.error('[FATAL] Uncaught Exception:', err.message, err.stack));
process.on('unhandledRejection', (reason) => console.error('[FATAL] Unhandled Rejection:', reason));

console.log('[BOOT] Starting server…');
const { PORT } = require('./server/config');   // loads .env first
const { createApp } = require('./server/app');

const app = createApp();
// Listen first, schedule after: a scheduler failure must never take the site down
app.listen(PORT, '0.0.0.0', () => {
    console.log(`[BOOT] ✅ Server running on port ${PORT}`);
    try { require('./server/jobs/scheduler').start(); }
    catch (e) { console.error('[BOOT] Cron scheduling failed:', e.message); }
});

module.exports = app;
