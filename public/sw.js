const CACHE_VERSION = "workout-tracker-pwa-v3";
const OFFLINE_URL = "/offline";
const PRECACHE_URLS = [OFFLINE_URL, "/icon.svg", "/maskable-icon.svg"];
const PUBLIC_CACHE = `${CACHE_VERSION}-public`;
const AUTH_NAVIGATION_CACHE = `${CACHE_VERSION}-auth-pages`;

function isSameOrigin(url) {
  return new URL(url, self.location.origin).origin === self.location.origin;
}

function isAuthenticatedNavigation(url) {
  const { pathname } = new URL(url, self.location.origin);

  return /^\/workouts\/[^/]+\/?$/.test(pathname);
}

function isLoginResponse(response) {
  return response.redirected || (response.url && new URL(response.url, self.location.origin).pathname === "/login");
}

function isCacheableAuthenticatedResponse(response) {
  return Boolean(
    response &&
    response.ok &&
    response.status === 200 &&
    !isLoginResponse(response) &&
    response.type !== "opaque" &&
    response.type !== "opaqueredirect" &&
    (!response.url || isSameOrigin(response.url)),
  );
}

async function clearAuthenticatedNavigations() {
  await caches.delete(AUTH_NAVIGATION_CACHE);
}

async function updateAuthenticatedNavigation(request) {
  const response = await fetch(request);

  if (isCacheableAuthenticatedResponse(response)) {
    const cache = await caches.open(AUTH_NAVIGATION_CACHE);
    await cache.put(request, response.clone());
  } else {
    // A redirect/login page or an auth error means private documents must no
    // longer be available to this browser session.
    await clearAuthenticatedNavigations();
  }

  return response;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(PUBLIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)),
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
            .filter((key) => key !== PUBLIC_CACHE && key !== AUTH_NAVIGATION_CACHE)
            .map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  if (request.mode === "navigate") {
    if (!isSameOrigin(request.url) || !isAuthenticatedNavigation(request.url)) {
      event.respondWith(
        fetch(request)
          .then(async (response) => {
            if (new URL(request.url).pathname === "/login" || isLoginResponse(response) || response.status === 401 || response.status === 403) {
              await clearAuthenticatedNavigations();
            }
            return response;
          })
          .catch(() => caches.match(OFFLINE_URL, { ignoreSearch: true })),
      );
      return;
    }

    event.respondWith((async () => {
      const cache = await caches.open(AUTH_NAVIGATION_CACHE);
      const cachedResponse = await cache.match(request);

      if (cachedResponse && isCacheableAuthenticatedResponse(cachedResponse)) {
        // Do not make an installed PWA wait for a possibly cold server. Keep
        // the rendered/IndexedDB state and refresh this document for next time.
        event.waitUntil(updateAuthenticatedNavigation(request).catch(() => undefined));
        return cachedResponse;
      }

      if (cachedResponse) await cache.delete(request);

      try {
        return await updateAuthenticatedNavigation(request);
      } catch {
        return caches.match(OFFLINE_URL, { ignoreSearch: true });
      }
    })());
    return;
  }

  if (["font", "image", "script", "style"].includes(request.destination)) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;

        return fetch(request).then((response) => {
          if (!response || response.status !== 200 || response.type === "opaque") return response;

          const responseToCache = response.clone();
          caches.open(PUBLIC_CACHE).then((cache) => cache.put(request, responseToCache));
          return response;
        });
      }),
    );
  }
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "clear-auth-cache") {
    event.waitUntil(clearAuthenticatedNavigations());
  }
});
