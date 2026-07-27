/* Lead360 — Time Clock Service Worker
 *
 * Handles Web Push notifications for shift reminders, missed-shift alerts,
 * and dispute status updates delivered by the time-clock notifications worker.
 *
 * The push payload (JSON) is produced server-side; shape:
 *   { title, body, url?, tag?, icon?, badge? }
 *
 * This file is intentionally dependency-free and framework-agnostic so it can
 * be registered once at the app root and stay out of the Next.js build graph.
 */

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    if (event.data) {
      payload = event.data.json();
    }
  } catch (_err) {
    try {
      payload = { title: 'Lead360', body: event.data ? event.data.text() : '' };
    } catch (_inner) {
      payload = { title: 'Lead360', body: '' };
    }
  }

  const title = payload.title || 'Lead360';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/next.svg',
    badge: payload.badge || '/next.svg',
    tag: payload.tag || 'lead360-time-clock',
    data: { url: payload.url || '/workforce/clock' },
    renotify: Boolean(payload.renotify),
    requireInteraction: Boolean(payload.requireInteraction),
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl =
    (event.notification && event.notification.data && event.notification.data.url) ||
    '/workforce/clock';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          try {
            const clientUrl = new URL(client.url);
            if (clientUrl.pathname === targetUrl && 'focus' in client) {
              return client.focus();
            }
          } catch (_err) {
            /* ignore malformed URL */
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
        return undefined;
      }),
  );
});
