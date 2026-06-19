export type PushSubscriptionPayload = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export interface WebPushClient {
  sendNotification(subscription: PushSubscriptionPayload, payload: string): Promise<void>;
}
