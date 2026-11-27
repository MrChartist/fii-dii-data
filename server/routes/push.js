'use strict';
/** Web-push subscription management. */
const { ALL_ALERT_CATEGORIES, loadSubscriptions, saveSubscriptions } = require('../services/push');
module.exports = function mount(app) {
    // Push notification subscription (with categories)
    app.post('/api/subscribe', (req, res) => {
        try {
            const { subscription, categories } = req.body;
            // Support both new format { subscription, categories } and legacy format (flat sub object)
            const sub = subscription || req.body;
            if (!sub || !sub.endpoint) return res.status(400).json({ error: 'Invalid subscription' });
            const cats = Array.isArray(categories) ? categories.filter(c => ALL_ALERT_CATEGORIES.includes(c)) : [...ALL_ALERT_CATEGORIES];
            const subs = loadSubscriptions();
            const existingIdx = subs.findIndex(s => s.endpoint === sub.endpoint);
            if (existingIdx >= 0) {
                // Update categories for existing subscriber
                subs[existingIdx].categories = cats;
                saveSubscriptions(subs);
                console.log(`[PUSH] Updated subscriber categories: [${cats.join(', ')}]`);
            } else {
                subs.push({ endpoint: sub.endpoint, expirationTime: sub.expirationTime || null, keys: sub.keys, categories: cats });
                saveSubscriptions(subs);
                console.log(`[PUSH] New subscriber (total: ${subs.length}), categories: [${cats.join(', ')}]`);
            }
            res.json({ success: true, message: 'Subscribed to push notifications', categories: cats });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Update alert preferences for existing subscriber
    app.post('/api/subscribe-preferences', (req, res) => {
        try {
            const { endpoint, categories } = req.body;
            if (!endpoint) return res.status(400).json({ error: 'Missing endpoint' });
            if (!Array.isArray(categories)) return res.status(400).json({ error: 'Categories must be an array' });
            const cats = categories.filter(c => ALL_ALERT_CATEGORIES.includes(c));
            const subs = loadSubscriptions();
            const sub = subs.find(s => s.endpoint === endpoint);
            if (!sub) return res.status(404).json({ error: 'Subscription not found' });
            sub.categories = cats;
            saveSubscriptions(subs);
            console.log(`[PUSH] Updated preferences for subscriber: [${cats.join(', ')}]`);
            res.json({ success: true, categories: cats });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Get alert preferences for a subscriber
    app.post('/api/subscribe-status', (req, res) => {
        try {
            const { endpoint } = req.body;
            if (!endpoint) return res.status(400).json({ error: 'Missing endpoint' });
            const subs = loadSubscriptions();
            const sub = subs.find(s => s.endpoint === endpoint);
            if (!sub) return res.json({ subscribed: false, categories: [] });
            res.json({ subscribed: true, categories: sub.categories || [...ALL_ALERT_CATEGORIES] });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Push notification unsubscribe
    app.post('/api/unsubscribe', (req, res) => {
        try {
            const { endpoint } = req.body;
            if (!endpoint) return res.status(400).json({ error: 'Missing endpoint' });
            const subs = loadSubscriptions().filter(s => s.endpoint !== endpoint);
            saveSubscriptions(subs);
            res.json({ success: true, message: 'Unsubscribed' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
};
