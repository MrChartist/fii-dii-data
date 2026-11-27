'use strict';
/**
 * lib/store.js — the ONLY place that reads/writes data/*.json.
 * Writes are atomic (tmp file + rename). Use strict reads on any
 * read-modify-write path so a corrupt file is never overwritten with a stub.
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(process.cwd(), 'data');

/** strict=true: THROW on an unreadable file instead of returning the default. */
function readJSON(filename, defaultVal, strict = false) {
    const p = path.join(DATA_DIR, filename);
    if (!fs.existsSync(p)) return defaultVal;
    try {
        return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (err) {
        if (strict) throw new Error(`${filename} is unreadable (${err.message}) — refusing to overwrite it`);
        return defaultVal;
    }
}

function writeJSON(filename, data) {
    const p = path.join(DATA_DIR, filename);
    const tmp = p + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, p);
}

module.exports = { DATA_DIR, readJSON, writeJSON };
