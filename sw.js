/* IQ Bible App — service worker.
 *
 * Scope: the app shell only (HTML / CSS / JS / icons). It makes the app
 * installable and lets it open offline.
 *
 * It deliberately NEVER touches API traffic — any request to the IQ Bible
 * API (the same-origin `/api/` proxy path on the hosted instance, or
 * `api.iqbible.com` directly) is passed straight through to the network,
 * uncached. Every rate limit, error, and latency the API produces stays
 * fully visible in the app, per the project's GOLDEN RULE. Cross-origin
 * assets (fonts, unpkg, map tiles) are likewise left to the browser.
 *
 * Bump CACHE_VERSION on every deploy so clients pick up new shell assets.
 */
const CACHE_VERSION = "1.10.0";
const CACHE = `iqbible-shell-${CACHE_VERSION}`;

// Local development: serving from localhost/127.0.0.1 means every edit to a
// js/*.js, the CSS or CHANGELOG.md would otherwise be one reload stale
// (stale-while-revalidate below). Make the worker a pure pass-through there
// so `npx serve .` / Live Server behave like a plain static host.
const DEV = ["localhost", "127.0.0.1"].includes(self.location.hostname);

// Enough to boot the SPA offline; everything else same-origin (every js/*.js,
// img/*) is filled in on first visit by the runtime handler below, so there's
// no file list here to keep in sync.
const CORE = [
  "/",
  "/index.html",
  "/404.html",
  "/css/styles.css",
  "/manifest.webmanifest",
  "/img/logo.png",
  "/img/icon-192.png",
  "/img/icon-512.png",
  "/img/icon-maskable-512.png",
  "/img/apple-touch-icon.png",
];

self.addEventListener("install", e => {
  if (DEV) { self.skipWaiting(); return; }
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      // In dev, drop every shell cache so a worker left over from a prod
      // visit (or an earlier build) stops serving stale files immediately.
      .then(keys => Promise.all(keys.filter(k => DEV || k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  if (DEV) return; // pass-through: let the browser hit the dev server directly
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // Not ours to cache: other origins, and the API proxy path.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Navigations: network first, fall back to the cached shell so a deep link
  // still opens offline (the app's own no-connection states handle the rest).
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).catch(() => caches.match("/index.html"))
    );
    return;
  }

  // Static assets: stale-while-revalidate.
  e.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(req).then(cached => {
        const network = fetch(req).then(res => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        }).catch(() => cached);
        return cached || network;
      })
    )
  );
});
