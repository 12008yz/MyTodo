import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { createDb } from "../../src/db/index.js";
import type { Env } from "../../src/config/env.js";

let migrated = false;

export async function ensureMigrated(env: Env): Promise<void> {
  if (migrated) {
    return;
  }

  const { db, client } = createDb(env);
  await migrate(db, { migrationsFolder: "./drizzle" });
  await client.end({ timeout: 5 });
  migrated = true;
}

export async function resetAuthTables(databaseUrl: string): Promise<void> {
  const client = postgres(databaseUrl, { max: 1, prepare: false });
  await client`TRUNCATE TABLE refresh_tokens, users RESTART IDENTITY CASCADE`;
  await client.end({ timeout: 5 });
}

export async function truncateAuthTables(db: ReturnType<typeof createDb>["db"]): Promise<void> {
  await db.execute(
    sql`TRUNCATE TABLE billing_webhook_events, subscriptions, english_progress, english_settings, english_lessons, daily_stats, goal_snapshots, doom_scroll_sessions, pomodoro_sessions, checkins, habits, refresh_tokens, users RESTART IDENTITY CASCADE`,
  );
}
