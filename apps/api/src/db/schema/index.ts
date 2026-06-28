import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  age: integer("age").notNull(),
  gender: varchar("gender", { length: 10 }).notNull(),
  weightKg: numeric("weight_kg", { precision: 5, scale: 1 }),
  heightCm: numeric("height_cm", { precision: 5, scale: 1 }),
  freeTimeMin: integer("free_time_min"),
  dailyBudgetMin: integer("daily_budget_min").notNull().default(60),
  timezone: varchar("timezone", { length: 64 }).notNull().default("Europe/Moscow"),
  wakeTime: varchar("wake_time", { length: 8 }),
  sleepTime: varchar("sleep_time", { length: 8 }),
  pomodoroWorkMin: integer("pomodoro_work_min").notNull().default(25),
  pomodoroBreakMin: integer("pomodoro_break_min").notNull().default(5),
  pomodoroLongBreakMin: integer("pomodoro_long_break_min").notNull().default(15),
  harshnessLevel: integer("harshness_level").notNull().default(1),
  role: varchar("role", { length: 20 }).notNull().default("user"),
  onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
  onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true, mode: "date" }),
  silenceModeUntil: timestamp("silence_mode_until", { withTimezone: true, mode: "date" }),
  silenceModeUsedAt: timestamp("silence_mode_used_at", { withTimezone: true, mode: "date" }),
  pendingTimezone: varchar("pending_timezone", { length: 64 }),
  pendingTimezoneFrom: date("pending_timezone_from"),
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true, mode: "date" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => ({
    tokenHashIdx: index("refresh_tokens_token_hash_idx").on(table.tokenHash),
  }),
);

export type RefreshToken = typeof refreshTokens.$inferSelect;
export type NewRefreshToken = typeof refreshTokens.$inferInsert;

export const habits = pgTable("habits", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 20 }).notNull(),
  side: varchar("side", { length: 10 }).notNull(),
  unit: varchar("unit", { length: 20 }),
  baselineValue: numeric("baseline_value", { precision: 10, scale: 2 }).notNull(),
  currentGoal: numeric("current_goal", { precision: 10, scale: 2 }).notNull(),
  growthStep: numeric("growth_step", { precision: 10, scale: 2 }).notNull().default("1"),
  progressionDirection: varchar("progression_direction", { length: 20 }).notNull(),
  phase: varchar("phase", { length: 20 }).notNull().default("reduction"),
  lastRelapseAt: timestamp("last_relapse_at", { withTimezone: true, mode: "date" }),
  allowsWeeklySkip: boolean("allows_weekly_skip").notNull().default(false),
  isCustom: boolean("is_custom").notNull().default(false),
  icon: varchar("icon", { length: 32 }),
  templateId: varchar("template_id", { length: 32 }),
  categoryKey: varchar("category_key", { length: 32 }),
  harshnessLevel: integer("harshness_level").notNull().default(1),
  progressionIntervalDays: integer("progression_interval_days").notNull().default(1),
  successDaysAtGoal: integer("success_days_at_goal").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export type Habit = typeof habits.$inferSelect;
export type NewHabit = typeof habits.$inferInsert;

export const checkins = pgTable(
  "checkins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    habitId: uuid("habit_id")
      .notNull()
      .references(() => habits.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    status: varchar("status", { length: 20 }).notNull(),
    value: numeric("value", { precision: 10, scale: 2 }),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    habitDateUnique: unique("checkins_habit_id_date_unique").on(table.habitId, table.date),
    statusCheck: check(
      "checkins_status_check",
      sql`${table.status} IN ('success', 'fail', 'pending', 'skipped')`,
    ),
  }),
);

export type Checkin = typeof checkins.$inferSelect;
export type NewCheckin = typeof checkins.$inferInsert;

export const pomodoroSessions = pgTable(
  "pomodoro_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    habitId: uuid("habit_id")
      .notNull()
      .references(() => habits.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true, mode: "date" }),
    workMin: integer("work_min").notNull().default(25),
    completed: boolean("completed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    activeHabitIdx: index("pomodoro_sessions_active_habit_idx").on(table.habitId),
  }),
);

export type PomodoroSession = typeof pomodoroSessions.$inferSelect;
export type NewPomodoroSession = typeof pomodoroSessions.$inferInsert;

export const habitSessions = pgTable(
  "habit_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    habitId: uuid("habit_id")
      .notNull()
      .references(() => habits.id, { onDelete: "cascade" }),
    blockId: text("block_id"),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true, mode: "date" }),
    plannedMin: integer("planned_min").notNull(),
    plannedSeconds: integer("planned_seconds"),
    actualMin: integer("actual_min"),
    valueAdded: numeric("value_added"),
    completed: boolean("completed").notNull().default(false),
    pausedAt: timestamp("paused_at", { withTimezone: true, mode: "date" }),
    pausedRemainingSeconds: integer("paused_remaining_seconds"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    habitIdx: index("habit_sessions_habit_idx").on(table.habitId),
  }),
);

export type HabitSession = typeof habitSessions.$inferSelect;
export type NewHabitSession = typeof habitSessions.$inferInsert;

export const habitReadingProgress = pgTable(
  "habit_reading_progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    habitId: uuid("habit_id")
      .notNull()
      .references(() => habits.id, { onDelete: "cascade" }),
    bookId: varchar("book_id", { length: 64 }).notNull(),
    pagesRead: integer("pages_read").notNull().default(0),
    pagesCreditedToday: integer("pages_credited_today").notNull().default(0),
    lastReadPage: integer("last_read_page").notNull().default(1),
    timerRemainingSeconds: integer("timer_remaining_seconds"),
    timerSavedDate: date("timer_saved_date"),
    readerDayStartPage: integer("reader_day_start_page"),
    readerDayDate: date("reader_day_date"),
    lastCheckinDate: date("last_checkin_date"),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    habitUnique: unique("habit_reading_progress_habit_id_unique").on(table.habitId),
    userIdx: index("habit_reading_progress_user_idx").on(table.userId),
  }),
);

export type HabitReadingProgress = typeof habitReadingProgress.$inferSelect;
export type NewHabitReadingProgress = typeof habitReadingProgress.$inferInsert;

export const habitNutritionLogs = pgTable(
  "habit_nutrition_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    habitId: uuid("habit_id")
      .notNull()
      .references(() => habits.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    ingredientIds: jsonb("ingredient_ids").$type<string[]>().notNull(),
    recipeId: varchar("recipe_id", { length: 64 }),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    habitDateUnique: unique("habit_nutrition_logs_habit_id_date_unique").on(
      table.habitId,
      table.date,
    ),
    userIdx: index("habit_nutrition_logs_user_idx").on(table.userId),
  }),
);

export type HabitNutritionLogRow = typeof habitNutritionLogs.$inferSelect;
export type NewHabitNutritionLogRow = typeof habitNutritionLogs.$inferInsert;

export const doomScrollSessions = pgTable(
  "doom_scroll_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    habitId: uuid("habit_id")
      .notNull()
      .references(() => habits.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    endsAt: timestamp("ends_at", { withTimezone: true, mode: "date" }).notNull(),
    durationMin: integer("duration_min").notNull().default(15),
    completed: boolean("completed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    activeHabitIdx: index("doom_scroll_sessions_active_habit_idx").on(table.habitId),
  }),
);

export type DoomScrollSession = typeof doomScrollSessions.$inferSelect;
export type NewDoomScrollSession = typeof doomScrollSessions.$inferInsert;

export const goalSnapshots = pgTable(
  "goal_snapshots",
  {
    habitId: uuid("habit_id")
      .notNull()
      .references(() => habits.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    goalValue: numeric("goal_value", { precision: 10, scale: 2 }).notNull(),
  },
  (table) => ({
    pk: unique("goal_snapshots_habit_id_date_pk").on(table.habitId, table.date),
  }),
);

export type GoalSnapshot = typeof goalSnapshots.$inferSelect;
export type NewGoalSnapshot = typeof goalSnapshots.$inferInsert;

export const dailyStats = pgTable(
  "daily_stats",
  {
    habitId: uuid("habit_id")
      .notNull()
      .references(() => habits.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    status: varchar("status", { length: 20 }).notNull(),
    value: numeric("value", { precision: 10, scale: 2 }),
    minutesTotal: integer("minutes_total").notNull().default(0),
  },
  (table) => ({
    pk: unique("daily_stats_habit_id_date_pk").on(table.habitId, table.date),
    statusCheck: check(
      "daily_stats_status_check",
      sql`${table.status} IN ('success', 'fail', 'skipped')`,
    ),
  }),
);

export type DailyStat = typeof dailyStats.$inferSelect;
export type NewDailyStat = typeof dailyStats.$inferInsert;

export const englishLessons = pgTable(
  "english_lessons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dayNumber: integer("day_number").notNull().unique(),
    title: varchar("title", { length: 255 }).notNull(),
    videoUrl: text("video_url").notNull(),
    durationSec: integer("duration_sec").notNull(),
    description: varchar("description"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
);

export type EnglishLesson = typeof englishLessons.$inferSelect;
export type NewEnglishLesson = typeof englishLessons.$inferInsert;

export const englishSettings = pgTable("english_settings", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  isEnabled: boolean("is_enabled").notNull().default(false),
  currentDay: integer("current_day").notNull().default(1),
  startedAt: date("started_at"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export type EnglishSettings = typeof englishSettings.$inferSelect;
export type NewEnglishSettings = typeof englishSettings.$inferInsert;

export const englishProgress = pgTable(
  "english_progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id").references(() => englishLessons.id, { onDelete: "set null" }),
    date: date("date").notNull(),
    status: varchar("status", { length: 20 }).notNull(),
    watchedSec: integer("watched_sec").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userDateUnique: unique("english_progress_user_id_date_unique").on(table.userId, table.date),
    statusCheck: check(
      "english_progress_status_check",
      sql`${table.status} IN ('success', 'fail', 'pending', 'skipped')`,
    ),
  }),
);

export type EnglishProgress = typeof englishProgress.$inferSelect;
export type NewEnglishProgress = typeof englishProgress.$inferInsert;

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    yukassaPaymentMethodId: varchar("yukassa_payment_method_id", { length: 255 }),
    plan: varchar("plan", { length: 20 }).notNull(),
    status: varchar("status", { length: 20 }).notNull(),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true, mode: "date" }).notNull(),
    pastDueRetryCount: integer("past_due_retry_count").notNull().default(0),
    lastPaymentFailedAt: timestamp("last_payment_failed_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index("subscriptions_user_id_idx").on(table.userId),
    planCheck: check(
      "subscriptions_plan_check",
      sql`${table.plan} IN ('monthly', '2months', '3months')`,
    ),
    statusCheck: check(
      "subscriptions_status_check",
      sql`${table.status} IN ('active', 'canceled', 'expired', 'past_due')`,
    ),
  }),
);

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;

export const billingWebhookEvents = pgTable(
  "billing_webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    yukassaPaymentId: varchar("yukassa_payment_id", { length: 255 }).notNull(),
    eventType: varchar("event_type", { length: 64 }).notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    paymentEventUnique: unique("billing_webhook_events_payment_event_unique").on(
      table.yukassaPaymentId,
      table.eventType,
    ),
  }),
);

export type BillingWebhookEvent = typeof billingWebhookEvents.$inferSelect;
export type NewBillingWebhookEvent = typeof billingWebhookEvents.$inferInsert;

export const pledges = pgTable(
  "pledges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    habitId: uuid("habit_id")
      .notNull()
      .references(() => habits.id, { onDelete: "cascade" }),
    amountRub: integer("amount_rub").notNull().default(5000),
    status: varchar("status", { length: 20 }).notNull(),
    charityFund: varchar("charity_fund", { length: 32 }).notNull(),
    startedAt: date("started_at").notNull(),
    endedAt: date("ended_at"),
    yukassaPaymentId: varchar("yukassa_payment_id", { length: 255 }),
    refundError: boolean("refund_error").notNull().default(false),
    adminComment: text("admin_comment"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index("pledges_user_id_idx").on(table.userId),
    habitIdIdx: index("pledges_habit_id_idx").on(table.habitId),
    statusCheck: check(
      "pledges_status_check",
      sql`${table.status} IN ('active', 'success', 'failed')`,
    ),
    charityFundCheck: check(
      "pledges_charity_fund_check",
      sql`${table.charityFund} IN ('oncology', 'children', 'animals')`,
    ),
  }),
);

export type Pledge = typeof pledges.$inferSelect;
export type NewPledge = typeof pledges.$inferInsert;

export const userBadges = pgTable("user_badges", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  badgeType: varchar("badge_type", { length: 64 }).notNull(),
  earnedAt: timestamp("earned_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export type UserBadge = typeof userBadges.$inferSelect;
export type NewUserBadge = typeof userBadges.$inferInsert;

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index("push_subscriptions_user_id_idx").on(table.userId),
    endpointUnique: unique("push_subscriptions_endpoint_unique").on(table.endpoint),
  }),
);

export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type NewPushSubscription = typeof pushSubscriptions.$inferInsert;

export const notificationTemplates = pgTable(
  "notification_templates",
  {
    id: serial("id").primaryKey(),
    eventType: varchar("event_type", { length: 64 }).notNull(),
    harshnessLevel: integer("harshness_level").notNull(),
    message: text("message").notNull(),
  },
  (table) => ({
    harshnessCheck: check(
      "notification_templates_harshness_level_check",
      sql`${table.harshnessLevel} BETWEEN 1 AND 3`,
    ),
  }),
);

export type NotificationTemplate = typeof notificationTemplates.$inferSelect;
export type NewNotificationTemplate = typeof notificationTemplates.$inferInsert;

export const pushDeliveryLog = pgTable(
  "push_delivery_log",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventType: varchar("event_type", { length: 64 }).notNull(),
    localDate: date("local_date").notNull(),
    slot: integer("slot").notNull().default(0),
    sentAt: timestamp("sent_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    pk: unique("push_delivery_log_pk").on(
      table.userId,
      table.eventType,
      table.localDate,
      table.slot,
    ),
  }),
);

export type PushDeliveryLog = typeof pushDeliveryLog.$inferSelect;
export type NewPushDeliveryLog = typeof pushDeliveryLog.$inferInsert;
