'use strict';
/** Express app factory: middleware → agent-ready → pages/static → API routes. Order is significant. */
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const { apiGuard, corsOptions } = require('../api-guard');
const feed = require('./services/feed');

function createApp() {
    const app = express();
    app.use(compression({ threshold: 1024 }));
    app.set('trust proxy', 1);
    app.use(cors(corsOptions()));
    app.use(express.json());

    app.use((req, res, next) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'SAMEORIGIN');
        res.setHeader('X-XSS-Protection', '1; mode=block');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
        next();
    });

    app.use(apiGuard);

    // Markdown homepage, Link headers, MCP server + server card (before "/" and static)
    require('../agent-ready').mount(app, { getHistoryData: (n) => feed.getHistoryData(n), getSectorData: () => feed.getSectorData() });

    require('./routes/pages')(app);
    for (const r of ['admin', 'data', 'push', 'system', 'market', 'agents']) require(`./routes/${r}`)(app);
    return app;
}

module.exports = { createApp };
