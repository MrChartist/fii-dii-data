/*
 * Mr. Chartist — Service Worker
 * Purpose: Enables PWA installability (Chrome/Safari "Add to Home Screen" prompt).
 * Strategy: Network-first with lightweight cache fallback for static assets.
 * The dashboard is inherently a live-data app, so we prioritize fresh network responses.
 */

const CACHE_NAME = 'mrchartist-v9';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Install: Pre-cache the shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: Clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: Network-first strategy
self.addEventListener('fetch', event => {
  // Skip non-GET requests and API calls (always fresh)
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('/api/')) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Clone and cache successful responses
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// ── Push Notification: Show OS-level notification when server broadcasts ─────
self.addEventListener('push', event => {
  let data = { title: '📊 FII/DII Data Updated', body: 'New institutional flow data is available.', url: '/', category: 'cash' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (e) {
    console.warn('[SW] Failed to parse push data:', e);
  }

  // Category-specific notification tags & actions
  const categoryConfig = {
    cash: {
      tag: 'fii-dii-cash',
      actions: [
        { action: 'open', title: 'View Cash Flows' },
        { action: 'dismiss', title: 'Dismiss' }
      ]
    },
    fao: {
      tag: 'fii-dii-fao',
      actions: [
        { action: 'open', title: 'View F&O Tab' },
        { action: 'dismiss', title: 'Dismiss' }
      ]
    },
    sectors: {
      tag: 'fii-dii-sectors',
      actions: [
        { action: 'open', title: 'View Sectors' },
        { action: 'dismiss', title: 'Dismiss' }
      ]
    }
  };

  const config = categoryConfig[data.category] || categoryConfig.cash;

  const options = {
    body: data.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [100, 50, 100],
    data: { url: data.url || '/', category: data.category || 'cash' },
    actions: config.actions,
    tag: config.tag,
    renotify: true
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// ── Notification Click: Open/focus the dashboard ─────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      // If a tab is already open, focus it
      for (const client of windowClients) {
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new tab
      return clients.openWindow(urlToOpen);
    })
  );
});
