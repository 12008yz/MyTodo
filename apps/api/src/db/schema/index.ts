import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

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
  silenceModeUntil: timestamp("silence_mode_until", { withTimezone: true, mode: "date" }),
  silenceModeUsedAt: timestamp("silence_mode_used_at", { withTimezone: true, mode: "date" }),
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
