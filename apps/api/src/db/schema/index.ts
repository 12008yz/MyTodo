import {
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgTable,
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
  harshnessLevel: integer("harshness_level").notNull().default(1),
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
