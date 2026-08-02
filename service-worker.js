const CACHE_NAME = "timeblock-pomodoro-v3";
const ASSETS = [
  "./index.html",
  "./timeblock-v2.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

// The page can ask the service worker to show a system notification.
// This is slightly more reliable than calling `new Notification()` directly
// from the page while the tab is backgrounded, because the notification is
// owned by the worker rather than the (possibly throttled) page context.
// NOTE: this still requires the browser process to be running — it cannot
// wake up after the tab/app has been fully closed without a server pushing
// to it via the Push API, which this static, backend-less app doesn't have.
self.addEventListener("message", (event) => {
  if (event.data?.type === "SHOW_NOTIFICATION") {
    self.registration.showNotification(event.data.title, {
      body: event.data.body,
      icon: "icon-192.png",
      badge: "icon-192.png",
    });
  }
});
