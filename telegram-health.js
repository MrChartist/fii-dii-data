// ── Telegram Health Monitor — Self-healing watchdog for alert delivery ────────
// Prevents silent failures by validating config, tracking delivery, and self-testing
//
// Features:
// 1. Boot-time environment validation (fail-loud)
// 2. Persistent delivery log (data/telegram_delivery.json)  
// 3. Live health check endpoint data
// 4. Periodic self-test watchdog

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(process.cwd(), 'data');
const DELIVERY_LOG_PATH = path.join(DATA_DIR, 'telegram_delivery.json');
const MAX_DELIVERY_ENTRIES = 200;

// ── Required Environment Variables ───────────────────────────────────────────
const REQUIRED_ENV = {
    TELEGRAM_BOT_TOKEN: 'Bot authentication — get from @BotFather',
    TELEGRAM_CHANNEL_ID: 'Channel for broadcast alerts (e.g., @official_mrchartist)',
};

const RECOMMENDED_ENV = {
    TELEGRAM_CHAT_ID: 'Fallback chat target for agent-utils alerts (usually same as CHANNEL_ID)',
    TELEGRAM_BOT_USERNAME: 'Bot username for display/linking',
};

// ── 1. Boot Validator ────────────────────────────────────────────────────────
// Call this at server startup. Returns { ok, errors[], warnings[] }
function validateConfig() {
    const errors = [];
    const warnings = [];

    // Check required vars
    for (const [key, desc] of Object.entries(REQUIRED_ENV)) {
        if (!process.env[key]) {
            errors.push(`❌ Missing required: ${key} — ${desc}`);
        }
    }

    // Check recommended vars
    for (const [key, desc] of Object.entries(RECOMMENDED_ENV)) {
        if (!process.env[key]) {
            warnings.push(`⚠️  Missing recommended: ${key} — ${desc}`);
        }
    }

    // Cross-check: TELEGRAM_CHAT_ID should be set if CHANNEL_ID is set
    if (process.env.TELEGRAM_CHANNEL_ID && !process.env.TELEGRAM_CHAT_ID) {
        warnings.push('⚠️  TELEGRAM_CHAT_ID not set — agent-utils.sendTelegramAlert() will fallback to TELEGRAM_CHANNEL_ID');
    }

    // Validate token format (rough check: should be digits:alphanumeric)
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (token && !/^\d+:[A-Za-z0-9_-]+$/.test(token)) {
        errors.push('❌ TELEGRAM_BOT_TOKEN format looks invalid (expected: 123456:ABC-DEF...)');
    }

    // Check that telegram module loads
    try {
        require('./telegram');
    } catch (e) {
        errors.push(`❌ telegram.js module failed to load: ${e.message}`);
    }

    // Check that telegram-messages module loads
    try {
        require('./telegram-messages');
    } catch (e) {
        errors.push(`❌ telegram-messages.js module failed to load: ${e.message}`);
    }

    const ok = errors.length === 0;

    // Log results at boot
    if (!ok) {
        console.error('[TELEGRAM-HEALTH] ══════════════════════════════════════');
        console.error('[TELEGRAM-HEALTH] ❌ TELEGRAM CONFIG VALIDATION FAILED');
        errors.forEach(e => console.error(`[TELEGRAM-HEALTH]   ${e}`));
        console.error('[TELEGRAM-HEALTH] ══════════════════════════════════════');
    }
    if (warnings.length) {
        warnings.forEach(w => console.warn(`[TELEGRAM-HEALTH] ${w}`));
    }
    if (ok) {
        console.log('[TELEGRAM-HEALTH] ✅ All required Telegram config validated');
    }

    return { ok, errors, warnings };
}

// ── 2. Delivery Tracker ──────────────────────────────────────────────────────
// Persistent log of every Telegram send attempt

function loadDeliveryLog() {
    try {
        if (!fs.existsSync(DELIVERY_LOG_PATH)) return [];
        return JSON.parse(fs.readFileSync(DELIVERY_LOG_PATH, 'utf8'));
    } catch { return []; }
}

function saveDeliveryLog(log) {
    const tmp = DELIVERY_LOG_PATH + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(log.slice(0, MAX_DELIVERY_ENTRIES), null, 2), 'utf8');
    fs.renameSync(tmp, DELIVERY_LOG_PATH);
}

function trackDelivery(entry) {
    const log = loadDeliveryLog();
    log.unshift({
        timestamp: new Date().toISOString(),
        ...entry
    });
    saveDeliveryLog(log);
}

// Track a successful delivery
function trackSuccess(type, target, messagePreview) {
    trackDelivery({
        status: 'success',
        type,           // 'channel', 'subscriber', 'agent-alert'
        target,         // chat_id or channel_id
        preview: (messagePreview || '').substring(0, 100)
    });
}

// Track a failed delivery
function trackFailure(type, target, error, messagePreview) {
    trackDelivery({
        status: 'failed',
        type,
        target,
        error: String(error).substring(0, 200),
        preview: (messagePreview || '').substring(0, 100)
    });
}

// ── 3. Health Report Builder ─────────────────────────────────────────────────
// Returns comprehensive health data for the /api/telegram/health endpoint

async function getHealthReport(axios) {
    const report = {
        timestamp: new Date().toISOString(),
        config: { ok: true, issues: [] },
        bot: { ok: false, username: null, id: null },
        webhook: { ok: true, url: null, pending: 0 },
        delivery: { recent_total: 0, recent_success: 0, recent_failed: 0, last_success: null, last_failure: null },
        subscribers: { channel: null, individual: 0 },
        cron: { active: false }
    };

    const token = process.env.TELEGRAM_BOT_TOKEN;

    // Config check
    const configResult = validateConfig();
    report.config.ok = configResult.ok;
    report.config.issues = [...configResult.errors, ...configResult.warnings];

    // Bot identity check
    if (token && axios) {
        try {
            const me = await axios.get(`https://api.telegram.org/bot${token}/getMe`, { timeout: 5000 });
            report.bot = { ok: true, username: me.data.result.username, id: me.data.result.id };
        } catch (e) {
            report.bot = { ok: false, error: e.response?.data?.description || e.message };
        }

        // Webhook check
        try {
            const wh = await axios.get(`https://api.telegram.org/bot${token}/getWebhookInfo`, { timeout: 5000 });
            const info = wh.data.result;
            report.webhook = {
                ok: true,
                url: info.url || null,
                pending: info.pending_update_count || 0,
                last_error: info.last_error_message || null,
                last_error_date: info.last_error_date ? new Date(info.last_error_date * 1000).toISOString() : null
            };
            // Warn if webhook is set but we're in polling mode
            if (info.url) {
                report.webhook.warning = 'Webhook active — polling will NOT receive updates (409 conflict)';
            }
        } catch (e) {
            report.webhook = { ok: false, error: e.message };
        }
    }

    // Delivery stats (last 24 hours)
    const log = loadDeliveryLog();
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const recent = log.filter(e => e.timestamp > cutoff);
    report.delivery.recent_total = recent.length;
    report.delivery.recent_success = recent.filter(e => e.status === 'success').length;
    report.delivery.recent_failed = recent.filter(e => e.status === 'failed').length;
    const lastSuccess = log.find(e => e.status === 'success');
    const lastFailure = log.find(e => e.status === 'failed');
    report.delivery.last_success = lastSuccess ? lastSuccess.timestamp : null;
    report.delivery.last_failure = lastFailure ? { time: lastFailure.timestamp, error: lastFailure.error } : null;

    // Subscribers
    try {
        const telegram = require('./telegram');
        report.subscribers.individual = telegram.loadChatIds().length;
    } catch { /* ignore */ }
    report.subscribers.channel = process.env.TELEGRAM_CHANNEL_ID || null;

    // Overall verdict
    report.overall = report.config.ok && report.bot.ok ? 'healthy' : 'unhealthy';
    if (report.delivery.recent_failed > report.delivery.recent_success && report.delivery.recent_total > 0) {
        report.overall = 'degraded';
    }

    return report;
}

// ── 4. Admin Alert — Dead Man's Switch ───────────────────────────────────────
// Sends a critical alert directly to the admin when something goes wrong.
// Uses TELEGRAM_ADMIN_CHAT_ID (personal DM) or falls back to TELEGRAM_CHANNEL_ID.

async function sendAdminAlert(message, axios) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const adminId = process.env.TELEGRAM_ADMIN_CHAT_ID || process.env.TELEGRAM_CHANNEL_ID;
    if (!token || !adminId || !axios) {
        console.error('[WATCHDOG] Cannot send admin alert — missing token or admin chat ID');
        return false;
    }
    try {
        await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
            chat_id: adminId,
            text: message,
            parse_mode: 'HTML',
            disable_web_page_preview: true
        }, { timeout: 10000 });
        console.log(`[WATCHDOG] 🚨 Admin alert sent to ${adminId}`);
        trackDelivery({ status: 'success', type: 'admin-alert', target: adminId, preview: message.substring(0, 100) });
        return true;
    } catch (err) {
        console.error(`[WATCHDOG] Admin alert failed:`, err.response?.data?.description || err.message);
        trackDelivery({ status: 'failed', type: 'admin-alert', target: adminId, error: err.message, preview: message.substring(0, 100) });
        return false;
    }
}

// ── 5. Cron Heartbeat Tracker ────────────────────────────────────────────────
// Records when each cron job last fired, so the watchdog can detect missed runs.

const HEARTBEAT_PATH = path.join(DATA_DIR, 'cron_heartbeat.json');

function loadHeartbeat() {
    try {
        if (!fs.existsSync(HEARTBEAT_PATH)) return {};
        return JSON.parse(fs.readFileSync(HEARTBEAT_PATH, 'utf8'));
    } catch { return {}; }
}

function recordHeartbeat(cronName) {
    const hb = loadHeartbeat();
    hb[cronName] = {
        last_fired: new Date().toISOString(),
        count: (hb[cronName]?.count || 0) + 1
    };
    try {
        const tmp = HEARTBEAT_PATH + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(hb, null, 2), 'utf8');
        fs.renameSync(tmp, HEARTBEAT_PATH);
    } catch (e) {
        console.warn('[HEARTBEAT] Write failed:', e.message);
    }
}

// ── 6. Self-Test Watchdog — Enhanced with Dead Man's Switch ──────────────────
// Checks everything + sends admin alerts when problems are found.
// Call this from a cron schedule (every 6 hours).

async function runWatchdog(axios) {
    console.log('[WATCHDOG] ═══════════════════════════════════════════');
    console.log('[WATCHDOG] Running full health check…');
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const issues = [];        // 🟡 Warnings (logged but no alert)
    const critical = [];      // 🔴 Critical (triggers admin alert)

    // 1. Validate env
    const config = validateConfig();
    if (!config.ok) {
        critical.push(...config.errors);
    }

    // 2. Test bot connectivity
    if (token && axios) {
        try {
            await axios.get(`https://api.telegram.org/bot${token}/getMe`, { timeout: 5000 });
        } catch (e) {
            critical.push(`Bot connectivity failed: ${e.response?.data?.description || e.message}`);
        }

        // 3. Check for webhook/polling conflict
        try {
            const wh = await axios.get(`https://api.telegram.org/bot${token}/getWebhookInfo`, { timeout: 5000 });
            const info = wh.data.result;
            if (info.url) {
                issues.push(`Webhook still active (${info.url}) — auto-deleting…`);
                // Auto-heal: delete the webhook
                console.warn('[WATCHDOG] Auto-healing: deleting stale webhook…');
                await axios.post(`https://api.telegram.org/bot${token}/deleteWebhook`, { drop_pending_updates: false });
                console.log('[WATCHDOG] Webhook deleted ✓');
            }
            if (info.pending_update_count > 50) {
                critical.push(`${info.pending_update_count} pending updates — bot may be unresponsive`);
            }
            if (info.last_error_message) {
                issues.push(`Last webhook error: ${info.last_error_message}`);
            }
        } catch (e) {
            issues.push(`Webhook check failed: ${e.message}`);
        }
    } else {
        critical.push('Bot token or axios not available — Telegram is completely offline');
    }

    // 4. Check delivery health (last 24h)
    const log = loadDeliveryLog();
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const recent = log.filter(e => e.timestamp > cutoff24h);
    const recentFailed = recent.filter(e => e.status === 'failed');
    const failRate = recent.length > 0 ? recentFailed.length / recent.length : 0;
    if (failRate > 0.5 && recent.length >= 3) {
        critical.push(`High failure rate: ${(failRate * 100).toFixed(0)}% of ${recent.length} deliveries failed in last 24h`);
    }

    // 5. Check data fetch freshness (CRITICAL — the core pipeline)
    try {
        const { readJSON } = require('./agents/agent-utils');
        const fetchLog = readJSON('fetch-log.json', []);
        const lastUpdate = fetchLog.find(e => e.success && e.action === 'updated');
        if (lastUpdate) {
            const hoursStale = (Date.now() - new Date(lastUpdate.ts).getTime()) / (1000 * 60 * 60);
            // On weekdays, data should update daily. Allow 48h for weekends.
            if (hoursStale > 72) {
                critical.push(`No data update in ${Math.round(hoursStale)}h (last: ${lastUpdate.date || lastUpdate.ts})`);
            } else if (hoursStale > 48) {
                issues.push(`Data getting stale: last update ${Math.round(hoursStale)}h ago (${lastUpdate.date || 'unknown'})`);
            }
        } else {
            critical.push('No successful data fetch found in fetch-log.json');
        }

        // Check for consecutive fetch failures
        const recentFetches = fetchLog.slice(0, 10);
        const consecutiveFailures = recentFetches.findIndex(e => e.success);
        if (consecutiveFailures >= 5) {
            critical.push(`${consecutiveFailures} consecutive fetch failures — NSE API may be blocking us`);
        }
    } catch (e) {
        issues.push(`Fetch log check failed: ${e.message}`);
    }

    // 6. Check ALL agent states freshness
    try {
        const { getAllStates } = require('./agents/agent-utils');
        const states = getAllStates();
        const staleAgents = [];
        const STALE_THRESHOLD_HOURS = 72; // 3 days (allows for weekends)

        for (const [name, state] of Object.entries(states)) {
            if (state._updated_at) {
                const staleHours = (Date.now() - new Date(state._updated_at).getTime()) / (1000 * 60 * 60);
                if (staleHours > STALE_THRESHOLD_HOURS) {
                    staleAgents.push(`${name}: ${Math.round(staleHours)}h`);
                }
            }
        }
        if (staleAgents.length > 0) {
            critical.push(`Stale agents (>${STALE_THRESHOLD_HOURS}h): ${staleAgents.join(', ')}`);
        }
    } catch { /* ignore */ }

    // 7. Check cron heartbeat — did the scheduled jobs actually fire?
    try {
        const hb = loadHeartbeat();
        const now = Date.now();
        const expectedCrons = {
            'post-market-fetch': 24,    // Should fire daily on weekdays
            'nsdl-sector-fetch': 48,    // Daily but may skip weekends
            'morning-brief': 24         // Daily on weekdays
        };
        for (const [cronName, maxHours] of Object.entries(expectedCrons)) {
            if (hb[cronName]?.last_fired) {
                const hoursSince = (now - new Date(hb[cronName].last_fired).getTime()) / (1000 * 60 * 60);
                // Only flag on weekdays (skip Sat/Sun grace period)
                const dayOfWeek = new Date().getDay(); // 0=Sun, 6=Sat
                const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
                if (hoursSince > maxHours * 2 && isWeekday) {
                    critical.push(`Cron "${cronName}" hasn't fired in ${Math.round(hoursSince)}h`);
                }
            }
            // Don't flag missing heartbeats until the system has been running for a while
        }
    } catch { /* ignore */ }

    // ── Compile Report ──────────────────────────────────────────────────────
    const allIssues = [...critical, ...issues];

    if (critical.length > 0) {
        console.error('[WATCHDOG] 🔴 CRITICAL issues detected:');
        critical.forEach(i => console.error(`[WATCHDOG]   🔴 ${i}`));
    }
    if (issues.length > 0) {
        console.warn('[WATCHDOG] 🟡 Warnings:');
        issues.forEach(i => console.warn(`[WATCHDOG]   🟡 ${i}`));
    }
    if (allIssues.length === 0) {
        console.log('[WATCHDOG] ✅ All systems healthy');
    }

    // Log to delivery tracker
    trackDelivery({
        status: 'watchdog',
        critical: critical.length,
        warnings: issues.length,
        issues: allIssues,
        action: critical.length > 0 ? 'alert_sent' : allIssues.length > 0 ? 'warning' : 'ok'
    });

    // ── 🚨 DEAD MAN'S SWITCH — Send admin alert on CRITICAL issues ──────
    if (critical.length > 0 && axios) {
        const alertMsg = `🚨 <b>FII & DII DATA — ALERT</b>\n\n` +
            `<b>Critical issues detected by watchdog:</b>\n\n` +
            critical.map((c, i) => `${i + 1}. ${c}`).join('\n') +
            (issues.length > 0 ? `\n\n<b>Warnings:</b>\n${issues.map(w => `⚠️ ${w}`).join('\n')}` : '') +
            `\n\n⏰ ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}` +
            `\n🔗 Check: /api/telegram/health`;

        await sendAdminAlert(alertMsg, axios);
    }

    console.log('[WATCHDOG] ═══════════════════════════════════════════');
    return { ok: critical.length === 0, critical, warnings: issues, issues: allIssues };
}

module.exports = {
    validateConfig,
    trackSuccess,
    trackFailure,
    trackDelivery,
    loadDeliveryLog,
    getHealthReport,
    runWatchdog,
    sendAdminAlert,
    recordHeartbeat,
    loadHeartbeat,
    REQUIRED_ENV,
    RECOMMENDED_ENV
};
