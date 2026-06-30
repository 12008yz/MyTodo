import "../config/load-dotenv.js";
import { loadEnv } from "../config/env.js";
import { createGigaChatClient, buildCoachSystemPrompt } from "../lib/gigachat/client.js";
import { resolveCoachGigaChatClient } from "../services/coach.js";

async function main(): Promise<void> {
  const env = loadEnv();
  const client = resolveCoachGigaChatClient(env.GIGACHAT_CREDENTIALS);
  if (!client) {
    console.error("GIGACHAT_CREDENTIALS not loaded");
    process.exit(1);
  }

  const reply = await client.complete([
    {
      role: "system",
      content: buildCoachSystemPrompt({
        habitName: "Грызть ногти",
        habitType: "abstinence",
        currentGoal: 0,
        unitLabel: "",
        successDaysAtGoal: 0,
        progressionIntervalDays: 1,
        harshnessLevel: 1,
        timerLabel: "0 д 1 ч 0 мин",
      }),
    },
    { role: "user", content: "Тянет сорваться" },
  ]);

  console.log("coach_gigachat_ok:", reply.slice(0, 80));
}

main().catch((error: unknown) => {
  console.error("coach_gigachat_fail:", error);
  process.exit(1);
});
