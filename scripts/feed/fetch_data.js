const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ── Configuration ───────────────────────────────────────────────────────────
const CONFIG = {
    NSE_HOME: "https://www.nseindia.com/",
    NSE_API: "https://www.nseindia.com/api/fiidiiTradeReact",
    FAO_BASE: "https://nsearchives.nseindia.com/content/nsccl",
    // NSE blocks many cloud IPs by hanging, so fail fast: a blocked run used to burn
    // ~2.5 min on 25s x 3 timeouts and then lose the session for good.
    TIMEOUTS: { cash: 12000, fao: 15000, live: 20000 },
    RETRY: { attempts: 2, baseDelayMs: 2000 },
    // Optional fallback: our own live server (not IP-blocked by NSE). Set both as
    // repo secrets/env: LIVE_FEED_URL=https://fii-diidata.mrchartist.com  LIVE_FEED_KEY=<one of API_KEYS>
    LIVE_URL: (process.env.LIVE_FEED_URL || '').replace(/\/+$/, ''),
    LIVE_KEY: process.env.LIVE_FEED_KEY || '',
    HISTORY_MAX: 800,
    DATA_DIR: path.join(process.cwd(), 'data'),
};

const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Referer": "https://www.nseindia.com/reports-indices-fii-dii-trading-activity"
};

let nseCookies = "";

// ── JSON Storage (replaces SQLite) ──────────────────────────────────────────

const { readJSON, writeJSON } = require('../../lib/store');
const { NSE_DATE_RE, compare: compareDates } = require('../../lib/dates');

// "14,967.82" → 14967.82 (parseFloat alone would stop at the comma and store 14)
function num(v) {
    const n = parseFloat(String(v ?? '').replace(/,/g, ''));
    return Number.isFinite(n) ? n : NaN;
}

// ── JSON Accessors (replaces SQLite API) ──────────────────────────────────
function getLatestData() {
    const history = readJSON('history.json', []);
    if (!history.length) return null;
    return [...history].sort((a, b) => compareDates(b.date, a.date))[0];
}

function getHistoryData(limit = 100) {
    const history = readJSON('history.json', []);
    return [...history].sort((a, b) => compareDates(b.date, a.date)).slice(0, limit);
}

function getFetchLogs(limit = 5) {
    const logs = readJSON('fetch-log.json', []);
    return [...logs].sort((a, b) => new Date(b.ts) - new Date(a.ts)).slice(0, limit);
}

function getSectorData() {
    return readJSON('sectors.json', []);
}

// ── Log fetch ──────────────────────────────────────────────────────────────
function logFetch(entry) {
    try {
        const logs = readJSON('fetch-log.json', []);
        logs.unshift({ ts: new Date().toISOString(), ...entry });
        writeJSON('fetch-log.json', logs.slice(0, 100)); // keep last 100 entries
    } catch (err) {
        console.error("  ❌ Failed to log fetch:", err.message);
    }
}

// ── Retry helper ─────────────────────────────────────────────────────────────
async function withRetry(fn, label) {
    let lastError;
    for (let attempt = 1; attempt <= CONFIG.RETRY.attempts; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;
            // A 404 means "not published" — retrying only burns time
            if (err.response && err.response.status === 404) break;
            if (attempt < CONFIG.RETRY.attempts) {
                const delay = CONFIG.RETRY.baseDelayMs * attempt;
                console.warn(`  ⚠️  ${label} failed (attempt ${attempt}/${CONFIG.RETRY.attempts}): ${err.message}. Retrying in ${delay}ms…`);
                await new Promise(r => setTimeout(r, delay));
            }
        }
    }
    throw lastError;
}

// ── NSE Session Management ───────────────────────────────────────────────────
async function refreshNSESession() {
    try {
        const response = await axios.get(CONFIG.NSE_HOME, { headers: HEADERS, timeout: 10000 });
        const cookies = response.headers['set-cookie'];
        if (cookies) {
            nseCookies = cookies.map(c => c.split(';')[0]).join('; ');
            return true;
        }
    } catch (err) {
        console.error("  ❌ Failed to refresh NSE session:", err.message);
    }
    return false;
}

// ── Fetch cash data from NSE API ─────────────────────────────────────────────
async function fetchNSE() {
    if (!nseCookies) await refreshNSESession();

    return withRetry(async () => {
        try {
            const response = await axios.get(CONFIG.NSE_API, { 
                headers: { ...HEADERS, Cookie: nseCookies }, 
                timeout: CONFIG.TIMEOUTS.cash 
            });
            const data = response.data;
            if (Array.isArray(data) && data.length > 0) return data;
            // 200 with a non-array body is NSE's block page — get a new session
            await refreshNSESession();
        } catch (err) {
            console.warn(`  ⚠️ Direct NSE fetch failed: ${err.message}. Trying proxy...`);
            // Cookies may have gone stale — refresh so the next retry gets a clean session
            await refreshNSESession();
        }

        // Fallback to proxy
        const safeUrl = `${CONFIG.NSE_API}?t=${Date.now()}`;
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(safeUrl)}`;
        const pRes = await axios.get(proxyUrl, { timeout: CONFIG.TIMEOUTS.cash });
        let parsed = null;
        try { parsed = pRes.data && pRes.data.contents ? JSON.parse(pRes.data.contents) : null; }
        catch { throw new Error("NSE proxy returned a non-JSON body"); }
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;

        throw new Error("NSE API & Proxy both returned empty or non-array response");
    }, "NSE cash API");
}

// ── Fetch F&O OI CSV ─────────────────────────────────────────────────────────
async function fetchFaoOi(dateStr) {
    const MONTHS = { Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12' };
    const parts = dateStr.split('-');
    if (parts.length !== 3) return null;

    const day   = parts[0].padStart(2, '0');
    const month = MONTHS[parts[1]];
    const year  = parts[2];
    if (!month) return null;

    const datePart = `${day}${month}${year}`;
    const urls = [
        `${CONFIG.FAO_BASE}/fao_participant_oi_${datePart}.csv`,
        `${CONFIG.FAO_BASE}/fao_participant_oi_${datePart}_b.csv`,
    ];

    for (const url of urls) {
        try {
            const response = await withRetry(
                () => axios.get(url, { headers: { ...HEADERS, Cookie: nseCookies }, timeout: CONFIG.TIMEOUTS.fao }),
                `F&O CSV (${url})`
            );
            // Only accept a body that actually parses — an HTML error page
            // served with 200 must not end the search
            if (typeof response.data === 'string' && parseFao(response.data).FII) return response.data;
        } catch { /* Try next */ }
    }
    return null;
}

// ── Parse F&O CSV ─────────────────────────────────────────────────────────────
// Parses by header name — NSE's column order groups all Long columns before
// Short ("...Call Long, Put Long, Call Short, Put Short"), so positional
// indexing silently swaps Put Long ↔ Call Short.
function parseFao(csvText) {
    const faoData = {};
    if (!csvText) return faoData;

    try {
        // NSE prefixes the file with a title row whose doubled quotes
        // (""Participant wise Open Interest ... as on Jun 11, 2026"") are not
        // valid CSV, so a strict parser rejects the whole file. Skip everything
        // before the real header row and split the plain numeric rows by hand.
        const lines = String(csvText).replace(/^\uFEFF/, '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        const headerIdx = lines.findIndex(l => /^"?\s*client\s*type/i.test(l));
        if (headerIdx < 0) return faoData;

        const cells = (line) => line.split(',').map(c => c.replace(/^"+|"+$/g, '').trim());
        const norm = (h) => h.toLowerCase().replace(/\s+/g, ' ').trim();
        const header = cells(lines[headerIdx]).map(norm);
        const col = (name) => header.indexOf(norm(name));
        const COLS = {
            idx_fut_long: col('Future Index Long'),     idx_fut_short: col('Future Index Short'),
            stk_fut_long: col('Future Stock Long'),     stk_fut_short: col('Future Stock Short'),
            idx_call_long: col('Option Index Call Long'), idx_call_short: col('Option Index Call Short'),
            idx_put_long: col('Option Index Put Long'),   idx_put_short: col('Option Index Put Short'),
        };
        // A renamed/missing column must fail loudly rather than store zeros
        const missing = Object.entries(COLS).filter(([, i]) => i < 0).map(([k]) => k);
        if (missing.length) {
            console.error(`Error parsing F&O CSV: missing column(s) ${missing.join(', ')}`);
            return faoData;
        }

        const getInt = (val) => {
            const n = parseInt(String(val ?? '').replace(/,/g, ''), 10);
            return isNaN(n) ? 0 : n;
        };

        for (const line of lines.slice(headerIdx + 1)) {
            const row = cells(line);
            const clientType = (row[0] || '').toUpperCase();
            const key = /\bFII\b|\bFPI\b/.test(clientType) ? 'FII' : /\bDII\b/.test(clientType) ? 'DII' : null;
            if (!key) continue;
            faoData[key] = {};
            for (const [field, i] of Object.entries(COLS)) faoData[key][field] = getInt(row[i]);
        }
    } catch (e) {
        console.error("Error parsing F&O CSV:", e.message);
    }
    return faoData;
}

// ── Validate data ────────────────────────────────────────────────────────────
function validateData(data) {
    if (!data || !NSE_DATE_RE.test(data.date || '')) return false;
    const fields = ['fii_buy','fii_sell','fii_net','dii_buy','dii_sell','dii_net'];
    if (!fields.every(f => Number.isFinite(data[f]))) return false;
    // Both participants must have traded, and net must reconcile with buy − sell
    if (!(data.fii_buy > 0 && data.fii_sell > 0 && data.dii_buy > 0 && data.dii_sell > 0)) return false;
    if (Math.abs(data.fii_buy - data.fii_sell - data.fii_net) > 1) return false;
    if (Math.abs(data.dii_buy - data.dii_sell - data.dii_net) > 1) return false;
    return true;
}

// True when a row actually carries F&O participant-OI data
function rowHasFao(row) {
    return !!row && ((row.fii_idx_fut_long || 0) !== 0 || (row.fii_idx_fut_short || 0) !== 0);
}

// F&O summary used in notification payloads
function buildFaoSummary(d) {
    return {
        sentiment: d.sentiment_score > 60 ? 'Bullish' : d.sentiment_score < 40 ? 'Bearish' : 'Neutral',
        pcr: d.pcr,
        fii_fut_net: d.fii_idx_fut_net,
        fii_call_net: d.fii_idx_call_net,
        fii_put_net: d.fii_idx_put_net
    };
}

// Apply parsed F&O data onto a row (recomputes nets, PCR, sentiment).
// Returns true if FII F&O data was applied. Does NOT touch cash fields.
function applyFao(out, fao) {
    let applied = false;
    if (fao && fao["FII"]) {
        const f = fao["FII"];
        out.fii_idx_fut_long = f.idx_fut_long; out.fii_idx_fut_short = f.idx_fut_short; out.fii_idx_fut_net = f.idx_fut_long - f.idx_fut_short;
        out.fii_stk_fut_long = f.stk_fut_long; out.fii_stk_fut_short = f.stk_fut_short; out.fii_stk_fut_net = f.stk_fut_long - f.stk_fut_short;
        out.fii_idx_call_long = f.idx_call_long; out.fii_idx_call_short = f.idx_call_short; out.fii_idx_call_net = f.idx_call_long - f.idx_call_short;
        out.fii_idx_put_long = f.idx_put_long; out.fii_idx_put_short = f.idx_put_short; out.fii_idx_put_net = f.idx_put_long - f.idx_put_short;

        out.pcr = f.idx_call_short > 0 ? parseFloat((f.idx_put_short / f.idx_call_short).toFixed(2)) : 1.0;

        let sentiment = 50;
        // Clamp each factor to ±15 to prevent single-factor domination
        sentiment += Math.max(-15, Math.min(15, (out.fii_net || 0) / 500));
        sentiment += Math.max(-15, Math.min(15, out.fii_idx_fut_net / 10000));
        if (out.pcr > 1.3) sentiment -= 8;
        else if (out.pcr > 1.1) sentiment -= 4;
        if (out.pcr < 0.7) sentiment += 8;
        else if (out.pcr < 0.9) sentiment += 4;
        out.sentiment_score = Math.min(100, Math.max(5, parseFloat(sentiment.toFixed(1))));
        applied = true;
    }
    if (fao && fao["DII"]) {
        const d = fao["DII"];
        out.dii_idx_fut_long = d.idx_fut_long; out.dii_idx_fut_short = d.idx_fut_short; out.dii_idx_fut_net = d.idx_fut_long - d.idx_fut_short;
        out.dii_stk_fut_long = d.stk_fut_long; out.dii_stk_fut_short = d.stk_fut_short; out.dii_stk_fut_net = d.stk_fut_long - d.stk_fut_short;
        applied = true;
    }
    return applied;
}

// NSE publishes the participant-OI (F&O) file LATER than cash — sometimes after
// the evening fetch window closes. On each run, retry F&O for the most recent
// cash-only rows and merge it in without disturbing the cash figures. Cheap when
// nothing is missing (rows that already have F&O make no HTTP calls).
// Returns the list of dates that were filled.
async function backfillMissingFao(maxAttempts = 25) {
    const history = readJSON('history.json', [], true);
    if (!history.length) return [];
    // Newest first. Every cash-only row is a candidate (older gaps used to be
    // skipped forever because only the 4 latest rows were tried); attempts per
    // run are capped so a blocked NSE session does not turn into a hammering loop.
    const recent = [...history].sort((a, b) => compareDates(b.date, a.date));
    const filled = [];
    let attempts = 0, misses = 0;
    if (!nseCookies) await refreshNSESession();
    for (const row of recent) {
        if (!['fetch-pipeline', 'live-fetch'].includes(row._source) || rowHasFao(row)) continue;
        if (attempts++ >= maxAttempts) break;
        // Several misses in a row means NSE is blocking us (or the files are
        // gone) — stop instead of grinding through every remaining date
        if (misses >= 4) break;
        let csv = null;
        try { csv = await fetchFaoOi(row.date); } catch { /* not published yet */ }
        if (!csv) { misses++; if (misses === 1) await refreshNSESession(); continue; }
        misses = 0;
        const fao = parseFao(csv);
        if (applyFao(row, fao) && rowHasFao(row)) {
            row._fao_summary = buildFaoSummary(row);
            row._fao_backfilled_at = new Date().toISOString();
            filled.push(row.date);
        }
    }
    if (filled.length) {
        writeJSON('history.json', history);
        const latest = readJSON('latest.json', null);
        if (latest && filled.includes(latest.date)) {
            const updated = history.find(r => r.date === latest.date);
            if (updated) writeJSON('latest.json', updated);
        }
        console.log(`[F&O BACKFILL] Filled F&O for: ${filled.join(', ')}`);
    }
    return filled;
}

// ── Transform data ───────────────────────────────────────────────────────────
async function transformData(rawCash, rawFaoCsv) {
    const out = {
        date: "",
        fii_buy: 0, fii_sell: 0, fii_net: 0,
        dii_buy: 0, dii_sell: 0, dii_net: 0,
        fii_idx_fut_long: 0, fii_idx_fut_short: 0, fii_idx_fut_net: 0,
        dii_idx_fut_long: 0, dii_idx_fut_short: 0, dii_idx_fut_net: 0,
        fii_stk_fut_long: 0, fii_stk_fut_short: 0, fii_stk_fut_net: 0,
        dii_stk_fut_long: 0, dii_stk_fut_short: 0, dii_stk_fut_net: 0,
        fii_idx_call_long: 0, fii_idx_call_short: 0, fii_idx_call_net: 0,
        fii_idx_put_long: 0, fii_idx_put_short: 0, fii_idx_put_net: 0,
        pcr: 0,
        sentiment_score: 50,
    };

    let fiiDate = "", diiDate = "";
    for (const row of rawCash) {
        const cat = (row.category || "").toUpperCase();
        if (cat.includes("FII") || cat.includes("FPI")) {
            out.fii_buy = num(row.buyValue);
            out.fii_sell = num(row.sellValue);
            out.fii_net = num(row.netValue);
            fiiDate = row.date || "";
        } else if (cat.includes("DII")) {
            out.dii_buy = num(row.buyValue);
            out.dii_sell = num(row.sellValue);
            out.dii_net = num(row.netValue);
            diiDate = row.date || "";
        }
    }
    // NSE occasionally publishes one participant before the other; never
    // stitch two different sessions into one row
    if (!fiiDate || !diiDate || fiiDate !== diiDate) {
        throw new Error(`NSE response incomplete (FII date "${fiiDate}", DII date "${diiDate}")`);
    }
    out.date = fiiDate;

    if (out.date && rawFaoCsv) {
        applyFao(out, parseFao(rawFaoCsv));
    }

    out._updated_at = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: 'medium', timeStyle: 'short' }) + " IST";
    out._source = "fetch-pipeline";
    return out;
}

// ── Save to JSON history & Sitemap ───────────────────────────────────────────
function updateSitemap() {
    try {
        const sitemapPath = path.join(process.cwd(), 'public', 'sitemap.xml');
        if (fs.existsSync(sitemapPath)) {
            let content = fs.readFileSync(sitemapPath, 'utf8');
            const today = new Date().toISOString().split('T')[0];
            const next = content.replace(/<lastmod>.*?<\/lastmod>/g, `<lastmod>${today}</lastmod>`);
            if (next === content) return;
            const tmp = sitemapPath + '.tmp';
            fs.writeFileSync(tmp, next, 'utf8');
            fs.renameSync(tmp, sitemapPath);
        }
    } catch (err) {
        console.error("  ❌ Failed to update sitemap:", err.message);
    }
}

function saveToHistory(data) {
    const history = readJSON('history.json', [], true);
    const existingIdx = history.findIndex(r => r.date === data.date);
    if (existingIdx >= 0) {
        history[existingIdx] = data;
    } else {
        history.unshift(data);
    }
    // Sort descending and keep max entries
    history.sort((a, b) => compareDates(b.date, a.date));
    writeJSON('history.json', history.slice(0, CONFIG.HISTORY_MAX));
}

// ── Fallback: recover sessions from our own live server ──────────────────────
// The NSE cash API only ever returns the LATEST session, so a blocked run loses
// that day permanently. The live server keeps fetching from an unblocked IP and
// serves its last 60 sessions; merge any validated session we do not have yet.
// Rows already in the archive are never overwritten. Returns the dates added.
async function recoverFromLiveServer() {
    if (!CONFIG.LIVE_URL || !CONFIG.LIVE_KEY) return [];
    let rows;
    try {
        const res = await axios.get(`${CONFIG.LIVE_URL}/api/history`, {
            headers: { 'x-api-key': CONFIG.LIVE_KEY }, timeout: CONFIG.TIMEOUTS.live
        });
        rows = res.data;
    } catch (err) {
        console.warn(`  ⚠️ Live-server fallback unavailable: ${err.message}`);
        return [];
    }
    if (!Array.isArray(rows)) return [];
    const history = readJSON('history.json', [], true);
    const have = new Set(history.map(r => r.date));
    const added = [];
    for (const r of rows) {
        if (!validateData(r) || have.has(r.date)) continue;
        if (!['fetch-pipeline', 'live-fetch'].includes(r._source)) r._source = 'live-fetch';
        history.push(r); have.add(r.date); added.push(r.date);
    }
    if (added.length) {
        history.sort((a, b) => compareDates(b.date, a.date));
        writeJSON('history.json', history.slice(0, CONFIG.HISTORY_MAX));
        writeJSON('latest.json', history[0]);
        console.log(`[LIVE FALLBACK] Recovered sessions: ${added.join(', ')}`);
    }
    return added;
}

// ── Pipeline ─────────────────────────────────────────────────────────────────
async function fetchAndProcessData() {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] Pipeline started…`);

    try {
        let rawCash;
        try {
            rawCash = await fetchNSE();
        } catch (nseErr) {
            // NSE blocked/unreachable → try our live server before giving up
            const recovered = await recoverFromLiveServer();
            if (recovered.length) {
                logFetch({ success: true, date: recovered[0], action: "recovered-live", count: recovered.length });
                return { date: recovered[0], _recovered: recovered };
            }
            throw nseErr;
        }
        let targetDate = (rawCash.find(r => /FII|FPI|DII/i.test(r.category)) || {}).date;
        if (!targetDate) {
            console.log("ℹ️ No target date found in NSE response.");
            logFetch({ success: true, action: "idle", reason: "no_data_date" });
            return null;
        }

        // Recover F&O for any recent cash-only rows (NSE publishes it late).
        // Cheap no-op when nothing is missing.
        let filledNow = [];
        try { filledNow = await backfillMissingFao(); } catch (e) { console.warn("  ⚠️ F&O backfill skipped:", e.message); }

        // Smart skip: check if we already have this exact data.
        // Only trust rows the real pipeline wrote — seeded/estimated rows
        // (_source: 'historical-seed' / 'backfill-estimated') must be replaced
        // by real data, never re-published to latest.json.
        const history = readJSON('history.json', []);
        const existing = history.find(r => r.date === targetDate && r._source === 'fetch-pipeline');
        const hasFaoData = rowHasFao(existing);
        if (existing && existing.fii_net !== 0 && hasFaoData) {
            writeJSON('latest.json', existing);
            // If F&O *just* arrived via backfill, surface it (non-skipped) so the
            // F&O notification fires once. Otherwise it's old news → skip.
            if (filledNow.includes(targetDate)) {
                console.log(`⚡ F&O just recovered for ${targetDate} — surfacing for notification.`);
                logFetch({ success: true, date: targetDate, action: "fao-recovered" });
                return existing;
            }
            console.log(`ℹ️ Data for ${targetDate} already exists (cash+F&O). Skipping store.`);
            logFetch({ success: true, date: targetDate, action: "skipped" });
            return { ...existing, _skipped: true };
        }
        if (existing && existing.fii_net !== 0 && !hasFaoData) {
            console.log(`⚡ Data for ${targetDate} has cash but missing F&O. Re-fetching F&O...`);
        }

        const rawFaoCsv = await fetchFaoOi(targetDate);
        const data = await transformData(rawCash, rawFaoCsv);

        if (!validateData(data)) throw new Error(`Validation failed for ${data.date}`);

        // Nothing new: same cash figures and F&O still unpublished. Without
        // this every scheduled run rewrote the row (new _updated_at), bumped
        // the sitemap and produced a no-op "data update" commit.
        const CASH = ['fii_buy', 'fii_sell', 'fii_net', 'dii_buy', 'dii_sell', 'dii_net'];
        if (existing && !rowHasFao(data) && CASH.every(k => existing[k] === data[k])) {
            console.log(`ℹ️ ${targetDate}: cash unchanged, F&O not published yet. Skipping store.`);
            logFetch({ success: true, date: targetDate, action: "skipped", reason: "fao_pending" });
            return { ...existing, _skipped: true };
        }
        const isNewDate = !history.some(r => r.date === data.date);

        // Enrich with F&O summary for notification payloads (only when F&O is real)
        if (rowHasFao(data)) data._fao_summary = buildFaoSummary(data);

        saveToHistory(data);
        writeJSON('latest.json', data);
        if (isNewDate) updateSitemap();

        console.log(`✅ Updated: ${data.date} (FII Net: ${data.fii_net})`);
        logFetch({ success: true, date: data.date, action: "updated" });
        return data;

    } catch (err) {
        console.error("❌ Pipeline error:", err.message);
        logFetch({ success: false, error: err.message });
        throw err;
    }
}

if (require.main === module) {
    fetchAndProcessData().catch(() => process.exit(1));
}

module.exports = { recoverFromLiveServer, validateData, fetchAndProcessData, getLatestData, getHistoryData, getSectorData, getFetchLogs, backfillMissingFao, rowHasFao, parseFao, applyFao };
