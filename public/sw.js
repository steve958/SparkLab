// SparkLab service worker.
//
// Cache strategy:
//   * Navigation requests (HTML pages) → NETWORK-FIRST. Each page
//     load pulls the current build's HTML so its references to
//     _next/static/<hash>/... point at the chunks the server
//     actually has. Falls back to cache only when the network is
//     unreachable (offline). Without this, after a deploy users
//     would get a stale HTML pointing at chunk hashes that no longer
//     exist on the server, the JS would 404, and the page would
//     render blank until a manual hard-refresh.
//   * /data/* JSON → network-first (content updates without
//     waiting for a new SW).
//   * Everything else (Next.js hashed chunks, images, fonts) →
//     cache-first. Hashes change per build, so cache hits are
//     always for content that hasn't been re-deployed under a new
//     URL — there's no staleness risk for hashed assets.
//
// Bump CACHE_NAME any time this file changes so the activate handler
// wipes the prior cache and we start clean.

const CACHE_NAME = "sparklab-v6";
const OFFLINE_FALLBACK_PATH = "/";
// Minimal pre-cache — just the offline shell. The previous version
// pre-cached every route's HTML, but with network-first navigation
// that's no longer useful and risks holding stale entries.
const STATIC_ASSETS = ["/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  // Activate the new SW immediately rather than waiting for the next
  // page load — paired with clients.claim() below this means an
  // updated SW takes over running tabs without a manual refresh.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

// Lets the page nudge a freshly-installed-but-waiting SW to take
// over without forcing the user to close and reopen the tab.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  // Only handle GETs — POST / PUT / etc. should never be cached.
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // Don't intercept cross-origin requests (analytics, fonts CDN, etc.)
  if (url.origin !== self.location.origin) return;

  // Navigation requests — always try network first so the HTML
  // response references the current build's hashed chunks. Cache
  // the result so an offline reload still gets us a working shell.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(req, copy))
              .catch(() => {});
          }
          return res;
        })
        .catch(() =>
          caches
            .match(req)
            .then((cached) => cached || caches.match(OFFLINE_FALLBACK_PATH))
        )
    );
    return;
  }

  // Content JSON — network-first so authored chemistry updates land
  // without waiting for a new SW version to be deployed.
  if (url.pathname.startsWith("/data/")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(req, copy))
              .catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Everything else — cache-first. Next.js hashes static chunks, so
  // a cache hit is always immutable content. On a miss, fetch and
  // (if successful) cache for later.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.ok && res.type === "basic") {
          const copy = res.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(req, copy))
            .catch(() => {});
        }
        return res;
      });
    })
  );
});
