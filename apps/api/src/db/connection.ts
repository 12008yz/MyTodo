import type { Sql } from "postgres";

export async function checkDbConnection(client: Sql): Promise<boolean> {
  try {
    await client`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
