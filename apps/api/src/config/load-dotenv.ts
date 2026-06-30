import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Always load `apps/api/.env`, regardless of process cwd (turbo monorepo root). */
const apiRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

config({ path: join(apiRoot, ".env") });
