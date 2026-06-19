import type { PushSubscriptionPayload, WebPushClient } from "./types.js";

export type SentPush = {
  subscription: PushSubscriptionPayload;
  payload: string;
};

export class MockWebPushClient implements WebPushClient {
  readonly sent: SentPush[] = [];

  async sendNotification(subscription: PushSubscriptionPayload, payload: string): Promise<void> {
    this.sent.push({ subscription, payload });
  }

  clear(): void {
    this.sent.length = 0;
  }
}

export function createNoopWebPushClient(): WebPushClient {
  return {
    async sendNotification() {
      // no VAPID keys configured
    },
  };
}
