import { and, eq } from "drizzle-orm";
import { BADGE_SWEET_FREEDOM } from "@mytodo/shared";
import type { DbExecutor } from "../db/index.js";
import { userBadges } from "../db/schema/index.js";

export async function awardBadgeIfMissing(
  executor: DbExecutor,
  userId: string,
  badgeType: string,
): Promise<boolean> {
  const [existing] = await executor
    .select({ id: userBadges.id })
    .from(userBadges)
    .where(and(eq(userBadges.userId, userId), eq(userBadges.badgeType, badgeType)))
    .limit(1);

  if (existing) {
    return false;
  }

  await executor.insert(userBadges).values({ userId, badgeType });
  return true;
}

export async function awardSweetFreedomBadge(
  executor: DbExecutor,
  userId: string,
): Promise<boolean> {
  return awardBadgeIfMissing(executor, userId, BADGE_SWEET_FREEDOM);
}
