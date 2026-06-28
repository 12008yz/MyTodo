import type { SubscriptionPlanId } from "@mytodo/shared";

export type YukassaPaymentStatus = "pending" | "waiting_for_capture" | "succeeded" | "canceled";

export type YukassaPayment = {
  id: string;
  status: YukassaPaymentStatus;
  paid: boolean;
  amountRub: number;
  confirmationUrl: string | null;
  paymentMethodId: string | null;
  metadata: Record<string, string>;
};

export type CreatePaymentInput = {
  userId: string;
  plan: SubscriptionPlanId;
  amountRub: number;
  description: string;
  savePaymentMethod: boolean;
  idempotenceKey: string;
  extraMetadata?: Record<string, string>;
};

export type CreateRecurringPaymentInput = {
  userId: string;
  plan: SubscriptionPlanId;
  amountRub: number;
  paymentMethodId: string;
  description: string;
  idempotenceKey: string;
  extraMetadata?: Record<string, string>;
};

export type YukassaWebhookEvent = {
  type: string;
  event: string;
  object: {
    id: string;
    status: YukassaPaymentStatus;
    paid: boolean;
    amount: { value: string; currency: string };
    payment_method?: { id: string; saved: boolean } | null;
    metadata?: Record<string, string>;
  };
};

export interface YukassaClient {
  createPayment(input: CreatePaymentInput): Promise<YukassaPayment>;
  createRecurringPayment(input: CreateRecurringPaymentInput): Promise<YukassaPayment>;
  getPayment(paymentId: string): Promise<YukassaPayment>;
  createRefund(paymentId: string, amountRub: number, idempotenceKey: string): Promise<void>;
  verifyWebhookSignature(_body: string, _signature: string | undefined): boolean;
}
