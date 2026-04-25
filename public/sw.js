const CACHE_NAME = "sparklab-v1";
const STATIC_ASSETS = [
  "/",
  "/worlds",
  "/game",
  "/settings",
  "/dashboard",
  "/manifest.json",
  "/data/elements.json",
  "/data/molecules.json",
  "/data/bond_rules.json",
  "/data/reactions.json",
  "/data/missions.json",
  "/data/worlds.json",
  "/data/strings.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return (
        response ||
        fetch(event.request).then((fetchResponse) => {
          return fetchResponse;
        })
      );
    })
  );
});
