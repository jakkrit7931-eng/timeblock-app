const CACHE_NAME = "productive-time-v20261028-momenta-b19";
const APP_SHELL = [
  "./index.html",
  "./sage-workspace.css",
  "./workspace-ui.css",
  "./productive-ui.css",
  "./productive-ui.js",
  "./construction-3d.js",
  "./momenta-domain.js",
  "./momenta-sync.js",
  "./momenta-metrics.js",
  "./momenta-focus.js",
  "./momenta-audio.js",
  "./momenta-wake.js",
  "./momenta-finance.js",
  "./momenta-farm.js",
  "./vendor/three.min.js",
  "./manifest.json",
  "./momenta-icon.png",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
});

self.addEventListener("message", event => {
  if (event.data?.type === "ACTIVATE_UPDATE") self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key.startsWith("productive-time-") && key !== CACHE_NAME).map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin === self.location.origin && (requestUrl.pathname.startsWith('/__/auth/') || requestUrl.pathname.startsWith('/__/firebase/'))) return;
  event.respondWith(
    caches.match(event.request, {ignoreSearch: true}).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok && new URL(event.request.url).origin === self.location.origin) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      });
    })
  );
});
