'use strict';
/** Environment + paths. Loaded first so every other module sees process.env. */
const path = require('path');
const ROOT = path.join(__dirname, '..');

require('dotenv').config({ path: path.join(ROOT, '.env') });
// Also load from the parent directory (survives Hostinger auto-deploys)
try { require('dotenv').config({ path: path.join(ROOT, '..', '.env.fii-dii'), override: false }); } catch {}

module.exports = {
    ROOT,
    PUBLIC_DIR: path.join(ROOT, 'public'),
    PORT: process.env.PORT || 3000
};
