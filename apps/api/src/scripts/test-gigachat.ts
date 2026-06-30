import "../config/load-dotenv.js";
import { createGigaChatClient } from "../lib/gigachat/client.js";

async function main(): Promise<void> {
  const credentials = process.env.GIGACHAT_CREDENTIALS?.trim();
  if (!credentials) {
    console.error("GIGACHAT_CREDENTIALS is not set");
    process.exit(1);
  }

  const client = createGigaChatClient(credentials);
  const reply = await client.complete([{ role: "user", content: "Ответь одним словом: ок" }]);
  console.log("GigaChat reply:", reply);
}

main().catch((error: unknown) => {
  console.error("GigaChat test failed:", error);
  process.exit(1);
});
