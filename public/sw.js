const CACHE_VERSION = "workout-tracker-pwa-v2";
const OFFLINE_URL = "/offline";
const PRECACHE_URLS = [OFFLINE_URL, "/icon.svg", "/maskable-icon.svg"];
const NAVIGATION_CACHE = `${CACHE_VERSION}-pages`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE_URLS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_VERSION && key !== NAVIGATION_CACHE)
            .map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok && new URL(request.url).origin === self.location.origin) {
            const responseToCache = response.clone();
            caches.open(NAVIGATION_CACHE).then((cache) => cache.put(request, responseToCache));
          }

          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then((cachedResponse) => cachedResponse ?? caches.match(OFFLINE_URL, { ignoreSearch: true })),
        ),
    );
    return;
  }

  if (["font", "image", "script", "style"].includes(request.destination)) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request).then((response) => {
          if (!response || response.status !== 200 || response.type === "opaque") {
            return response;
          }

          const responseToCache = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, responseToCache));

          return response;
        });
      }),
    );
  }
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "clear-auth-cache") {
    event.waitUntil(caches.delete(NAVIGATION_CACHE));
  }
});
