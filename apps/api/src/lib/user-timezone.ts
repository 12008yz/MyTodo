import { shouldApplyPendingTimezone } from "@mytodo/domain";
import { eq } from "drizzle-orm";
import type { DbExecutor } from "../db/index.js";
import { users, type User } from "../db/schema/index.js";

export async function applyPendingTimezoneIfDue(
  db: DbExecutor,
  user: User,
  now: Date = new Date(),
): Promise<User> {
  if (
    !shouldApplyPendingTimezone(
      {
        timezone: user.timezone,
        pendingTimezone: user.pendingTimezone,
        pendingTimezoneFrom: user.pendingTimezoneFrom,
      },
      now,
    )
  ) {
    return user;
  }

  const [updated] = await db
    .update(users)
    .set({
      timezone: user.pendingTimezone!,
      pendingTimezone: null,
      pendingTimezoneFrom: null,
    })
    .where(eq(users.id, user.id))
    .returning();

  return updated ?? user;
}

/** Apply deferred timezone changes before worker billing/pledge/day-close (§24.7). */
export async function syncAllPendingTimezones(
  db: DbExecutor,
  now: Date = new Date(),
): Promise<number> {
  const rows = await db.select({ id: users.id }).from(users);
  let applied = 0;

  for (const row of rows) {
    const [user] = await db.select().from(users).where(eq(users.id, row.id)).limit(1);
    if (!user) {
      continue;
    }

    const synced = await applyPendingTimezoneIfDue(db, user, now);
    if (synced.timezone !== user.timezone) {
      applied += 1;
    }
  }

  return applied;
}
