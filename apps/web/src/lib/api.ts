import {
  apiErrorResponseSchema,
  authResponseSchema,
  checkinResponseSchema,
  completeHabitSessionRequestSchema,
  createHabitRequestSchema,
  createCheckinRequestSchema,
  englishSettingsResponseSchema,
  englishCatalogResponseSchema,
  englishTodayResponseSchema,
  englishCompleteRequestSchema,
  englishCompleteResponseSchema,
  englishSkipResponseSchema,
  englishHistoryResponseSchema,
  englishSelectLessonRequestSchema,
  englishSelectLessonResponseSchema,
  englishWatchRequestSchema,
  englishWatchResponseSchema,
  habitSessionActiveResponseSchema,
  habitSessionCompleteResponseSchema,
  habitSessionSchema,
  habitNutritionLogSchema,
  habitReadingProgressSchema,
  nutritionTodayResponseSchema,
  putNutritionTodayRequestSchema,
  selectHabitBookRequestSchema,
  updateReadingBookmarkRequestSchema,
  habitResponseSchema,
  startHabitSessionRequestSchema,
  pushSubscribeRequestSchema,
  pushSubscribeResponseSchema,
  pushTestResponseSchema,
  statsCalendarResponseSchema,
  statsMonthResponseSchema,
  statsProgressResponseSchema,
  statsWeekResponseSchema,
  todayDarkResponseSchema,
  todayLightResponseSchema,
  type AuthResponse,
  type CreateCheckinRequest,
  type CreateHabitRequest,
  type CheckinResponse,
  type CompleteHabitSessionRequest,
  type HabitResponse,
  type HabitSessionActiveResponse,
  type HabitSessionCompleteResponse,
  type HabitSessionResponse,
  type HabitNutritionLog,
  type HabitReadingProgress,
  type PutNutritionTodayRequest,
  type SelectHabitBookRequest,
  type UpdateReadingBookmarkRequest,
  type LoginRequest,
  type PatchEnglishSettingsRequest,
  type PatchMeRequest,
  type PushSubscribeRequest,
  type PushSubscribeResponse,
  type PushTestResponse,
  type RegisterRequest,
  type StartHabitSessionRequest,
  type ProgressPeriod,
  type StatsCalendarResponse,
  type StatsMonthResponse,
  type StatsProgressResponse,
  type StatsSide,
  type StatsWeekResponse,
  type TodayDarkResponse,
  type TodayLightResponse,
  type UserProfile,
  userProfileSchema,
  type EnglishSettingsResponse,
  type EnglishTodayResponse,
  type EnglishCompleteRequest,
  type EnglishCompleteResponse,
  type EnglishSkipResponse,
  type EnglishHistoryResponse,
  type EnglishCatalogResponse,
  type EnglishSelectLessonRequest,
  type EnglishSelectLessonResponse,
  type EnglishWatchRequest,
  type EnglishWatchResponse,
  coachChatRequestSchema,
  coachChatResponseSchema,
  type CoachChatRequest,
  type CoachChatResponse,
} from "@mytodo/shared";
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from "./auth-storage";
import { isDemoMode } from "./demo-mode";
import {
  demoCompleteHabitSession,
  demoCreateCheckin,
  demoCreateHabit,
  demoGetActiveHabitSession,
  demoGetMe,
  demoGetHabitProgress,
  demoGetStatsCalendar,
  demoGetStatsMonth,
  demoGetStatsWeek,
  demoGetTodayDark,
  demoGetTodayLight,
  demoLogin,
  demoLogout,
  demoRegister,
  demoStartHabitSession,
  demoPauseHabitSession,
  demoResumeHabitSession,
  demoStopHabitSession,
  demoSelectHabitBook,
  demoPutNutritionTodayLog,
  demoGetNutritionTodayLog,
  demoClearHabitBook,
  demoResetTodayCheckin,
  demoReopenTodayCheckin,
  demoUpdateReadingBookmark,
  demoSubscribePush,
  demoUpdateEnglishSettings,
  demoGetEnglishToday,
  demoGetEnglishCatalog,
  demoRecordEnglishWatch,
  demoSelectEnglishLesson,
  demoCompleteEnglishLesson,
  demoSkipEnglishLesson,
  demoGetEnglishHistory,
  demoUpdateMe,
  demoEnterShowcase,
  demoSendCoachChat,
} from "./demo-api";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

export class ClientApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ClientApiError";
  }
}

async function parseError(response: Response): Promise<ClientApiError> {
  let message = response.statusText;
  let code: string | undefined;

  try {
    const body = apiErrorResponseSchema.parse(await response.json());
    message = body.error.message;
    code = body.error.code;
  } catch {
    // ignore malformed error body
  }

  return new ClientApiError(message, response.status, code);
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  const response = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!response.ok) {
    clearTokens();
    return null;
  }

  const data = authResponseSchema.parse(await response.json());
  setTokens(data.access_token, data.refresh_token);
  return data.access_token;
}

/** Unauthenticated requests — no Bearer, no refresh retry (login/register). */
async function publicFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });

  if (!response.ok) {
    throw await parseError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }

  const accessToken = getAccessToken();
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });

  if (response.status === 401 && retry) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return apiFetch(path, init, false);
    }
  }

  if (!response.ok) {
    throw await parseError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function register(data: RegisterRequest): Promise<AuthResponse> {
  clearTokens();

  if (isDemoMode()) {
    return demoRegister(data);
  }

  const timezone =
    data.timezone ??
    Intl.DateTimeFormat().resolvedOptions().timeZone ??
    "Europe/Moscow";

  const response = await publicFetch<unknown>("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify({ ...data, timezone }),
  });

  const parsed = authResponseSchema.parse(response);
  setTokens(parsed.access_token, parsed.refresh_token);
  return parsed;
}

export async function login(data: LoginRequest): Promise<AuthResponse> {
  clearTokens();

  if (isDemoMode()) {
    return demoLogin(data);
  }

  const response = await publicFetch<unknown>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify(data),
  });

  const parsed = authResponseSchema.parse(response);
  setTokens(parsed.access_token, parsed.refresh_token);
  return parsed;
}

export async function logout(): Promise<void> {
  if (isDemoMode()) {
    demoLogout();
    clearTokens();
    return;
  }

  const refreshToken = getRefreshToken();
  if (refreshToken) {
    try {
      await apiFetch("/api/v1/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    } catch {
      // ignore logout errors
    }
  }
  clearTokens();
}

export async function getMe(): Promise<UserProfile> {
  if (isDemoMode() && getAccessToken()) {
    return demoGetMe();
  }

  const response = await apiFetch<unknown>("/api/v1/me");
  return userProfileSchema.parse(response);
}

export async function updateMe(data: PatchMeRequest): Promise<UserProfile> {
  if (isDemoMode()) {
    return demoUpdateMe(data);
  }

  const response = await apiFetch<unknown>("/api/v1/me", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  return userProfileSchema.parse(response);
}

export async function createHabit(data: CreateHabitRequest): Promise<HabitResponse> {
  createHabitRequestSchema.parse(data);

  if (isDemoMode()) {
    return demoCreateHabit(data);
  }

  const response = await apiFetch<unknown>("/api/v1/habits", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return habitResponseSchema.parse(response);
}

export async function updateEnglishSettings(
  data: PatchEnglishSettingsRequest,
): Promise<EnglishSettingsResponse> {
  if (isDemoMode()) {
    return demoUpdateEnglishSettings(data);
  }

  const response = await apiFetch<unknown>("/api/v1/english/settings", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  return englishSettingsResponseSchema.parse(response);
}

export async function getEnglishCatalog(): Promise<EnglishCatalogResponse> {
  if (isDemoMode()) {
    return demoGetEnglishCatalog();
  }

  const response = await apiFetch<unknown>("/api/v1/english/catalog");
  return englishCatalogResponseSchema.parse(response);
}

export async function recordEnglishWatch(
  data: EnglishWatchRequest,
): Promise<EnglishWatchResponse> {
  englishWatchRequestSchema.parse(data);

  if (isDemoMode()) {
    return demoRecordEnglishWatch(data);
  }

  const response = await apiFetch<unknown>("/api/v1/english/watch", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return englishWatchResponseSchema.parse(response);
}

export async function selectEnglishLesson(
  data: EnglishSelectLessonRequest,
): Promise<EnglishSelectLessonResponse> {
  englishSelectLessonRequestSchema.parse(data);

  if (isDemoMode()) {
    return demoSelectEnglishLesson(data);
  }

  const response = await apiFetch<unknown>("/api/v1/english/select", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return englishSelectLessonResponseSchema.parse(response);
}

export async function getEnglishToday(): Promise<EnglishTodayResponse> {
  if (isDemoMode()) {
    return demoGetEnglishToday();
  }

  const response = await apiFetch<unknown>("/api/v1/english/today");
  return englishTodayResponseSchema.parse(response);
}

export async function completeEnglishLesson(
  data: EnglishCompleteRequest,
): Promise<EnglishCompleteResponse> {
  englishCompleteRequestSchema.parse(data);

  if (isDemoMode()) {
    return demoCompleteEnglishLesson(data);
  }

  const response = await apiFetch<unknown>("/api/v1/english/complete", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return englishCompleteResponseSchema.parse(response);
}

export async function skipEnglishLesson(): Promise<EnglishSkipResponse> {
  if (isDemoMode()) {
    return demoSkipEnglishLesson();
  }

  const response = await apiFetch<unknown>("/api/v1/english/skip", {
    method: "POST",
  });
  return englishSkipResponseSchema.parse(response);
}

export async function getEnglishHistory(): Promise<EnglishHistoryResponse> {
  if (isDemoMode()) {
    return demoGetEnglishHistory();
  }

  const response = await apiFetch<unknown>("/api/v1/english/history");
  return englishHistoryResponseSchema.parse(response);
}

export async function getTodayLight(): Promise<TodayLightResponse> {
  if (isDemoMode()) {
    return demoGetTodayLight();
  }

  const response = await apiFetch<unknown>("/api/v1/today/light");
  return todayLightResponseSchema.parse(response);
}

export async function getTodayDark(): Promise<TodayDarkResponse> {
  if (isDemoMode()) {
    return demoGetTodayDark();
  }

  const response = await apiFetch<unknown>("/api/v1/today/dark");
  return todayDarkResponseSchema.parse(response);
}

export async function createCheckin(data: CreateCheckinRequest): Promise<CheckinResponse> {
  createCheckinRequestSchema.parse(data);

  if (isDemoMode()) {
    return demoCreateCheckin(data);
  }

  const response = await apiFetch<unknown>("/api/v1/checkins", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return checkinResponseSchema.parse(response);
}

export async function startHabitSession(
  habitId: string,
  data: StartHabitSessionRequest = {},
): Promise<HabitSessionResponse> {
  startHabitSessionRequestSchema.parse(data);

  if (isDemoMode()) {
    return demoStartHabitSession(habitId, data);
  }

  const response = await apiFetch<unknown>(`/api/v1/habits/${habitId}/sessions/start`, {
    method: "POST",
    body: JSON.stringify(data),
  });
  return habitSessionSchema.parse(response);
}

export async function selectHabitBook(
  habitId: string,
  data: SelectHabitBookRequest,
): Promise<HabitReadingProgress> {
  selectHabitBookRequestSchema.parse(data);

  if (isDemoMode()) {
    return demoSelectHabitBook(habitId, data);
  }

  const response = await apiFetch<unknown>(`/api/v1/habits/${habitId}/reading/select`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
  return habitReadingProgressSchema.parse(response);
}

export async function getNutritionTodayLog(habitId: string): Promise<HabitNutritionLog | null> {
  if (isDemoMode()) {
    return demoGetNutritionTodayLog(habitId);
  }

  const response = await apiFetch<unknown>(`/api/v1/habits/${habitId}/nutrition/today`);
  const parsed = nutritionTodayResponseSchema.parse(response);
  return parsed.log;
}

export async function putNutritionTodayLog(
  habitId: string,
  data: PutNutritionTodayRequest,
): Promise<HabitNutritionLog> {
  putNutritionTodayRequestSchema.parse(data);

  if (isDemoMode()) {
    return demoPutNutritionTodayLog(habitId, data);
  }

  const response = await apiFetch<unknown>(`/api/v1/habits/${habitId}/nutrition/today`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
  return habitNutritionLogSchema.parse(response);
}

export async function clearHabitBook(habitId: string): Promise<void> {
  if (isDemoMode()) {
    demoClearHabitBook(habitId);
    return;
  }

  await apiFetch<unknown>(`/api/v1/habits/${habitId}/reading`, {
    method: "DELETE",
  });
}

export async function resetTodayCheckin(habitId: string, date?: string): Promise<void> {
  if (isDemoMode()) {
    demoResetTodayCheckin(habitId, date);
    return;
  }

  const params = new URLSearchParams({ habit_id: habitId });
  if (date) {
    params.set("date", date);
  }

  await apiFetch<unknown>(`/api/v1/checkins?${params.toString()}`, {
    method: "DELETE",
  });
}

export async function reopenTodayCheckin(habitId: string, date?: string): Promise<void> {
  if (isDemoMode()) {
    demoReopenTodayCheckin(habitId, date);
    return;
  }

  await apiFetch<unknown>("/api/v1/checkins/reopen", {
    method: "POST",
    body: JSON.stringify({
      habit_id: habitId,
      ...(date ? { date } : {}),
    }),
  });
}

export async function updateReadingBookmark(
  habitId: string,
  data: UpdateReadingBookmarkRequest,
): Promise<HabitReadingProgress> {
  updateReadingBookmarkRequestSchema.parse(data);

  if (isDemoMode()) {
    return demoUpdateReadingBookmark(habitId, data);
  }

  const response = await apiFetch<unknown>(`/api/v1/habits/${habitId}/reading/bookmark`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  return habitReadingProgressSchema.parse(response);
}

export async function completeHabitSession(
  habitId: string,
  data: CompleteHabitSessionRequest = {},
): Promise<HabitSessionCompleteResponse> {
  completeHabitSessionRequestSchema.parse(data);

  if (isDemoMode()) {
    return demoCompleteHabitSession(habitId, data);
  }

  const response = await apiFetch<unknown>(`/api/v1/habits/${habitId}/sessions/complete`, {
    method: "POST",
    body: JSON.stringify(data),
  });
  return habitSessionCompleteResponseSchema.parse(response);
}

export async function stopHabitSession(habitId: string): Promise<HabitSessionResponse> {
  if (isDemoMode()) {
    return demoStopHabitSession(habitId);
  }

  const response = await apiFetch<unknown>(`/api/v1/habits/${habitId}/sessions/stop`, {
    method: "POST",
  });
  return habitSessionSchema.parse(response);
}

export async function pauseHabitSession(habitId: string): Promise<HabitSessionResponse> {
  if (isDemoMode()) {
    return demoPauseHabitSession(habitId);
  }

  const response = await apiFetch<unknown>(`/api/v1/habits/${habitId}/sessions/pause`, {
    method: "POST",
  });
  return habitSessionSchema.parse(response);
}

export async function resumeHabitSession(habitId: string): Promise<HabitSessionResponse> {
  if (isDemoMode()) {
    return demoResumeHabitSession(habitId);
  }

  const response = await apiFetch<unknown>(`/api/v1/habits/${habitId}/sessions/resume`, {
    method: "POST",
  });
  return habitSessionSchema.parse(response);
}

export async function getActiveHabitSession(habitId: string): Promise<HabitSessionActiveResponse> {
  if (isDemoMode()) {
    return demoGetActiveHabitSession(habitId);
  }

  const response = await apiFetch<unknown>(`/api/v1/habits/${habitId}/sessions/active`);
  return habitSessionActiveResponseSchema.parse(response);
}

export async function getStatsWeek(side: StatsSide): Promise<StatsWeekResponse> {
  if (isDemoMode()) {
    return demoGetStatsWeek(side);
  }

  const response = await apiFetch<unknown>(`/api/v1/stats/week?side=${side}`);
  return statsWeekResponseSchema.parse(response);
}

export async function getStatsCalendar(month: string, side: StatsSide): Promise<StatsCalendarResponse> {
  if (isDemoMode()) {
    return demoGetStatsCalendar(month, side);
  }

  const response = await apiFetch<unknown>(
    `/api/v1/stats/calendar?month=${encodeURIComponent(month)}&side=${side}`,
  );
  return statsCalendarResponseSchema.parse(response);
}

export async function getStatsMonth(month: string, side: StatsSide): Promise<StatsMonthResponse> {
  if (isDemoMode()) {
    return demoGetStatsMonth(month, side);
  }

  const response = await apiFetch<unknown>(
    `/api/v1/stats/month?month=${encodeURIComponent(month)}&side=${side}`,
  );
  return statsMonthResponseSchema.parse(response);
}

export async function getHabitProgress(
  habitId: string,
  period: ProgressPeriod = "month",
): Promise<StatsProgressResponse> {
  if (isDemoMode()) {
    return demoGetHabitProgress(habitId, period);
  }

  const response = await apiFetch<unknown>(
    `/api/v1/stats/habits/${habitId}/progress?period=${period}`,
  );
  return statsProgressResponseSchema.parse(response);
}

export async function subscribePush(data: PushSubscribeRequest): Promise<PushSubscribeResponse> {
  pushSubscribeRequestSchema.parse(data);

  if (isDemoMode()) {
    return demoSubscribePush(data);
  }

  const response = await apiFetch<unknown>("/api/v1/push/subscribe", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return pushSubscribeResponseSchema.parse(response);
}

export async function unsubscribePush(endpoint?: string): Promise<void> {
  if (isDemoMode()) {
    return;
  }

  await apiFetch("/api/v1/push/subscribe", {
    method: "DELETE",
    body: JSON.stringify(endpoint ? { endpoint } : {}),
  });
}

export async function sendPushTest(): Promise<PushTestResponse> {
  if (isDemoMode()) {
    return { sent: false };
  }

  const response = await apiFetch<unknown>("/api/v1/push/test", {
    method: "POST",
  });
  return pushTestResponseSchema.parse(response);
}

export async function sendCoachChat(body: CoachChatRequest): Promise<CoachChatResponse> {
  if (isDemoMode()) {
    return demoSendCoachChat(body);
  }

  try {
    const response = await apiFetch<unknown>("/api/v1/coach/chat", {
      method: "POST",
      body: JSON.stringify(coachChatRequestSchema.parse(body)),
    });
    return coachChatResponseSchema.parse(response);
  } catch (err) {
    if (err instanceof ClientApiError) {
      throw err;
    }
    throw new ClientApiError(
      "Сервер не отвечает. Запустите pnpm dev (API + Docker) или pnpm dev:demo",
      0,
      "SERVICE_UNAVAILABLE",
    );
  }
}

export async function enterDemoShowcase(): Promise<AuthResponse> {
  if (!isDemoMode()) {
    throw new ClientApiError("Демо доступно только без подключённого API", 400);
  }

  return demoEnterShowcase();
}
