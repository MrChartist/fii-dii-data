const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

// ── Configuration ───────────────────────────────────────────────────────────
const CONFIG = {
    NSE_HOME: "https://www.nseindia.com/",
    NSE_API: "https://www.nseindia.com/api/fiidiiTradeReact",
    FAO_BASE: "https://nsearchives.nseindia.com/content/nsccl",
    TIMEOUTS: { cash: 25000, fao: 15000 },
    RETRY: { attempts: 3, baseDelayMs: 2000 },
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

function readJSON(filename, defaultVal) {
    try {
        const p = path.join(CONFIG.DATA_DIR, filename);
        if (!fs.existsSync(p)) return defaultVal;
        return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch {
        return defaultVal;
    }
}

function writeJSON(filename, data) {
    const p = path.join(CONFIG.DATA_DIR, filename);
    const tmp = p + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, p);
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

function compareDates(a, b) {
    const M = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
    const p1 = (a || '').split('-');
    const p2 = (b || '').split('-');
    if (p1.length !== 3 || p2.length !== 3) return 0;
    const d1 = new Date(parseInt(p1[2]), M[p1[1]] ?? 0, parseInt(p1[0]));
    const d2 = new Date(parseInt(p2[2]), M[p2[1]] ?? 0, parseInt(p2[0]));
    return d1 - d2;
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
        } catch (err) {
            console.warn(`  ⚠️ Direct NSE fetch failed: ${err.message}. Trying proxy...`);
        }

        // Fallback to proxy
        const safeUrl = `${CONFIG.NSE_API}?t=${Date.now()}`;
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(safeUrl)}`;
        const pRes = await axios.get(proxyUrl, { timeout: CONFIG.TIMEOUTS.cash });
        const parsed = pRes.data && pRes.data.contents ? JSON.parse(pRes.data.contents) : null;
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
        `${CONFIG.FAO_BASE}/fao_participant_oi_${datePart}_b.csv`,
        `${CONFIG.FAO_BASE}/fao_participant_oi_${datePart}.csv`,
    ];

    for (const url of urls) {
        try {
            const response = await withRetry(
                () => axios.get(url, { headers: { ...HEADERS, Cookie: nseCookies }, timeout: CONFIG.TIMEOUTS.fao }),
                `F&O CSV (${url})`
            );
            if (response.data && response.data.length > 0) return response.data;
        } catch { /* Try next */ }
    }
    return null;
}

// ── Parse F&O CSV ─────────────────────────────────────────────────────────────
function parseFao(csvText) {
    const faoData = {};
    if (!csvText) return faoData;

    try {
        const lines = csvText.trim().split('\n');
        if (lines.length < 2) return faoData;

        const records = parse(lines.slice(1).join('\n'), {
            skip_empty_lines: true,
            relax_column_count: true
        });

        const getInt = (val) => {
            if (!val) return 0;
            const n = parseInt(String(val).trim().replace(/,/g, ''), 10);
            return isNaN(n) ? 0 : n;
        };

        for (let i = 0; i < records.length; i++) {
            const row = records[i];
            if (!row || row.length < 9) continue;

            const clientType = (row[0] || "").trim().toUpperCase();
            if (!clientType.includes("FII") && !clientType.includes("DII")) continue;

            const key = clientType.includes("FII") ? "FII" : "DII";
            faoData[key] = {
                idx_fut_long:   getInt(row[1]),
                idx_fut_short:  getInt(row[2]),
                stk_fut_long:   getInt(row[3]),
                stk_fut_short:  getInt(row[4]),
                idx_call_long:  getInt(row[5]),
                idx_call_short: getInt(row[6]),
                idx_put_long:   getInt(row[7]),
                idx_put_short:  getInt(row[8]),
            };
        }
    } catch (e) {
        console.error("Error parsing F&O CSV:", e.message);
    }
    return faoData;
}

// ── Validate data ────────────────────────────────────────────────────────────
function validateData(data) {
    if (!data.date) return false;
    const fields = ['fii_buy','fii_sell','fii_net','dii_buy','dii_sell','dii_net'];
    return fields.every(f => isFinite(data[f]));
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

    for (const row of rawCash) {
        const cat = (row.category || "").toUpperCase();
        if (cat.includes("FII") || cat.includes("FPI")) {
            out.fii_buy = parseFloat(row.buyValue || 0);
            out.fii_sell = parseFloat(row.sellValue || 0);
            out.fii_net = parseFloat(row.netValue || 0);
            out.date = row.date || "";
        } else if (cat.includes("DII")) {
            out.dii_buy = parseFloat(row.buyValue || 0);
            out.dii_sell = parseFloat(row.sellValue || 0);
            out.dii_net = parseFloat(row.netValue || 0);
        }
    }

    if (out.date && rawFaoCsv) {
        const fao = parseFao(rawFaoCsv);
        if (fao["FII"]) {
            const f = fao["FII"];
            out.fii_idx_fut_long = f.idx_fut_long; out.fii_idx_fut_short = f.idx_fut_short; out.fii_idx_fut_net = f.idx_fut_long - f.idx_fut_short;
            out.fii_stk_fut_long = f.stk_fut_long; out.fii_stk_fut_short = f.stk_fut_short; out.fii_stk_fut_net = f.stk_fut_long - f.stk_fut_short;
            out.fii_idx_call_long = f.idx_call_long; out.fii_idx_call_short = f.idx_call_short; out.fii_idx_call_net = f.idx_call_long - f.idx_call_short;
            out.fii_idx_put_long = f.idx_put_long; out.fii_idx_put_short = f.idx_put_short; out.fii_idx_put_net = f.idx_put_long - f.idx_put_short;
            
            if (f.idx_call_short > 0) {
                out.pcr = parseFloat((f.idx_put_short / f.idx_call_short).toFixed(2));
            } else {
                out.pcr = 1.0;
            }

            let sentiment = 50;
            // Clamp each factor to ±15 to prevent single-factor domination
            sentiment += Math.max(-15, Math.min(15, out.fii_net / 500));
            sentiment += Math.max(-15, Math.min(15, out.fii_idx_fut_net / 10000));
            if (out.pcr > 1.3) sentiment -= 8;
            else if (out.pcr > 1.1) sentiment -= 4;
            if (out.pcr < 0.7) sentiment += 8;
            else if (out.pcr < 0.9) sentiment += 4;
            out.sentiment_score = Math.min(100, Math.max(5, parseFloat(sentiment.toFixed(1))));
        }
        if (fao["DII"]) {
            const d = fao["DII"];
            out.dii_idx_fut_long = d.idx_fut_long; out.dii_idx_fut_short = d.idx_fut_short; out.dii_idx_fut_net = d.idx_fut_long - d.idx_fut_short;
            out.dii_stk_fut_long = d.stk_fut_long; out.dii_stk_fut_short = d.stk_fut_short; out.dii_stk_fut_net = d.stk_fut_long - d.stk_fut_short;
        }
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
            content = content.replace(/<lastmod>.*?<\/lastmod>/, `<lastmod>${today}</lastmod>`);
            fs.writeFileSync(sitemapPath, content, 'utf8');
        }
    } catch (err) {
        console.error("  ❌ Failed to update sitemap:", err.message);
    }
}

function saveToHistory(data) {
    const history = readJSON('history.json', []);
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

// ── Pipeline ─────────────────────────────────────────────────────────────────
async function fetchAndProcessData() {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] Pipeline started…`);

    try {
        const rawCash = await fetchNSE();
        let targetDate = (rawCash.find(r => /FII|FPI|DII/i.test(r.category)) || {}).date;
        if (!targetDate) {
            console.log("ℹ️ No target date found in NSE response.");
            logFetch({ success: true, action: "idle", reason: "no_data_date" });
            return null;
        }

        // Smart skip: check if we already have this exact data
        const history = readJSON('history.json', []);
        const existing = history.find(r => r.date === targetDate);
        const hasFaoData = existing && (existing.fii_idx_fut_long > 0 || existing.fii_idx_fut_short > 0);
        if (existing && existing.fii_net !== 0 && hasFaoData) {
            console.log(`ℹ️ Data for ${targetDate} already exists (cash+F&O). Skipping store.`);
            logFetch({ success: true, date: targetDate, action: "skipped" });
            writeJSON('latest.json', existing);
            return { ...existing, _skipped: true };
        }
        if (existing && existing.fii_net !== 0 && !hasFaoData) {
            console.log(`⚡ Data for ${targetDate} has cash but missing F&O. Re-fetching F&O...`);
        }

        const rawFaoCsv = await fetchFaoOi(targetDate);
        const data = await transformData(rawCash, rawFaoCsv);

        if (!validateData(data)) throw new Error(`Validation failed for ${data.date}`);

        // Enrich with F&O summary for notification payloads
        data._fao_summary = {
            sentiment: data.sentiment_score > 60 ? 'Bullish' : data.sentiment_score < 40 ? 'Bearish' : 'Neutral',
            pcr: data.pcr,
            fii_fut_net: data.fii_idx_fut_net,
            fii_call_net: data.fii_idx_call_net,
            fii_put_net: data.fii_idx_put_net
        };

        saveToHistory(data);
        writeJSON('latest.json', data);
        updateSitemap();

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

module.exports = { fetchAndProcessData, getLatestData, getHistoryData, getSectorData, getFetchLogs };
