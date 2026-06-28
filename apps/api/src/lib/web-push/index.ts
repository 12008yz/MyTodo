import { createWebPushClient } from "./client.js";
import { createNoopWebPushClient } from "./mock-client.js";
import type { WebPushClient } from "./types.js";

export type { PushSubscriptionPayload, WebPushClient } from "./types.js";
export { MockWebPushClient, createNoopWebPushClient } from "./mock-client.js";

export function resolveWebPushClient(
  env: import("../../config/env.js").Env,
  mock?: WebPushClient,
): WebPushClient {
  if (mock) {
    return mock;
  }

  return createWebPushClient(env) ?? createNoopWebPushClient();
}
