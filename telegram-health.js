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

// ── 4. Self-Test Watchdog ────────────────────────────────────────────────────
// Sends a silent getMe + validates config every N hours
// Call this from a cron schedule

async function runWatchdog(axios) {
    console.log('[WATCHDOG] Running Telegram health check…');
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const issues = [];

    // 1. Validate env
    const config = validateConfig();
    if (!config.ok) {
        issues.push(...config.errors);
    }

    // 2. Test bot connectivity
    if (token && axios) {
        try {
            await axios.get(`https://api.telegram.org/bot${token}/getMe`, { timeout: 5000 });
        } catch (e) {
            issues.push(`Bot connectivity failed: ${e.response?.data?.description || e.message}`);
        }

        // 3. Check for webhook/polling conflict
        try {
            const wh = await axios.get(`https://api.telegram.org/bot${token}/getWebhookInfo`, { timeout: 5000 });
            const info = wh.data.result;
            if (info.url) {
                issues.push(`Webhook still active (${info.url}) — polling is blocked!`);
                // Auto-heal: delete the webhook
                console.warn('[WATCHDOG] Auto-healing: deleting stale webhook…');
                await axios.post(`https://api.telegram.org/bot${token}/deleteWebhook`, { drop_pending_updates: false });
                console.log('[WATCHDOG] Webhook deleted ✓');
            }
            if (info.pending_update_count > 50) {
                issues.push(`${info.pending_update_count} pending updates — bot may be unresponsive`);
            }
            if (info.last_error_message) {
                issues.push(`Last webhook error: ${info.last_error_message}`);
            }
        } catch (e) {
            issues.push(`Webhook check failed: ${e.message}`);
        }
    }

    // 4. Check delivery health
    const log = loadDeliveryLog();
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const recent = log.filter(e => e.timestamp > cutoff24h);
    const failRate = recent.length > 0
        ? recent.filter(e => e.status === 'failed').length / recent.length
        : 0;
    if (failRate > 0.5 && recent.length >= 3) {
        issues.push(`High failure rate: ${(failRate * 100).toFixed(0)}% of ${recent.length} deliveries failed in last 24h`);
    }

    // 5. Check agent state freshness
    try {
        const { getState } = require('./agents/agent-utils');
        const regimeState = getState('regime-classifier');
        if (regimeState._updated_at) {
            const staleHours = (Date.now() - new Date(regimeState._updated_at).getTime()) / (1000 * 60 * 60);
            if (staleHours > 48) {
                issues.push(`Agent state stale: regime-classifier last updated ${Math.round(staleHours)}h ago`);
            }
        }
    } catch { /* ignore */ }

    // Report
    if (issues.length) {
        console.error('[WATCHDOG] ⚠️  Issues detected:');
        issues.forEach(i => console.error(`[WATCHDOG]   → ${i}`));
        trackDelivery({ status: 'watchdog', issues, action: 'alert' });
    } else {
        console.log('[WATCHDOG] ✅ All Telegram systems healthy');
        trackDelivery({ status: 'watchdog', issues: [], action: 'ok' });
    }

    return { ok: issues.length === 0, issues };
}

module.exports = {
    validateConfig,
    trackSuccess,
    trackFailure,
    trackDelivery,
    loadDeliveryLog,
    getHealthReport,
    runWatchdog,
    REQUIRED_ENV,
    RECOMMENDED_ENV
};
