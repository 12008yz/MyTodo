import "./config/load-dotenv.js";
import { loadEnv } from "./config/env.js";
import { initSentry } from "./lib/sentry.js";
import { buildApp } from "./app.js";

async function main(): Promise<void> {
  const env = loadEnv();
  initSentry(env.SENTRY_DSN);

  const { app } = await buildApp({ env });

  if (env.GIGACHAT_CREDENTIALS?.trim()) {
    app.log.info("GigaChat coach: enabled");
  } else {
    app.log.warn("GigaChat coach: disabled — set GIGACHAT_CREDENTIALS in apps/api/.env");
  }

  try {
    await app.listen({ port: env.PORT, host: "0.0.0.0" });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void main();
