import "../config/load-dotenv.js";
import { loadEnv } from "../config/env.js";
import { createDb } from "../db/index.js";
import { seedDatabase } from "../services/seed.js";

async function main(): Promise<void> {
  const env = loadEnv(process.env);
  const { db, client } = createDb(env);

  try {
    const result = await seedDatabase(db);
    console.log("Seed completed:", result);
  } finally {
    await client.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
