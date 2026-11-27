'use strict';
/** One-time production .env setup (SETUP_KEY protected). */
const fs = require('fs');
const path = require('path');
module.exports = function mount(app) {
    // ── One-time .env Setup (secured by SETUP_KEY or Hostinger API token) ────────
    // POST /api/setup-env — writes .env file to production, then self-disables.
    // This endpoint works once per process start.
    let _envSetupUsed = false;
    app.post('/api/setup-env', (req, res) => {
        // Auth: require a setup key in the Authorization header
        // The key is provided in the request and must match a pre-shared secret
        const authHeader = req.headers.authorization || '';
        const setupKey = authHeader.replace('Bearer ', '');
        const EXPECTED_KEY = process.env.SETUP_KEY;

        // SETUP_KEY must be explicitly configured — there is no fallback key.
        // (Set it via the hosting panel / shell before calling this endpoint.)
        if (!EXPECTED_KEY) {
            return res.status(403).json({ error: 'Setup disabled — SETUP_KEY env var is not configured on the server' });
        }
        if (setupKey !== EXPECTED_KEY) {
            return res.status(401).json({ error: 'Unauthorized — invalid setup key' });
        }

        // Only allow if .env is missing critical vars or this is first use
        if (_envSetupUsed) {
            return res.status(403).json({ error: 'Setup already completed. Delete .env manually to re-run.' });
        }

        const envVars = req.body;
        if (!envVars || typeof envVars !== 'object' || Object.keys(envVars).length === 0) {
            return res.status(400).json({ error: 'Request body must be a JSON object of {KEY: VALUE} pairs' });
        }

        // Reject keys/values that could inject extra lines or malformed entries into .env
        const invalid = Object.entries(envVars).find(([k, v]) =>
            !/^[A-Z][A-Z0-9_]*$/i.test(k) || typeof v !== 'string' || /[\r\n]/.test(v)
        );
        if (invalid) {
            return res.status(400).json({ error: `Invalid env entry: ${invalid[0]} (keys must be alphanumeric/underscore, values single-line strings)` });
        }

        try {
            // Build .env content
            const envContent = Object.entries(envVars)
                .map(([k, v]) => `${k}=${v}`)
                .join('\n') + '\n';

            // Write to project root (may be overwritten by deploys)
            const envPath = path.join(__dirname, '..', '..', '.env');
            fs.writeFileSync(envPath, envContent, 'utf8');

            // Also write to parent directory (survives Hostinger auto-deploys)
            try {
                const persistPath = path.join(__dirname, '..', '..', '..', '.env.fii-dii');
                fs.writeFileSync(persistPath, envContent, 'utf8');
                console.log(`[SETUP] Persistent .env written to ${persistPath}`);
            } catch (e) {
                console.warn('[SETUP] Could not write persistent .env:', e.message);
            }

            _envSetupUsed = true;

            // Hot-reload the env vars into the running process
            Object.entries(envVars).forEach(([k, v]) => { process.env[k] = v; });

            console.log(`[SETUP] .env written with ${Object.keys(envVars).length} variables. Restart recommended.`);
            res.json({
                ok: true,
                message: `.env written with ${Object.keys(envVars).length} variables. Restart the server to apply all changes.`,
                keys_written: Object.keys(envVars),
                restart_required: true
            });
        } catch (err) {
            console.error('[SETUP] Failed to write .env:', err.message);
            res.status(500).json({ error: 'Failed to write .env: ' + err.message });
        }
    });
};
