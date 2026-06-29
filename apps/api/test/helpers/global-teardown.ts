import "dotenv/config";
import { loadEnv } from "../../src/config/env.js";
import { createDb } from "../../src/db/index.js";
import { seedEnglishLessons } from "../../src/services/seed.js";

export default async function globalTeardown(): Promise<void> {
  const env = loadEnv({ ...process.env, NODE_ENV: "test" });
  const { db, client } = createDb(env);

  try {
    await seedEnglishLessons(db);
  } finally {
    await client.end({ timeout: 5 });
  }
}
