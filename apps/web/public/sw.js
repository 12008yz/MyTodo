// Bump EXERCISE_CACHE when files in /public/exercises/ change (keep in sync with strength-workout.ts).
const EXERCISE_CACHE = "mytodo-exercises-v1";
const EXERCISE_URLS = [
  "/exercises/squat.mp4",
  "/exercises/pushups.mp4",
  "/exercises/lunges.mp4",
  "/exercises/pullups.mp4",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(EXERCISE_CACHE)
      .then((cache) => cache.addAll(EXERCISE_URLS).catch(() => {}))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("mytodo-exercises-") && key !== EXERCISE_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (!url.pathname.startsWith("/exercises/")) {
    return;
  }

  event.respondWith(
    caches.open(EXERCISE_CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) {
        return cached;
      }

      const response = await fetch(request);
      if (response.ok) {
        void cache.put(request, response.clone());
      }
      return response;
    }),
  );
});

self.addEventListener("push", (event) => {
  let payload = { title: "Новая глава", body: "Уведомление от тренера" };

  try {
    if (event.data) {
      payload = { ...payload, ...event.data.json() };
    }
  } catch {
    // use defaults
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/navbar/home.svg",
      badge: "/navbar/home.svg",
      data: payload.data ?? {},
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ("focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow("/");
      }
      return undefined;
    }),
  );
});
