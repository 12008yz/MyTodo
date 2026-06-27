let registrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

export function registerAppServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return Promise.resolve(null);
  }

  if (!registrationPromise) {
    registrationPromise = navigator.serviceWorker.register("/sw.js").catch(() => null);
  }

  return registrationPromise;
}
