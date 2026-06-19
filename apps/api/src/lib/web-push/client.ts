import webpush from "web-push";
import type { Env } from "../../config/env.js";
import type { PushSubscriptionPayload, WebPushClient } from "./types.js";

export function createWebPushClient(env: Env): WebPushClient | null {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    return null;
  }

  webpush.setVapidDetails(
    "mailto:push@novaya-glava.local",
    env.VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY,
  );

  return {
    async sendNotification(subscription: PushSubscriptionPayload, payload: string): Promise<void> {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: subscription.keys,
        },
        payload,
      );
    },
  };
}
