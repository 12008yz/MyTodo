import { subscribePush } from "./api";
import { registerAppServiceWorker } from "./service-worker";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);

  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }

  return output;
}

function getVapidPublicKey(): string | null {
  const key = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  return typeof key === "string" && key.length > 0 ? key : null;
}

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  return registerAppServiceWorker();
}

export async function requestPushSubscription(): Promise<boolean> {
  if (!isPushSupported()) return false;

  const vapidKey = getVapidPublicKey();
  if (!vapidKey) return false;

  if (Notification.permission === "denied") return false;

  try {
    const permission =
      Notification.permission === "granted"
        ? "granted"
        : await Notification.requestPermission();

    if (permission !== "granted") return false;

    const registration = await ensureServiceWorker();
    if (!registration) return false;

    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
    }

    const json = subscription.toJSON();
    const endpoint = json.endpoint;
    const p256dh = json.keys?.p256dh;
    const auth = json.keys?.auth;

    if (!endpoint || !p256dh || !auth) return false;

    await subscribePush({ endpoint, keys: { p256dh, auth } });
    return true;
  } catch {
    return false;
  }
}
