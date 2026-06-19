export const TRIAL_DAYS = 3;

export const PLEDGE_AMOUNT = 5000;

export const PLEDGE_PERIOD_DAYS = 30;

export const PLEDGE_CHARITY_FUNDS = ["oncology", "children", "animals"] as const;

export type PledgeCharityFund = (typeof PLEDGE_CHARITY_FUNDS)[number];

export const PLEDGE_STATUSES = ["active", "success", "failed"] as const;

export type PledgeStatus = (typeof PLEDGE_STATUSES)[number];

export const PLEDGE_BADGE_STEEL_CHARACTER = "steel_character";

export const PAST_DUE_RETRY_DAYS = 3;

export const PAST_DUE_MAX_RETRIES = 3;

export const SUBSCRIPTION_PLAN_IDS = ["monthly", "2months", "3months"] as const;

export type SubscriptionPlanId = (typeof SUBSCRIPTION_PLAN_IDS)[number];

export const SUBSCRIPTION_PLANS = {
  monthly: {
    id: "monthly" as const,
    priceRub: 1990,
    periodDays: 30,
    recurring: true,
  },
  "2months": {
    id: "2months" as const,
    priceRub: 3790,
    periodDays: 60,
    recurring: false,
  },
  "3months": {
    id: "3months" as const,
    priceRub: 5490,
    periodDays: 90,
    recurring: false,
  },
} satisfies Record<
  SubscriptionPlanId,
  {
    id: SubscriptionPlanId;
    priceRub: number;
    periodDays: number;
    recurring: boolean;
  }
>;

export const DEFAULT_TIMEZONE = "Europe/Moscow";

export const ACCESS_TOKEN_TTL_SEC = 15 * 60;

export const REFRESH_TOKEN_TTL_DAYS = 30;

export const SILENCE_MODE_DURATION_MS = 24 * 60 * 60 * 1000;

export const SILENCE_MODE_COOLDOWN_DAYS = 30;

export const SILENCE_MODE_HARSHNESS_LEVEL = 1;

export const GENDERS = ["male", "female", "other"] as const;

export type Gender = (typeof GENDERS)[number];

export function computeDailyBudgetMin(freeTimeMin: number): number {
  return Math.min(freeTimeMin, 60);
}
