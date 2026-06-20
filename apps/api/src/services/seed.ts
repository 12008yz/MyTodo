import {
  computeDailyBudgetMin,
  TRIAL_DAYS,
} from "@mytodo/shared";
import { eq } from "drizzle-orm";
import type { Database } from "../db/index.js";
import { englishLessons, users } from "../db/schema/index.js";
import { hashPassword } from "../lib/auth/crypto.js";
import { seedPushTemplates } from "./push.js";

export const SEED_USERS = [
  {
    email: "demo@novayaglava.local",
    password: "demo1234",
    name: "Demo User",
    age: 28,
    gender: "male" as const,
    role: "user" as const,
    onboarding: true,
    trialDaysRemaining: TRIAL_DAYS,
  },
  {
    email: "trial@novayaglava.local",
    password: "trial1234",
    name: "Trial User",
    age: 24,
    gender: "female" as const,
    role: "user" as const,
    onboarding: false,
    trialDaysRemaining: TRIAL_DAYS,
  },
  {
    email: "admin@novayaglava.local",
    password: "admin1234",
    name: "Admin",
    age: 30,
    gender: "male" as const,
    role: "admin" as const,
    onboarding: true,
    trialDaysRemaining: TRIAL_DAYS,
  },
] as const;

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function buildEnglishLessons() {
  return Array.from({ length: 30 }, (_, index) => {
    const day = index + 1;
    const durationSec = 300 + (day % 6) * 60;
    return {
      dayNumber: day,
      title: `Day ${day}: English lesson`,
      videoUrl: `https://www.youtube.com/watch?v=seed-lesson-${day}`,
      durationSec,
      description: `Seed lesson ${day} for local development`,
    };
  });
}

export type SeedResult = {
  users_created: number;
  lessons_created: number;
  push_templates_seeded: boolean;
};

export async function seedDatabase(db: Database): Promise<SeedResult> {
  let usersCreated = 0;
  let lessonsCreated = 0;

  await seedPushTemplates(db);

  for (const seedUser of SEED_USERS) {
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, seedUser.email))
      .limit(1);

    if (existing) {
      continue;
    }

    const passwordHash = await hashPassword(seedUser.password);

    await db.insert(users).values({
      email: seedUser.email,
      passwordHash,
      name: seedUser.name,
      age: seedUser.age,
      gender: seedUser.gender,
      role: seedUser.role,
      timezone: "Europe/Moscow",
      trialEndsAt: addDays(new Date(), seedUser.trialDaysRemaining),
      onboardingCompleted: seedUser.onboarding,
      weightKg: seedUser.onboarding ? "75.0" : null,
      heightCm: seedUser.onboarding ? "175.0" : null,
      freeTimeMin: seedUser.onboarding ? 60 : null,
      dailyBudgetMin: seedUser.onboarding ? computeDailyBudgetMin(60) : 60,
      wakeTime: seedUser.onboarding ? "07:00:00" : null,
      sleepTime: seedUser.onboarding ? "23:00:00" : null,
    });

    usersCreated += 1;
  }

  for (const lesson of buildEnglishLessons()) {
    const [existing] = await db
      .select({ id: englishLessons.id })
      .from(englishLessons)
      .where(eq(englishLessons.dayNumber, lesson.dayNumber))
      .limit(1);

    if (existing) {
      continue;
    }

    await db.insert(englishLessons).values(lesson);
    lessonsCreated += 1;
  }

  return {
    users_created: usersCreated,
    lessons_created: lessonsCreated,
    push_templates_seeded: true,
  };
}
