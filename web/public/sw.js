/* Bandit — minimal service worker.
 * Purpose: satisfy Chrome's PWA installability criteria so the browser shows
 * the "install" button in the URL bar. Network-only strategy — no offline
 * caching for now (the dashboard is auth-gated and benefits little from it).
 *
 * To add offline later: use Workbox or hand-roll a cache-first strategy here.
 */

self.addEventListener("install", (event) => {
  // Take over immediately on first install.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Network-only — pass everything straight through.
  // Chrome only needs a registered fetch handler; the strategy can be trivial.
  event.respondWith(fetch(event.request));
});
