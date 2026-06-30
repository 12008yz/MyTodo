import type { HarshnessLevel } from "@mytodo/shared";
import { gigaChatFetch } from "./configure-tls.js";



export type GigaChatMessage = {

  role: "system" | "user" | "assistant";

  content: string;

};



export type GigaChatClient = {

  complete(messages: GigaChatMessage[]): Promise<string>;

};



const GIGACHAT_OAUTH_URL =

  "https://ngw.devices.sberbank.ru:9443/api/v2/oauth";

const GIGACHAT_API_URL = "https://gigachat.devices.sberbank.ru/api/v1/chat/completions";



type TokenCache = {

  token: string;

  expiresAt: number;

};



export function createGigaChatClient(credentials: string): GigaChatClient {

  let tokenCache: TokenCache | null = null;



  async function getAccessToken(): Promise<string> {

    const now = Date.now();

    if (tokenCache && tokenCache.expiresAt > now + 30_000) {

      return tokenCache.token;

    }



    const response = await gigaChatFetch(GIGACHAT_OAUTH_URL, {

      method: "POST",

      headers: {

        "Content-Type": "application/x-www-form-urlencoded",

        Accept: "application/json",

        Authorization: `Basic ${credentials}`,

        RqUID: crypto.randomUUID(),

      },

      body: new URLSearchParams({ scope: "GIGACHAT_API_PERS" }),

    });



    if (!response.ok) {

      throw new Error(`GigaChat OAuth failed: ${response.status}`);

    }



    const body = (await response.json()) as { access_token: string; expires_at?: number };

    tokenCache = {

      token: body.access_token,

      expiresAt: body.expires_at ? body.expires_at * 1000 : now + 25 * 60_000,

    };

    return tokenCache.token;

  }



  return {

    async complete(messages: GigaChatMessage[]): Promise<string> {

      const token = await getAccessToken();

      const response = await gigaChatFetch(GIGACHAT_API_URL, {

        method: "POST",

        headers: {

          "Content-Type": "application/json",

          Accept: "application/json",

          Authorization: `Bearer ${token}`,

        },

        body: JSON.stringify({

          model: "GigaChat",

          messages,

          temperature: 0.7,

          max_tokens: 300,

        }),

      });



      if (!response.ok) {

        throw new Error(`GigaChat chat failed: ${response.status}`);

      }



      const body = (await response.json()) as {

        choices?: Array<{ message?: { content?: string } }>;

      };

      const content = body.choices?.[0]?.message?.content?.trim();

      if (!content) {

        throw new Error("GigaChat returned empty response");

      }

      return content;

    },

  };

}



export function buildCoachSystemPrompt(params: {

  habitName: string;

  habitType: "limit" | "abstinence";

  currentGoal: number;

  unitLabel: string;

  successDaysAtGoal: number;

  progressionIntervalDays: number;

  harshnessLevel: HarshnessLevel;

  timerLabel?: string | null;

}): string {

  const tone: Record<HarshnessLevel, string> = {

    1: "мягкий, поддерживающий",

    2: "строгий, но уважительный",

    3: "жёсткий, как сержант, без оскорблений",

  };



  const lines = [

    `Ты помощник habit-трекера. Тон: ${tone[params.harshnessLevel]}.`,

    `Привычка: ${params.habitName}.`,

  ];



  if (params.habitType === "abstinence") {

    lines.push("Режим: полный отказ.");

    if (params.timerLabel) {

      lines.push(`Без срыва: ${params.timerLabel}.`);

    }

  } else {

    lines.push(`Лимит сегодня: ≤ ${params.currentGoal} ${params.unitLabel}.`);

    lines.push(

      `Прогресс к снижению: ${params.successDaysAtGoal} из ${params.progressionIntervalDays} дней.`,

    );

  }



  lines.push(

    "Пользователь на грани срыва. Ответь по-русски, 2–4 коротких предложения.",

    "Дай конкретное действие на 5 минут. Без морализаторства и без медицинских советов.",

  );



  return lines.join(" ");

}


