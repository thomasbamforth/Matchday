/**
 * Firebase Cloud Messaging service worker.
 * Handles background push notifications when the app is not in focus.
 *
 * Must live at /firebase-messaging-sw.js (public root) so Firebase can
 * register it at the required scope.
 *
 * The NEXT_PUBLIC_ config values are injected at runtime via the
 * /api/fcm/sw-config route, then this worker self-updates its config.
 */

importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

// Config is written into this file by a self.addEventListener('install') step
// that fetches /api/fcm/sw-config — or you can bake it in at build time.
// For now we use a placeholder that is replaced by the sw-config endpoint.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// Config is passed from the main thread via postMessage after registration
self.addEventListener("message", (event) => {
  if (event.data?.type === "FIREBASE_CONFIG") {
    firebase.initializeApp(event.data.config);
    const messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
      const { title, body } = payload.notification ?? {};
      if (!title) return;

      self.registration.showNotification(title, {
        body: body ?? "",
        icon: "/icon-192.png",
        badge: "/badge-72.png",
        data: payload.data,
      });
    });
  }
});

// Handle notification click — open/focus the app at the deep-link path
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification.data?.link ?? "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) return client.focus();
        }
        return self.clients.openWindow(link);
      })
  );
});
