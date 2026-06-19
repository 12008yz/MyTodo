export type SubscriptionAccess = {
  status: string;
  currentPeriodEnd: Date;
};

export type BillingAccessInput = {
  now: Date;
  trialEndsAt: Date;
  subscription: SubscriptionAccess | null;
};

/** Whether the user may access paid API features (§14, block 10). */
export function hasBillingAccess(input: BillingAccessInput): boolean {
  if (input.now < input.trialEndsAt) {
    return true;
  }

  const subscription = input.subscription;
  if (!subscription) {
    return false;
  }

  if (subscription.status === "active") {
    return input.now < subscription.currentPeriodEnd;
  }

  if (subscription.status === "canceled" && input.now < subscription.currentPeriodEnd) {
    return true;
  }

  return false;
}
