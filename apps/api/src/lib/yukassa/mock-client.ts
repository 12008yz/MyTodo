import { randomUUID } from "node:crypto";
import type {
  CreatePaymentInput,
  CreateRecurringPaymentInput,
  YukassaClient,
  YukassaPayment,
  YukassaWebhookEvent,
} from "./types.js";

type StoredPayment = YukassaPayment & {
  savePaymentMethod: boolean;
};

export class MockYukassaClient implements YukassaClient {
  private readonly payments = new Map<string, StoredPayment>();

  async createPayment(input: CreatePaymentInput): Promise<YukassaPayment> {
    const id = `mock-pay-${randomUUID()}`;
    const payment: StoredPayment = {
      id,
      status: "pending",
      paid: false,
      amountRub: input.amountRub,
      confirmationUrl: `https://yookassa.mock/pay/${id}`,
      paymentMethodId: null,
      metadata: { user_id: input.userId, plan: input.plan },
      savePaymentMethod: input.savePaymentMethod,
    };
    this.payments.set(id, payment);
    return payment;
  }

  async createRecurringPayment(input: CreateRecurringPaymentInput): Promise<YukassaPayment> {
    const id = `mock-recur-${randomUUID()}`;
    const payment: StoredPayment = {
      id,
      status: "succeeded",
      paid: true,
      amountRub: input.amountRub,
      confirmationUrl: null,
      paymentMethodId: input.paymentMethodId,
      metadata: { user_id: input.userId, plan: input.plan },
      savePaymentMethod: false,
    };
    this.payments.set(id, payment);
    return payment;
  }

  async getPayment(paymentId: string): Promise<YukassaPayment> {
    const payment = this.payments.get(paymentId);
    if (!payment) {
      throw new Error(`Payment not found: ${paymentId}`);
    }

    return payment;
  }

  verifyWebhookSignature(): boolean {
    return true;
  }

  /** Test helper: mark a payment as succeeded. */
  succeedPayment(paymentId: string, paymentMethodId = `pm-${randomUUID()}`): YukassaPayment {
    const payment = this.payments.get(paymentId);
    if (!payment) {
      throw new Error(`Payment not found: ${paymentId}`);
    }

    payment.status = "succeeded";
    payment.paid = true;
    payment.paymentMethodId = payment.savePaymentMethod ? paymentMethodId : null;
    return payment;
  }

  /** Test helper: mark a payment as canceled. */
  cancelPayment(paymentId: string): YukassaPayment {
    const payment = this.payments.get(paymentId);
    if (!payment) {
      throw new Error(`Payment not found: ${paymentId}`);
    }

    payment.status = "canceled";
    payment.paid = false;
    return payment;
  }

  buildWebhookEvent(paymentId: string, event: string): YukassaWebhookEvent {
    const payment = this.payments.get(paymentId);
    if (!payment) {
      throw new Error(`Payment not found: ${paymentId}`);
    }

    return {
      type: "notification",
      event,
      object: {
        id: payment.id,
        status: payment.status,
        paid: payment.paid,
        amount: { value: payment.amountRub.toFixed(2), currency: "RUB" },
        payment_method: payment.paymentMethodId
          ? { id: payment.paymentMethodId, saved: true }
          : null,
        metadata: payment.metadata,
      },
    };
  }
}
