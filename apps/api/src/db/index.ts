import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { Env } from "../config/env.js";
import * as schema from "./schema/index.js";

export type Database = PostgresJsDatabase<typeof schema>;
export type DbTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type DbExecutor = Database | DbTransaction;

export function createDb(env: Env) {
  const client = postgres(env.DATABASE_URL, {
    max: env.NODE_ENV === "test" ? 1 : 10,
    prepare: false,
  });

  const db = drizzle(client, { schema });

  return { db, client };
}

export { checkDbConnection } from "./connection.js";
