'use strict';
/** HTML delivery: dynamic OG description on "/", then static files with caching rules. Must mount BEFORE other static handlers. */
const express = require('express');
const fs = require('fs');
const path = require('path');
const { PUBLIC_DIR } = require('../config');
const { getLatestData } = require('../services/feed');

module.exports = function mount(app) {
    // Dynamic Root Route for OG Tags (MUST be before express.static)
    app.get('/', (req, res, next) => {
        // If it's explicitly not a GET for root, pass it
        if (req.path !== '/') return next();

        try {
            const indexPath = path.join(PUBLIC_DIR, 'index.html');
            let html = fs.readFileSync(indexPath, 'utf8');

            // Dynamically build the social sharing description
            const { getState } = require('../../agents/agent-utils');
            const latest = getLatestData();
            const regimeState = getState('regime-classifier');
            const streakState = getState('fii-streak');

            let dynamicDesc = "Live FII/DII flow tracker.";
            if (latest && regimeState && streakState) {
                const fmtCr = val => ((val || 0) >= 0 ? '+' : '-') + '₹' + Math.abs(val || 0).toLocaleString('en-IN') + ' Cr';
                const fiiVal = fmtCr(latest.fii_net);
                const regime = regimeState.regime ? regimeState.regime.replace(/_/g, ' ') : 'NEUTRAL';
            
                let streakStr = "";
                if (streakState.current_sell_streak > 0) streakStr = ` | ${streakState.current_sell_streak}-Day FII Sell Streak 🔴`;
                else if (streakState.current_buy_streak > 0) streakStr = ` | ${streakState.current_buy_streak}-Day FII Buy Streak 🟢`;

                dynamicDesc = `Market Update: FII Net ${fiiVal} | Regime: ${regime}${streakStr}. Track live institutional money flow, F&O positioning, and sector data.`;
            
                // Limit length for meta tags just in case
                if (dynamicDesc.length > 200) dynamicDesc = dynamicDesc.substring(0, 197) + '...';
            }

            // Inject into HTML
            html = html.replace(
                /<meta property="og:description" content="[^"]+">/,
                `<meta property="og:description" content="${dynamicDesc}">`
            );
            html = html.replace(
                /<meta name="twitter:description" content="[^"]+">/,
                `<meta name="twitter:description" content="${dynamicDesc}">`
            );

            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate'); // Stale-while-revalidate strategy
            res.send(html);
        } catch (err) {
            console.error('[SERVER] Dynamic index rendering failed:', err);
            return next(); // Fallback to express.static passing serving error
        }
    });

    // Static files (production caching strategy)
    app.use(express.static(path.join(PUBLIC_DIR), {
        maxAge: '1d',           // Cache static assets for 1 day
        etag: true,             // Enable ETag for conditional requests
        setHeaders: (res, filePath) => {
            // Never cache SW or manifest (must always be fresh for PWA updates)
            if (filePath.endsWith('sw.js') || filePath.endsWith('manifest.json')) {
                res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            }
            // HTML should revalidate on every request (stale-while-revalidate)
            if (filePath.endsWith('.html')) {
                res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
            }
        }
    }));
};
