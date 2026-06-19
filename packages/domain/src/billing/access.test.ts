import { describe, expect, it } from "vitest";
import { hasBillingAccess } from "./access.js";

const now = new Date("2026-06-19T12:00:00Z");
const trialActive = new Date("2026-06-20T12:00:00Z");
const trialExpired = new Date("2026-06-18T12:00:00Z");
const periodEnd = new Date("2026-07-19T12:00:00Z");
const periodEnded = new Date("2026-06-18T12:00:00Z");

describe("hasBillingAccess", () => {
  it("grants access during trial", () => {
    expect(
      hasBillingAccess({ now, trialEndsAt: trialActive, subscription: null }),
    ).toBe(true);
  });

  it("grants access with active subscription after trial", () => {
    expect(
      hasBillingAccess({
        now,
        trialEndsAt: trialExpired,
        subscription: { status: "active", currentPeriodEnd: periodEnd },
      }),
    ).toBe(true);
  });

  it("grants access for canceled subscription until period end", () => {
    expect(
      hasBillingAccess({
        now,
        trialEndsAt: trialExpired,
        subscription: { status: "canceled", currentPeriodEnd: periodEnd },
      }),
    ).toBe(true);
  });

  it("denies access after canceled period ends", () => {
    expect(
      hasBillingAccess({
        now,
        trialEndsAt: trialExpired,
        subscription: { status: "canceled", currentPeriodEnd: periodEnded },
      }),
    ).toBe(false);
  });

  it("denies access when active subscription period has ended", () => {
    expect(
      hasBillingAccess({
        now,
        trialEndsAt: trialExpired,
        subscription: { status: "active", currentPeriodEnd: periodEnded },
      }),
    ).toBe(false);
  });

  it("denies access for past_due and expired", () => {
    expect(
      hasBillingAccess({
        now,
        trialEndsAt: trialExpired,
        subscription: { status: "past_due", currentPeriodEnd: periodEnd },
      }),
    ).toBe(false);

    expect(
      hasBillingAccess({
        now,
        trialEndsAt: trialExpired,
        subscription: { status: "expired", currentPeriodEnd: periodEnded },
      }),
    ).toBe(false);
  });

  it("denies access with no subscription after trial", () => {
    expect(
      hasBillingAccess({ now, trialEndsAt: trialExpired, subscription: null }),
    ).toBe(false);
  });
});
