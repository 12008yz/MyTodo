import postgres from "postgres";
import { Redis } from "ioredis";

const sql = postgres("postgresql://mytodo:mytodo@127.0.0.1:5433/mytodo", {
  max: 1,
  connect_timeout: 3,
});

try {
  const row = await sql`SELECT 1 AS ok`;
  console.log("postgres:", row[0]?.ok === 1 ? "ok" : row);
} catch (e) {
  console.log("postgres: error -", (e as Error).message);
}

await sql.end();

const redis = new Redis("redis://127.0.0.1:6380", { maxRetriesPerRequest: 1 });
try {
  console.log("redis:", await redis.ping());
} catch (e) {
  console.log("redis: error -", (e as Error).message);
}
await redis.quit();
