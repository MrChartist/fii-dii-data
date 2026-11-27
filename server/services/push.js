'use strict';
/** Web Push: subscriptions (data/subscriptions.json) and category-filtered broadcast. */
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('../../lib/store');

let webpush;
try {
    webpush = require('web-push');
    const VAPID_PUBLIC  = 'BDM4u63dFxAAA68MTP3W4mTxV3MZk7unyFQufGv6j3DhCFqf7T5lsp85zvQSSqX2sVrcLsrMhRvyiTZhS8BnsJw';
    const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
    if (!VAPID_PRIVATE) { console.warn('[BOOT] VAPID_PRIVATE_KEY not set — push notifications disabled'); webpush = null; }
    else { webpush.setVapidDetails('mailto:rohit@mrchartist.com', VAPID_PUBLIC, VAPID_PRIVATE); console.log('[BOOT] web-push loaded ✓'); }
} catch (e) {
    console.warn('[BOOT] web-push not available:', e.message);
}

const SUBS_PATH = path.join(DATA_DIR, 'subscriptions.json');
const ALL_ALERT_CATEGORIES = ['cash', 'fao', 'sectors'];

function loadSubscriptions() {
    try {
        if (!fs.existsSync(SUBS_PATH)) return [];
        const subs = JSON.parse(fs.readFileSync(SUBS_PATH, 'utf8'));
        // Auto-migrate: existing entries without categories get all categories
        let migrated = false;
        subs.forEach(sub => {
            if (!sub.categories || !Array.isArray(sub.categories)) {
                sub.categories = [...ALL_ALERT_CATEGORIES];
                migrated = true;
            }
        });
        if (migrated) saveSubscriptions(subs);
        return subs;
    } catch { return []; }
}

function saveSubscriptions(subs) {
    const tmp = SUBS_PATH + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(subs, null, 2), 'utf8');
    fs.renameSync(tmp, SUBS_PATH);
}

async function broadcastNotification(payload, category = 'cash') {
    if (!webpush) return;
    const subs = loadSubscriptions();
    // Filter to only subscribers who opted into this category
    const targets = subs.filter(s => s.categories && s.categories.includes(category));
    if (!targets.length) return;
    console.log(`[PUSH] Broadcasting '${category}' to ${targets.length}/${subs.length} subscriber(s)…`);
    const dead = [];
    const body = JSON.stringify({ ...payload, category });
    await Promise.allSettled(targets.map(async (sub) => {
        try {
            const pushSub = { endpoint: sub.endpoint, keys: sub.keys, expirationTime: sub.expirationTime || null };
            await webpush.sendNotification(pushSub, body);
        } catch (err) {
            if (err.statusCode === 404 || err.statusCode === 410) dead.push(sub.endpoint);
            else console.warn('[PUSH] Send error:', err.statusCode || err.message);
        }
    }));
    if (dead.length) {
        // Re-load before writing: subscribers may have been added/updated while
        // the push fan-out was in flight, and writing the stale snapshot would drop them.
        const fresh = loadSubscriptions();
        const cleaned = fresh.filter(s => !dead.includes(s.endpoint));
        saveSubscriptions(cleaned);
        console.log(`[PUSH] Cleaned ${dead.length} expired subscription(s)`);
    }
}

module.exports = { ALL_ALERT_CATEGORIES, loadSubscriptions, saveSubscriptions, broadcastNotification };
