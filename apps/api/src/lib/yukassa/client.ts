import type { Env } from "../../config/env.js";
import { MockYukassaClient } from "./mock-client.js";
import type {
  CreatePaymentInput,
  CreateRecurringPaymentInput,
  YukassaClient,
  YukassaPayment,
  YukassaPaymentStatus,
} from "./types.js";

type YukassaApiPayment = {
  id: string;
  status: YukassaPaymentStatus;
  paid: boolean;
  amount: { value: string; currency: string };
  confirmation?: { confirmation_url?: string } | null;
  payment_method?: { id: string; saved: boolean } | null;
  metadata?: Record<string, string>;
};

function mapPayment(raw: YukassaApiPayment): YukassaPayment {
  return {
    id: raw.id,
    status: raw.status,
    paid: raw.paid,
    amountRub: Number(raw.amount.value),
    confirmationUrl: raw.confirmation?.confirmation_url ?? null,
    paymentMethodId: raw.payment_method?.id ?? null,
    metadata: raw.metadata ?? {},
  };
}

export class HttpYukassaClient implements YukassaClient {
  constructor(
    private readonly shopId: string,
    private readonly secretKey: string,
  ) {}

  async createPayment(input: CreatePaymentInput): Promise<YukassaPayment> {
    const body = {
      amount: { value: input.amountRub.toFixed(2), currency: "RUB" },
      capture: true,
      confirmation: { type: "redirect", return_url: "https://example.com/billing/return" },
      description: input.description,
      save_payment_method: input.savePaymentMethod,
      metadata: { user_id: input.userId, plan: input.plan, ...input.extraMetadata },
    };

    const raw = await this.request<YukassaApiPayment>("POST", "/payments", body, input.idempotenceKey);
    return mapPayment(raw);
  }

  async createRecurringPayment(input: CreateRecurringPaymentInput): Promise<YukassaPayment> {
    const body = {
      amount: { value: input.amountRub.toFixed(2), currency: "RUB" },
      capture: true,
      payment_method_id: input.paymentMethodId,
      description: input.description,
      metadata: { user_id: input.userId, plan: input.plan },
    };

    const raw = await this.request<YukassaApiPayment>("POST", "/payments", body, input.idempotenceKey);
    return mapPayment(raw);
  }

  async getPayment(paymentId: string): Promise<YukassaPayment> {
    const raw = await this.request<YukassaApiPayment>("GET", `/payments/${paymentId}`);
    return mapPayment(raw);
  }

  async createRefund(paymentId: string, amountRub: number, idempotenceKey: string): Promise<void> {
    await this.request(
      "POST",
      `/refunds`,
      {
        payment_id: paymentId,
        amount: { value: amountRub.toFixed(2), currency: "RUB" },
      },
      idempotenceKey,
    );
  }

  verifyWebhookSignature(_body: string, _signature: string | undefined): boolean {
    // YuKassa does not sign webhooks with a shared HMAC header.
    // Authenticity is verified by fetching the payment from the API in handleWebhook.
    return true;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    idempotenceKey?: string,
  ): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Basic ${Buffer.from(`${this.shopId}:${this.secretKey}`).toString("base64")}`,
      "Content-Type": "application/json",
    };

    if (idempotenceKey) {
      headers["Idempotence-Key"] = idempotenceKey;
    }

    const response = await fetch(`https://api.yookassa.ru/v3${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`YuKassa API error ${response.status}: ${text}`);
    }

    return (await response.json()) as T;
  }
}

export function createYukassaClient(env: Env, override?: YukassaClient): YukassaClient {
  if (override) {
    return override;
  }

  if (env.NODE_ENV === "test" || !env.YUKASSA_SHOP_ID || !env.YUKASSA_SECRET_KEY) {
    return new MockYukassaClient();
  }

  return new HttpYukassaClient(env.YUKASSA_SHOP_ID, env.YUKASSA_SECRET_KEY);
}
