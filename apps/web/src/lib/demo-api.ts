import { buildDailyPlan, calibrateHabit, canSkipThisWeek, computeEarlyRiseWindowState, computeGlobalStreak, computeHabitStreak, computeNextEnglishDay, computeNextGoal, isAbstinenceTimerHabit, isEarlyRiseEnforcementActive, isWarmupDay, isWeekendDate, previewDayStatusForProgression, recalculateLightGoal, resolveCheckinStatus, resolveForeignLanguageCheckinStatus, resolveWarmupAnchor, resolveWarmupDayInfo, sumEnglishWatchSecondsToMinutes, sumMinutesHabitValueForTodayStats, usesAbstinenceStreakRules, type CalibrationProfile } from "@mytodo/domain";
import { pagesReadTodayInBook } from "../features/books/bookReadingProgress";
import {
  AWARENESS_SESSION_MIN,
  SESSION_TARGET_MIN,
  computeSessionCompletionMinutes,
  sessionBudgetMinutes,
  sessionTotalSeconds,
  SOCIAL_MEDIA_MIN_GOAL,
  computeDailyBudgetMin,
  resolveEnglishMinimumWatchSec,
  getWarmupDayMessage,
  ENGLISH_LESSON_COUNT,
  ENGLISH_LESSON_CATALOG,
  englishLessonSeedId,
  getEnglishLessonByDay,
  seedToEnglishLessonResponse,
  HABIT_TEMPLATE_IDS,
  HABIT_TEMPLATES,
  isStrengthWorkoutHabit,
  isNutritionHabit,
  isEarlyRiseCategoryKey,
  isForeignLanguageHabit,
  isCompanionLightHabit,
  isMeditationHabit,
  isKnownNutritionIngredientId,
  isKnownNutritionRecipeId,
  NUTRITION_MIN_INGREDIENTS,
  MEDITATION_DAILY_GOAL_MIN,
  resolveHabitDisplayName,
  resolveHabitIcon,
  resolveStrengthProgressionLevel,
  strengthDailyGoalMinutes,
  type CustomHabitUnit,
  type HabitCategoryKey,
  type HabitTemplateId,
  todayDarkResponseSchema,
  todayLightResponseSchema,
  type DayColorValue,
  type AuthResponse,
  type CheckinResponse,
  type CreateCheckinRequest,
  type CreateHabitRequest,
  type EnglishSettingsResponse,
  type EnglishTodayResponse,
  type EnglishCompleteRequest,
  type EnglishCompleteResponse,
  type EnglishSkipResponse,
  type EnglishHistoryResponse,
  type HabitResponse,
  type HabitSessionActiveResponse,
  type HabitSessionCompleteResponse,
  type HabitSessionResponse,
  type HabitReadingProgress,
  type HabitNutritionLog,
  type PutNutritionTodayRequest,
  type SelectHabitBookRequest,
  getKnownBookPageCount,
  isKnownBookId,
  type LoginRequest,
  type CompleteHabitSessionRequest,
  type PatchEnglishSettingsRequest,
  type PatchMeRequest,
  type PushSubscribeRequest,
  type PushSubscribeResponse,
  type RegisterRequest,
  type StartHabitSessionRequest,
  type ProgressPeriod,
  type StatsCalendarResponse,
  type StatsMonthResponse,
  type StatsProgressResponse,
  type StatsSide,
  type StatsWeekResponse,
  type TodayDarkHabit,
  type TodayDarkResponse,
  type TodayLightHabit,
  type TodayLightResponse,
  type UserProfile,
  COACH_DAILY_MESSAGE_LIMIT,
  resolveDarkCoachReply,
  isCoachEligibleDarkHabit,
  type CoachChatRequest,
  type CoachChatResponse,
  type DoomScrollPlatform,
  type DoomScrollSessionResponse,
  type DoomScrollStopResponse,
  type StartDoomScrollRequest,
  DOOM_SCROLL_DURATION_MIN,
} from "@mytodo/shared";
import { setTokens } from "./auth-storage";
import { DEMO_EMAIL, DEMO_PASSWORD } from "./demo-mode";

const DEMO_STORAGE_KEY = "mytodo_demo_state";
const DEMO_ACCESS_TOKEN = "demo-access-token";
const DEMO_REFRESH_TOKEN = "demo-refresh-token";
/** Bump when showcase seed changes — existing localStorage is refreshed on load. */
const DEMO_STATE_VERSION = 8;

type DemoReadingProgress = HabitReadingProgress;

function normalizeReadingProgress(reading: DemoReadingProgress): DemoReadingProgress {
  return {
    ...reading,
    last_read_page: reading.last_read_page ?? 1,
    timer_remaining_seconds: reading.timer_remaining_seconds ?? null,
    timer_saved_date: reading.timer_saved_date ?? null,
    reader_day_start_page: reading.reader_day_start_page ?? null,
    reader_day_date: reading.reader_day_date ?? null,
  };
}

function normalizeReadingByHabitId(
  readingByHabitId: Record<string, DemoReadingProgress>,
): Record<string, DemoReadingProgress> {
  return Object.fromEntries(
    Object.entries(readingByHabitId).map(([habitId, reading]) => [
      habitId,
      normalizeReadingProgress(reading),
    ]),
  );
}

type DemoEnglishProgress = {
  date: string;
  lesson_day_number: number;
  status: "success" | "fail" | "skipped" | "pending";
  watched_sec: number;
};

type DemoEnglishState = EnglishSettingsResponse & {
  selected_lesson_day?: number | null;
};

type DemoDoomScrollSession = {
  id: string;
  habit_id: string;
  started_at: string;
  ends_at: string;
  duration_min: number;
  completed: boolean;
  platform: DoomScrollPlatform | null;
};

type DemoState = {
  version: number;
  user: UserProfile;
  habits: HabitResponse[];
  english: DemoEnglishState;
  englishProgress: DemoEnglishProgress[];
  checkins: CheckinResponse[];
  sessions: DemoHabitSession[];
  doomScrollSessions: DemoDoomScrollSession[];
  readingByHabitId: Record<string, DemoReadingProgress>;
  nutritionByHabitId: Record<string, HabitNutritionLog>;
  coachChatUsage?: { date: string; count: number };
};

type DemoHabitSession = Omit<HabitSessionResponse, "remaining_seconds" | "is_paused"> & {
  paused_at?: string | null;
  paused_remaining_seconds?: number | null;
};

function nowIso(): string {
  return new Date().toISOString();
}

function trialEndsIso(): string {
  const date = new Date();
  date.setDate(date.getDate() + 3);
  return date.toISOString();
}

function defaultTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "Europe/Moscow";
}

function buildUser(input: {
  email: string;
  name: string;
  age?: number;
  gender?: UserProfile["gender"];
  onboarding_completed?: boolean;
}): UserProfile {
  const harshness = 1;
  return {
    id: crypto.randomUUID(),
    email: input.email,
    name: input.name,
    age: input.age ?? 25,
    gender: input.gender ?? "other",
    weight_kg: null,
    height_cm: null,
    free_time_min: null,
    daily_budget_min: 60,
    timezone: defaultTimezone(),
    wake_time: null,
    sleep_time: null,
    pomodoro_work_min: 25,
    pomodoro_break_min: 5,
    pomodoro_long_break_min: 15,
    harshness_level: harshness,
    role: "user",
    onboarding_completed: input.onboarding_completed ?? false,
    trial_ends_at: trialEndsIso(),
    silence_mode_until: null,
    silence_mode_active: false,
    effective_harshness_level: harshness,
    pending_timezone: null,
    pending_timezone_from: null,
    created_at: nowIso(),
    onboarding_completed_at: null,
  };
}

function defaultEnglish(): DemoEnglishState {
  return {
    is_enabled: false,
    current_day: 1,
    started_at: null,
    selected_lesson_day: null,
  };
}

function toCalibrationProfile(user: UserProfile): CalibrationProfile {
  return {
    dailyBudgetMin: user.daily_budget_min,
    age: user.age ?? 30,
    gender: user.gender ?? "male",
    weightKg: user.weight_kg ?? 70,
    heightCm: user.height_cm ?? 175,
  };
}

function habitToIdentity(habit: HabitResponse) {
  return {
    name: habit.name,
    unit: habit.unit as CustomHabitUnit | import("@mytodo/shared").HabitUnit,
    templateId: habit.template_id,
    categoryKey: habit.category_key,
  };
}

function normalizeDemoHabitGoals(state: DemoState): DemoState {
  const profile = toCalibrationProfile(state.user);
  const activeLightCount = state.habits.filter((habit) => habit.side === "light" && habit.is_active).length;

  const habits = state.habits.map((habit) => {
    if (habit.side !== "light" || !habit.is_active) {
      return habit;
    }

    if (isStrengthWorkoutHabit(habit)) {
      const level = resolveStrengthProgressionLevel(
        habit.baseline_value === 4 && habit.current_goal === 4 ? 0 : habit.baseline_value,
        habit.current_goal,
      );
      const expectedGoal = strengthDailyGoalMinutes(level);
      if (habit.baseline_value === level && habit.current_goal === expectedGoal) {
        return habit;
      }

      return { ...habit, baseline_value: level, current_goal: expectedGoal };
    }

    if (isMeditationHabit(habit)) {
      if (
        habit.current_goal === MEDITATION_DAILY_GOAL_MIN &&
        habit.baseline_value === MEDITATION_DAILY_GOAL_MIN &&
        habit.growth_step === 0
      ) {
        return habit;
      }

      return {
        ...habit,
        baseline_value: MEDITATION_DAILY_GOAL_MIN,
        current_goal: MEDITATION_DAILY_GOAL_MIN,
        growth_step: 0,
      };
    }

    const recommendedGoal = recalculateLightGoal(
      habit.baseline_value,
      habitToIdentity(habit),
      profile,
      Math.max(activeLightCount, 1),
    );

    if (habit.current_goal >= recommendedGoal) {
      return habit;
    }

    return {
      ...habit,
      current_goal: recommendedGoal,
    };
  });

  return { ...state, habits };
}

function syncTemplateHabitNames(state: DemoState): DemoState {
  const habits = state.habits.map((habit) => {
    const name = demoHabitDisplayName(habit);

    return name === habit.name ? habit : { ...habit, name };
  });

  return habits === state.habits ? state : { ...state, habits };
}

function demoHabitDisplayName(habit: HabitResponse): string {
  return resolveHabitDisplayName({
    name: habit.name,
    template_id: habit.template_id,
    is_custom: habit.is_custom,
  });
}

function loadState(): DemoState | null {
  try {
    const raw = localStorage.getItem(DEMO_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DemoState;
    if ((parsed.version ?? 1) < DEMO_STATE_VERSION) {
      const fresh = buildShowcaseState();
      saveState(fresh);
      return fresh;
    }
    return syncTemplateHabitNames(
      normalizeDemoHabitGoals({
        ...parsed,
        checkins: parsed.checkins ?? [],
        sessions: parsed.sessions ?? [],
        doomScrollSessions: parsed.doomScrollSessions ?? [],
        readingByHabitId: normalizeReadingByHabitId(parsed.readingByHabitId ?? {}),
        nutritionByHabitId: parsed.nutritionByHabitId ?? {},
        englishProgress: parsed.englishProgress ?? [],
      }),
    );
  } catch {
    return null;
  }
}

function saveState(state: DemoState): void {
  localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
}

function ensureState(): DemoState {
  const existing = loadState();
  if (existing) return existing;

  const state: DemoState = {
    version: DEMO_STATE_VERSION,
    user: buildUser({ email: DEMO_EMAIL, name: "Демо-воин" }),
    habits: [],
    english: defaultEnglish(),
    englishProgress: [],
    checkins: [],
    sessions: [],
    doomScrollSessions: [],
    readingByHabitId: {},
    nutritionByHabitId: {},
  };
  saveState(state);
  return state;
}

function toAuthResponse(user: UserProfile): AuthResponse {
  setTokens(DEMO_ACCESS_TOKEN, DEMO_REFRESH_TOKEN);
  return {
    user,
    access_token: DEMO_ACCESS_TOKEN,
    refresh_token: DEMO_REFRESH_TOKEN,
  };
}

function resolveTemplateIcon(templateId: keyof typeof HABIT_TEMPLATES): string | null {
  const icon = HABIT_TEMPLATES[templateId].icon;
  return icon.length <= 32 ? icon : null;
}

function createHabitResponse(
  user: UserProfile,
  data: CreateHabitRequest,
  createdAt = nowIso(),
  activeLightHabitsIncludingNew = 1,
): HabitResponse {
  const profile = toCalibrationProfile(user);

  if ("template_id" in data) {
    const template = HABIT_TEMPLATES[data.template_id];
    const calibrated = calibrateHabit({
      kind: "template",
      templateId: data.template_id,
      template,
      baselineValue: data.baseline_value ?? 0,
      profile,
      activeLightHabitsIncludingNew,
    });

    return {
      id: crypto.randomUUID(),
      user_id: user.id,
      name: calibrated.name,
      type: calibrated.type,
      side: calibrated.side,
      unit: calibrated.unit,
      baseline_value: calibrated.baselineValue,
      current_goal: calibrated.currentGoal,
      growth_step: calibrated.growthStep,
      progression_interval_days: calibrated.progressionIntervalDays,
      success_days_at_goal: calibrated.successDaysAtGoal,
      progression_direction: calibrated.progressionDirection,
      phase: calibrated.phase,
      last_relapse_at: calibrated.lastRelapseAt?.toISOString() ?? null,
      allows_weekly_skip: calibrated.allowsWeeklySkip,
      is_custom: false,
      icon: data.icon ?? resolveTemplateIcon(data.template_id),
      is_active: true,
      template_id: data.template_id,
      category_key: calibrated.categoryKey,
      harshness_level: user.harshness_level,
      created_at: createdAt,
    };
  }

  const calibrated = calibrateHabit({
    kind: "custom",
    name: data.name,
    unit: data.unit,
    baselineValue: data.baseline_value,
    categoryKey: data.category_key,
    profile,
    activeLightHabitsIncludingNew,
    icon: data.icon,
  });

  return {
    id: crypto.randomUUID(),
    user_id: user.id,
    name: calibrated.name,
    type: calibrated.type,
    side: calibrated.side,
    unit: calibrated.unit,
    baseline_value: calibrated.baselineValue,
    current_goal: calibrated.currentGoal,
    growth_step: calibrated.growthStep,
    progression_interval_days: calibrated.progressionIntervalDays,
    success_days_at_goal: calibrated.successDaysAtGoal,
    progression_direction: calibrated.progressionDirection,
    phase: calibrated.phase,
    last_relapse_at: calibrated.lastRelapseAt?.toISOString() ?? null,
    allows_weekly_skip: calibrated.allowsWeeklySkip,
    is_custom: true,
    icon: calibrated.icon,
    is_active: true,
    template_id: calibrated.templateId,
    category_key: calibrated.categoryKey,
    harshness_level: user.harshness_level,
    created_at: createdAt,
  };
}

function applyPatchMe(user: UserProfile, patch: PatchMeRequest): UserProfile {
  const next: UserProfile = { ...user, ...patch };
  const wasCompleted = user.onboarding_completed;

  if (patch.free_time_min !== undefined) {
    next.daily_budget_min = computeDailyBudgetMin(patch.free_time_min);
  }

  if (patch.harshness_level !== undefined) {
    next.effective_harshness_level = patch.harshness_level;
  }

  const merged = {
    weight_kg: patch.weight_kg ?? next.weight_kg,
    height_cm: patch.height_cm ?? next.height_cm,
    free_time_min: patch.free_time_min ?? next.free_time_min,
    wake_time: patch.wake_time ?? next.wake_time,
    sleep_time: patch.sleep_time ?? next.sleep_time,
  };

  next.onboarding_completed =
    merged.weight_kg !== null &&
    merged.height_cm !== null &&
    merged.free_time_min !== null &&
    merged.wake_time !== null &&
    merged.sleep_time !== null;

  if (next.onboarding_completed && !wasCompleted) {
    next.onboarding_completed_at = nowIso();
  }

  return next;
}

export function demoLogin(_data: LoginRequest): AuthResponse {
  const state = loadState();
  if (!state?.user.onboarding_completed || (state.version ?? 1) < DEMO_STATE_VERSION) {
    saveState(buildShowcaseState());
  }
  return toAuthResponse(ensureState().user);
}

export function demoEnterShowcase(): AuthResponse {
  saveState(buildShowcaseState());
  return toAuthResponse(ensureState().user);
}

export function demoRegister(data: RegisterRequest): AuthResponse {
  const user = buildUser({
    email: data.email.trim() || DEMO_EMAIL,
    name: data.name.trim() || "Демо-воин",
    age: data.age,
    gender: data.gender,
    onboarding_completed: false,
  });

  saveState({
    version: DEMO_STATE_VERSION,
    user,
    habits: [],
    english: defaultEnglish(),
    englishProgress: [],
    checkins: [],
    sessions: [],
    doomScrollSessions: [],
    readingByHabitId: {},
    nutritionByHabitId: {},
  });

  return toAuthResponse(user);
}

export function demoLogout(): void {
  // Keep demo profile in storage; only tokens are cleared by caller.
}

export function demoGetMe(): UserProfile {
  return ensureState().user;
}

export function demoUpdateMe(patch: PatchMeRequest): UserProfile {
  const state = ensureState();
  state.user = applyPatchMe(state.user, patch);
  saveState(state);
  return state.user;
}

export function demoCreateHabit(data: CreateHabitRequest): HabitResponse {
  const state = ensureState();

  if (!state.user.onboarding_completed) {
    throw new Error("Complete onboarding before creating habits");
  }

  const activeLightCount =
    state.habits.filter((habit) => habit.side === "light" && habit.is_active).length + 1;
  const habit = createHabitResponse(state.user, data, nowIso(), activeLightCount);
  state.habits.push(habit);
  saveState(state);
  return habit;
}

export function demoListHabits(side?: StatsSide): HabitResponse[] {
  const state = ensureState();
  return state.habits.filter(
    (habit) => habit.is_active && (side === undefined || habit.side === side),
  );
}

export function demoUpdateEnglishSettings(
  patch: PatchEnglishSettingsRequest,
): EnglishSettingsResponse {
  const state = ensureState();

  if (patch.is_enabled !== undefined) {
    state.english.is_enabled = patch.is_enabled;
    state.english.started_at = patch.is_enabled
      ? new Date().toISOString().slice(0, 10)
      : null;
  }

  saveState(state);
  return state.english;
}

function resolveDemoActiveLessonDay(state: DemoState): number {
  return state.english.selected_lesson_day ?? state.english.current_day;
}

function getDemoEnglishProgressForLesson(state: DemoState, date: string, lessonDayNumber: number) {
  return (
    state.englishProgress.find(
      (row) => row.date === date && row.lesson_day_number === lessonDayNumber,
    ) ?? null
  );
}

function upsertDemoEnglishProgress(
  state: DemoState,
  entry: DemoEnglishProgress,
): DemoState {
  const without = state.englishProgress.filter(
    (row) => !(row.date === entry.date && row.lesson_day_number === entry.lesson_day_number),
  );
  return {
    ...state,
    englishProgress: [...without, entry],
  };
}

function listDemoSkippedDates(state: DemoState): string[] {
  return state.englishProgress
    .filter((row) => row.status === "skipped")
    .map((row) => row.date)
    .sort();
}

function requireDemoEnglishEnabled(state: DemoState): void {
  if (!state.english.is_enabled) {
    throw new Error("English module is disabled");
  }
}

function toDemoDayStatus(
  status?: DemoEnglishProgress["status"] | null,
): "success" | "fail" | "skipped" | null {
  if (status === "success" || status === "fail" || status === "skipped") {
    return status;
  }
  return null;
}

function syncDemoEnglishDay(state: DemoState): DemoState {
  if (!state.english.is_enabled) {
    return state;
  }

  const today = todayDate();
  let currentDay = state.english.current_day;
  let changed = false;

  while (currentDay < ENGLISH_LESSON_COUNT) {
    const completedOn = state.englishProgress
      .filter((row) => row.status === "success" && row.lesson_day_number === currentDay)
      .map((row) => row.date)
      .sort()
      .at(-1);

    if (!completedOn || completedOn >= today) {
      break;
    }

    const nextDay = computeNextEnglishDay(currentDay, "success");
    if (nextDay === currentDay || nextDay > ENGLISH_LESSON_COUNT) {
      break;
    }

    currentDay = nextDay;
    changed = true;
  }

  if (!changed) {
    return state;
  }

  return {
    ...state,
    english: {
      ...state.english,
      current_day: currentDay,
      selected_lesson_day: null,
    },
  };
}

function findDemoForeignLanguageHabit(state: DemoState) {
  return (
    state.habits.find(
      (habit) =>
        habit.is_active &&
        isForeignLanguageHabit({ category_key: habit.category_key, name: habit.name }),
    ) ?? null
  );
}

function reopenDemoForeignLanguageCheckin(
  state: DemoState,
  habitId: string,
  date: string,
): DemoState {
  const index = state.checkins.findIndex(
    (checkin) => checkin.habit_id === habitId && checkin.date === date,
  );

  if (index < 0) {
    return state;
  }

  const existing = state.checkins[index]!;
  if (existing.status !== "success") {
    return state;
  }

  return {
    ...state,
    checkins: state.checkins.map((checkin, rowIndex) =>
      rowIndex === index ? { ...checkin, status: "pending" } : checkin,
    ),
  };
}

function resetDemoEnglishLessonTaskForToday(
  state: DemoState,
  date: string,
  lessonDayNumber: number,
): DemoState {
  return {
    ...state,
    englishProgress: state.englishProgress.map((row) =>
      row.date === date &&
      row.lesson_day_number === lessonDayNumber &&
      row.status === "success"
        ? { ...row, status: "pending" }
        : row,
    ),
  };
}

function removeDemoTodayCheckin(state: DemoState, habitId: string, date: string): DemoState {
  return {
    ...state,
    checkins: state.checkins.filter(
      (checkin) => !(checkin.habit_id === habitId && checkin.date === date),
    ),
  };
}

function markDemoForeignLanguageDayCompleteFromVideo(
  state: DemoState,
  habit: HabitResponse,
  date: string,
): DemoState {
  const existingIndex = state.checkins.findIndex(
    (checkin) => checkin.habit_id === habit.id && checkin.date === date,
  );
  const existing = existingIndex >= 0 ? state.checkins[existingIndex]! : null;

  if (existing?.status === "skipped" || existing?.status === "success") {
    return state;
  }

  const value = existing?.value ?? 0;
  const checkin: CheckinResponse = {
    id: existing?.id ?? crypto.randomUUID(),
    habit_id: habit.id,
    date,
    status: "success",
    value,
    updated_at: new Date().toISOString(),
    current_goal: habit.current_goal,
    preview_next_goal: demoPreviewNextGoal(habit, "success"),
  };

  if (existingIndex >= 0) {
    return {
      ...state,
      checkins: state.checkins.map((row, index) => (index === existingIndex ? checkin : row)),
    };
  }

  return {
    ...state,
    checkins: [...state.checkins, checkin],
  };
}

function reconcileDemoForeignLanguageMinutes(state: DemoState): DemoState {
  return state;
}

export function demoGetEnglishToday(): EnglishTodayResponse {
  const before = ensureState();
  let state = syncDemoEnglishDay(before);
  if (state.english.current_day !== before.english.current_day) {
    saveState(state);
  }

  if (!state.english.is_enabled) {
    return { enabled: false };
  }

  state = reconcileDemoForeignLanguageMinutes(state);
  saveState(state);

  const lessonDay = resolveDemoActiveLessonDay(state);
  const seed = getEnglishLessonByDay(lessonDay);
  if (!seed) {
    throw new Error("Lesson not found");
  }

  const today = todayDate();
  const progress = getDemoEnglishProgressForLesson(state, today, lessonDay);
  const dayStatus = toDemoDayStatus(progress?.status);
  const selectedLessonId =
    state.english.selected_lesson_day != null
      ? englishLessonSeedId(state.english.selected_lesson_day)
      : null;

  return {
    enabled: true,
    current_day: state.english.current_day,
    lesson: seedToEnglishLessonResponse(seed),
    selected_lesson_id: selectedLessonId,
    day_status: dayStatus,
    watched_sec: progress?.watched_sec ?? 0,
    preview_next_day:
      lessonDay === state.english.current_day && dayStatus !== null
        ? computeNextEnglishDay(state.english.current_day, dayStatus)
        : state.english.current_day,
  };
}

export function demoGetEnglishCatalog(): import("@mytodo/shared").EnglishCatalogResponse {
  const state = ensureState();
  requireDemoEnglishEnabled(state);

  const today = todayDate();
  const selectedLessonId =
    state.english.selected_lesson_day != null
      ? englishLessonSeedId(state.english.selected_lesson_day)
      : null;

  return {
    current_day: state.english.current_day,
    selected_lesson_id: selectedLessonId,
    lessons: ENGLISH_LESSON_CATALOG.map((seed) => {
      const progress = getDemoEnglishProgressForLesson(state, today, seed.dayNumber);
      return {
        ...seedToEnglishLessonResponse(seed),
        today_watched_sec: progress?.watched_sec ?? 0,
        today_status: toDemoDayStatus(progress?.status),
      };
    }),
  };
}

export function demoRecordEnglishWatch(
  data: import("@mytodo/shared").EnglishWatchRequest,
): import("@mytodo/shared").EnglishWatchResponse {
  let state = ensureState();
  requireDemoEnglishEnabled(state);

  const lessonDay = resolveDemoActiveLessonDay(state);
  const seed = getEnglishLessonByDay(lessonDay);
  if (!seed) {
    throw new Error("Lesson not found");
  }

  const today = todayDate();
  const existing = getDemoEnglishProgressForLesson(state, today, lessonDay);

  if (existing?.status === "success" || existing?.status === "skipped" || existing?.status === "fail") {
    saveState(state);
    return { lesson_id: englishLessonSeedId(lessonDay), watched_sec: existing.watched_sec };
  }

  const watchedSec = Math.max(existing?.watched_sec ?? 0, data.watched_sec);
  state = upsertDemoEnglishProgress(state, {
    date: today,
    lesson_day_number: lessonDay,
    status: "pending",
    watched_sec: watchedSec,
  });
  saveState(state);

  return { lesson_id: englishLessonSeedId(lessonDay), watched_sec: watchedSec };
}

export function demoSelectEnglishLesson(
  data: import("@mytodo/shared").EnglishSelectLessonRequest,
): import("@mytodo/shared").EnglishSelectLessonResponse {
  let state = ensureState();
  requireDemoEnglishEnabled(state);

  const seed = ENGLISH_LESSON_CATALOG.find(
    (lesson) => englishLessonSeedId(lesson.dayNumber) === data.lesson_id,
  );
  if (!seed) {
    throw new Error("Lesson not found");
  }

  const previousLessonDay = resolveDemoActiveLessonDay(state);
  const today = todayDate();
  if (previousLessonDay !== seed.dayNumber) {
    const habit = findDemoForeignLanguageHabit(state);
    if (habit) {
      state = reopenDemoForeignLanguageCheckin(state, habit.id, today);
    }
    state = resetDemoEnglishLessonTaskForToday(state, today, seed.dayNumber);
  }

  const progress = getDemoEnglishProgressForLesson(state, today, seed.dayNumber);
  const dayStatus = toDemoDayStatus(progress?.status);

  state = {
    ...state,
    english: {
      ...state.english,
      selected_lesson_day: seed.dayNumber,
    },
  };
  saveState(state);

  return {
    selected_lesson_id: englishLessonSeedId(seed.dayNumber),
    lesson: seedToEnglishLessonResponse(seed),
    current_day: state.english.current_day,
    day_status: dayStatus,
    watched_sec: progress?.watched_sec ?? 0,
    preview_next_day:
      seed.dayNumber === state.english.current_day && dayStatus !== null
        ? computeNextEnglishDay(state.english.current_day, dayStatus)
        : state.english.current_day,
    habit_complete: dayStatus === "success",
  };
}

export function demoCompleteEnglishLesson(
  data: EnglishCompleteRequest,
): EnglishCompleteResponse {
  let state = ensureState();
  requireDemoEnglishEnabled(state);

  const lessonDay = resolveDemoActiveLessonDay(state);
  const seed = getEnglishLessonByDay(lessonDay);
  if (!seed) {
    throw new Error("Lesson not found");
  }

  const today = todayDate();
  const existing = getDemoEnglishProgressForLesson(state, today, lessonDay);

  if (existing?.status === "skipped") {
    throw new Error("Cannot complete a skipped day");
  }

  if (existing?.status === "fail") {
    throw new Error("Cannot complete a failed day");
  }

  const minimumWatchSec = resolveEnglishMinimumWatchSec(seed.durationSec, data.watched_sec);
  if (data.watched_sec < minimumWatchSec) {
    throw new Error(`watched_sec must be at least ${minimumWatchSec}`);
  }

  const wasAlreadySuccess = existing?.status === "success";

  state = upsertDemoEnglishProgress(state, {
    date: today,
    status: "success",
    watched_sec: data.watched_sec,
    lesson_day_number: lessonDay,
  });

  if (!wasAlreadySuccess) {
    const habit = findDemoForeignLanguageHabit(state);
    if (habit) {
      state = markDemoForeignLanguageDayCompleteFromVideo(state, habit, today);
    }
  }

  saveState(state);

  return {
    current_day: state.english.current_day,
    day_status: "success",
    watched_sec: data.watched_sec,
    preview_next_day:
      lessonDay === state.english.current_day
        ? computeNextEnglishDay(state.english.current_day, "success")
        : state.english.current_day,
  };
}

export function demoSkipEnglishLesson(): EnglishSkipResponse {
  let state = ensureState();
  requireDemoEnglishEnabled(state);

  const scheduledDay = state.english.current_day;
  const seed = getEnglishLessonByDay(scheduledDay);
  if (!seed) {
    throw new Error("Lesson not found");
  }

  const today = todayDate();
  const existing = getDemoEnglishProgressForLesson(state, today, scheduledDay);

  if (existing?.status === "success") {
    throw new Error("Cannot skip after completing today's lesson");
  }

  if (existing?.status !== "skipped") {
    const skippedDates = listDemoSkippedDates(state).filter((date) => date !== today);
    if (!canSkipThisWeek(skippedDates, today)) {
      throw new Error("Maximum 2 skips per calendar week allowed");
    }
  }

  state = upsertDemoEnglishProgress(state, {
    date: today,
    status: "skipped",
    watched_sec: existing?.watched_sec ?? 0,
    lesson_day_number: scheduledDay,
  });
  saveState(state);

  return {
    current_day: state.english.current_day,
    day_status: "skipped",
    preview_next_day: computeNextEnglishDay(state.english.current_day, "skipped"),
  };
}

export function demoGetEnglishHistory(): EnglishHistoryResponse {
  const state = ensureState();
  requireDemoEnglishEnabled(state);

  const items = state.englishProgress
    .filter((row) => row.status === "success")
    .sort((left, right) => right.date.localeCompare(left.date))
    .map((row) => {
      const seed = getEnglishLessonByDay(row.lesson_day_number);
      return {
        date: row.date,
        status: "success" as const,
        watched_sec: row.watched_sec,
        lesson: seed ? seedToEnglishLessonResponse(seed) : null,
      };
    });

  return { items };
}

export function getDemoPrefillCredentials() {
  return { email: DEMO_EMAIL, password: DEMO_PASSWORD };
}

function addDaysLocal(date: string, delta: number): string {
  const parsed = new Date(`${date}T12:00:00`);
  parsed.setDate(parsed.getDate() + delta);
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatLocalDate(input: Date): string {
  const year = input.getFullYear();
  const month = String(input.getMonth() + 1).padStart(2, "0");
  const day = String(input.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function computeDemoDayColor(
  statuses: Array<"success" | "fail" | "pending" | "skipped">,
): DayColorValue {
  if (statuses.length === 0) return "pending";
  if (statuses.some((status) => status === "fail")) return "fail";
  if (statuses.some((status) => status === "pending")) return "pending";
  if (statuses.every((status) => status === "success")) return "success";
  return "skipped";
}

function toDemoProgressionHabit(habit: HabitResponse) {
  return {
    type: habit.type,
    side: habit.side,
    currentGoal: habit.current_goal,
    growthStep: habit.growth_step,
    progressionDirection: habit.progression_direction,
    progressionIntervalDays: habit.progression_interval_days,
    successDaysAtGoal: habit.success_days_at_goal,
    categoryKey: habit.category_key,
    name: habit.name,
    baselineValue: habit.baseline_value,
    minGoal: habit.template_id === "social_media" ? SOCIAL_MEDIA_MIN_GOAL : undefined,
  };
}

function demoPreviewNextGoal(
  habit: HabitResponse,
  status: CheckinResponse["status"] | undefined,
  value: number | null = null,
): number {
  const dayStatus = previewDayStatusForProgression(
    {
      type: habit.type,
      side: habit.side,
      currentGoal: habit.current_goal,
    },
    status,
    value,
  );

  return computeNextGoal(toDemoProgressionHabit(habit), dayStatus);
}

function makeCheckin(
  habit: HabitResponse,
  date: string,
  status: CheckinResponse["status"],
  value: number | null,
): CheckinResponse {
  const previewNextGoal = demoPreviewNextGoal(habit, status, value);
  return {
    id: crypto.randomUUID(),
    habit_id: habit.id,
    date,
    status,
    value,
    updated_at: nowIso(),
    current_goal: habit.current_goal,
    preview_next_goal: previewNextGoal,
  };
}

const SHOWCASE_TEMPLATE_BASELINES: Record<HabitTemplateId, number> = {
  books: 5,
  running: 20,
  plank: 30,
  smoking: 15,
  sugar: 5,
  sweets: 3,
  social_media: 45,
  nail_biting: 0,
};

const SHOWCASE_CUSTOM_LIGHT: ReadonlyArray<{
  name: string;
  unit: CustomHabitUnit;
  baseline: number;
  categoryKey: HabitCategoryKey;
}> = [
  { name: "Медитация", unit: "minutes", baseline: 1, categoryKey: "meditation" },
  { name: "Иностранный язык", unit: "minutes", baseline: 15, categoryKey: "language" },
  { name: "Дневник благодарности", unit: "minutes", baseline: 5, categoryKey: "gratitude" },
  { name: "Силовая тренировка", unit: "minutes", baseline: 4, categoryKey: "strength_workout" },
  { name: "Разминка", unit: "minutes", baseline: 10, categoryKey: "stretching" },
  { name: "Программирование", unit: "minutes", baseline: 30, categoryKey: "programming" },
  { name: "Творческий проект", unit: "minutes", baseline: 20, categoryKey: "creative_project" },
  { name: "Ходьба на свежем воздухе", unit: "minutes", baseline: 20, categoryKey: "walking" },
  { name: "Ранний подъём", unit: "minutes", baseline: 0, categoryKey: "early_rise" },
  { name: "Правильное питание", unit: "minutes", baseline: 0, categoryKey: "healthy_nutrition" },
];

function countActiveLightHabits(habits: HabitResponse[]): number {
  return habits.filter((habit) => habit.side === "light" && habit.is_active).length;
}

function addShowcaseTemplateHabit(
  user: UserProfile,
  habits: HabitResponse[],
  templateId: HabitTemplateId,
  createdAt: string,
): HabitResponse {
  const isLight = HABIT_TEMPLATES[templateId].side === "light";
  const habit = createHabitResponse(
    user,
    { template_id: templateId, baseline_value: SHOWCASE_TEMPLATE_BASELINES[templateId] },
    createdAt,
    countActiveLightHabits(habits) + (isLight ? 1 : 0),
  );
  habits.push(habit);
  return habit;
}

function addShowcaseCustomLightHabit(
  user: UserProfile,
  habits: HabitResponse[],
  input: (typeof SHOWCASE_CUSTOM_LIGHT)[number],
  createdAt: string,
): HabitResponse {
  const habit = createHabitResponse(
    user,
    {
      name: input.name,
      unit: input.unit,
      baseline_value: input.baseline,
      category_key: input.categoryKey,
    },
    createdAt,
    countActiveLightHabits(habits) + 1,
  );
  habits.push(habit);
  return habit;
}

function buildShowcaseHabits(user: UserProfile, createdAt: string): HabitResponse[] {
  const habits: HabitResponse[] = [];

  for (const templateId of HABIT_TEMPLATE_IDS) {
    if (HABIT_TEMPLATES[templateId].side === "light") {
      addShowcaseTemplateHabit(user, habits, templateId, createdAt);
    }
  }

  for (const custom of SHOWCASE_CUSTOM_LIGHT) {
    addShowcaseCustomLightHabit(user, habits, custom, createdAt);
  }

  for (const templateId of HABIT_TEMPLATE_IDS) {
    if (HABIT_TEMPLATES[templateId].side === "dark") {
      addShowcaseTemplateHabit(user, habits, templateId, createdAt);
    }
  }

  const byTemplate = (templateId: HabitTemplateId) =>
    habits.find((habit) => habit.template_id === templateId);

  byTemplate("books")!.current_goal = 5;
  byTemplate("running")!.current_goal = 30;
  byTemplate("smoking")!.current_goal = 12;
  byTemplate("social_media")!.current_goal = 30;

  const earlyRise = habits.find((habit) => habit.category_key === "early_rise");
  if (earlyRise) {
    earlyRise.current_goal = 5;
  }

  return habits;
}

function buildShowcaseCheckins(): CheckinResponse[] {
  return [];
}

function buildShowcaseState(): DemoState {
  const user = buildUser({
    email: DEMO_EMAIL,
    name: "Алексей",
    age: 28,
    gender: "male",
    onboarding_completed: true,
  });

  user.weight_kg = 78;
  user.height_cm = 180;
  user.free_time_min = 90;
  user.daily_budget_min = computeDailyBudgetMin(90);
  user.wake_time = "07:00";
  user.sleep_time = "23:00";
  user.harshness_level = 2;
  user.effective_harshness_level = 2;

  const createdAt = addDaysLocal(todayDate(), -21) + "T10:00:00.000Z";
  user.created_at = createdAt;
  user.onboarding_completed_at = createdAt;
  const habits = buildShowcaseHabits(user, createdAt);
  const checkins = buildShowcaseCheckins();

  return {
    version: DEMO_STATE_VERSION,
    user,
    habits,
    english: defaultEnglish(),
    englishProgress: [],
    checkins,
    sessions: [],
    doomScrollSessions: [],
    readingByHabitId: {},
    nutritionByHabitId: {},
  };
}

function todayDate(): string {
  return formatLocalDate(new Date());
}

function resolveDemoWarmupAnchor(state: DemoState): Date {
  return resolveWarmupAnchor(
    state.user.onboarding_completed_at ? new Date(state.user.onboarding_completed_at) : null,
    new Date(state.user.created_at),
  );
}

function isDemoWarmupDay(state: DemoState, date: string): boolean {
  return isWarmupDay(resolveDemoWarmupAnchor(state), date, state.user.timezone);
}

function resolveDemoCheckinStatus(
  habit: HabitResponse,
  data: CreateCheckinRequest,
  state: DemoState,
): { status: CheckinResponse["status"]; value: number | null } {
  const date = data.date ?? todayDate();

  if (data.status === "skipped") {
    if (!isDemoWarmupDay(state, date)) {
      const skippedDates = state.checkins
        .filter((row) => row.habit_id === habit.id && row.status === "skipped")
        .map((row) => row.date)
        .filter((skipDate) => skipDate !== date);
      if (!canSkipThisWeek(skippedDates, date)) {
        throw new Error("Максимум 2 пропуска в неделю");
      }
    }
    return { status: "skipped", value: null };
  }

  if (isEarlyRiseCategoryKey(habit.category_key)) {
    const wakeTime = state.user.wake_time;

    const anchor = resolveDemoWarmupAnchor(state);

    if (!isEarlyRiseEnforcementActive(anchor, date, state.user.timezone)) {
      if (data.status === "fail") {
        throw new Error("Сегодня разгонный день — штрафов нет");
      }

      if (!wakeTime) {
        throw new Error("Укажите время подъёма в профиле");
      }

      const window = computeEarlyRiseWindowState(
        wakeTime,
        habit.current_goal,
        new Date(),
        state.user.timezone,
      );

      if (window.phase === "window") {
        return { status: "success", value: habit.current_goal };
      }

      throw new Error(
        window.phase === "before"
          ? `Рано. Окно откроется в ${window.target_wake_time}`
          : "Сегодня подъём по желанию — окно уже закрыто",
      );
    }

    if (!wakeTime) {
      throw new Error("Укажите время подъёма в профиле");
    }

    const window = computeEarlyRiseWindowState(
      wakeTime,
      habit.current_goal,
      new Date(),
      state.user.timezone,
    );

    if (data.status === "fail") {
      if (window.phase !== "expired") {
        throw new Error("Провал доступен только после окончания окна");
      }
      return { status: "fail", value: null };
    }

    if (window.phase === "before") {
      throw new Error(`Рано. Окно откроется в ${window.target_wake_time}`);
    }

    if (window.phase === "expired") {
      throw new Error("Время вышло — отметка недоступна");
    }

    return { status: "success", value: habit.current_goal };
  }

  if (data.status === "fail") {
    if (usesAbstinenceStreakRules(habit.type, habit.phase)) {
      return { status: "fail", value: null };
    }

    throw new Error("Explicit fail status is only allowed for abstinence and early rise habits");
  }

  if (data.value === undefined) {
    return { status: "pending", value: null };
  }

  if (isForeignLanguageHabit({ category_key: habit.category_key, name: habit.name })) {
    const value = data.value;
    return {
      status: resolveForeignLanguageCheckinStatus(value, habit.current_goal),
      value,
    };
  }

  if (habit.type === "target") {
    if (habit.side === "light") {
      return {
        status: data.value >= habit.current_goal ? "success" : "pending",
        value: data.value,
      };
    }

    return {
      status: data.value >= habit.current_goal ? "success" : "fail",
      value: data.value,
    };
  }

  if (habit.type === "limit") {
    const value = data.value;
    return {
      status: resolveCheckinStatus(
        {
          type: habit.type,
          side: habit.side,
          currentGoal: habit.current_goal,
          templateId: habit.template_id,
        },
        { value },
      ),
      value,
    };
  }

  return { status: "pending", value: data.value };
}

function weekStartMonday(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const dayNum = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${dayNum}`;
}

function buildDemoGlobalStreak(state: DemoState, sideHabits: HabitResponse[]): number {
  const today = todayDate();
  const streakHabits = sideHabits.filter((habit) => !isCompanionLightHabit(habit));
  const records = new Map<
    string,
    { date: string; status: "success" | "fail" | "skipped" | "pending" }[]
  >();

  for (const habit of streakHabits) {
    records.set(
      habit.id,
      state.checkins
        .filter((checkin) => checkin.habit_id === habit.id)
        .map((checkin) => ({
          date: checkin.date,
          status: checkin.status,
        })),
    );
  }

  const scopes = streakHabits.map((habit) => ({
    id: habit.id,
    activeFrom: habit.created_at.slice(0, 10),
    type: habit.type,
    phase: habit.phase,
  }));

  return computeGlobalStreak(records, scopes, today);
}

function sumDemoEnglishWatchMinutesToday(state: DemoState, date: string): number {
  return sumEnglishWatchSecondsToMinutes(
    state.englishProgress
      .filter((row) => row.date === date)
      .map((row) => row.watched_sec),
  );
}

function buildTodayStats(
  state: DemoState,
  sideHabits: HabitResponse[],
  checkinsToday: CheckinResponse[],
) {
  const habitIds = new Set(sideHabits.map((habit) => habit.id));
  const scoped = checkinsToday.filter((checkin) => habitIds.has(checkin.habit_id));
  const today = todayDate();
  const weekStart = weekStartMonday(today);
  const completedToday = sideHabits.filter((habit) => {
    if (isCompanionLightHabit(habit)) {
      return false;
    }

    const checkin = scoped.find((row) => row.habit_id === habit.id);
    return checkin?.status === "success";
  }).length;
  const relapsesThisWeek = state.checkins.filter(
    (checkin) =>
      checkin.status === "fail" &&
      habitIds.has(checkin.habit_id) &&
      checkin.date >= weekStart &&
      checkin.date <= today &&
      !isDemoWarmupDay(state, checkin.date),
  ).length;
  const englishWatchMinutes = sumDemoEnglishWatchMinutesToday(state, today);
  const minutesToday = sideHabits.reduce((sum, habit) => {
    const checkin = scoped.find((row) => row.habit_id === habit.id);
    return (
      sum +
      sumMinutesHabitValueForTodayStats(habit, checkin?.value, englishWatchMinutes)
    );
  }, 0);

  return {
    completed_today: completedToday,
    relapses_this_week: relapsesThisWeek,
    minutes_today: minutesToday,
    pomodoros_today: 0,
    streak_days: buildDemoGlobalStreak(state, sideHabits),
  };
}

function creditDemoReadingFromCheckin(
  state: DemoState,
  habit: HabitResponse,
  date: string,
  checkinValue: number,
): void {
  if (habit.template_id !== "books" || checkinValue == null) {
    return;
  }

  const existing = state.readingByHabitId[habit.id];
  if (!existing) {
    return;
  }

  let pagesRead = existing.pages_read;
  let pagesCreditedToday = existing.pages_credited_today;
  let lastCheckinDate = existing.last_checkin_date;

  if (lastCheckinDate !== date) {
    lastCheckinDate = date;
    pagesCreditedToday = 0;
  }

  if (checkinValue > pagesCreditedToday) {
    pagesRead += checkinValue - pagesCreditedToday;
    pagesCreditedToday = checkinValue;
  }

  const pageCount = getKnownBookPageCount(existing.book_id);
  const finishedBook =
    pageCount != null &&
    (pagesRead >= pageCount || existing.last_read_page >= pageCount);
  const completedAt = finishedBook
    ? (existing.completed_at ?? nowIso())
    : existing.completed_at;

  state.readingByHabitId[habit.id] = {
    ...existing,
    pages_read: pagesRead,
    pages_credited_today: pagesCreditedToday,
    last_checkin_date: lastCheckinDate,
    completed_at: completedAt,
    page_count: pageCount,
  };
}

function demoPagesReadToday(reading: DemoReadingProgress, date: string): number {
  const creditedToday =
    reading.last_checkin_date === date ? reading.pages_credited_today : 0;
  if (reading.reader_day_date === date && reading.reader_day_start_page != null) {
    return Math.max(
      creditedToday,
      pagesReadTodayInBook(reading.last_read_page, reading.reader_day_start_page),
    );
  }

  return creditedToday;
}

function upsertDemoBooksCheckinValue(
  state: DemoState,
  habit: HabitResponse,
  date: string,
  value: number,
): void {
  if (habit.template_id !== "books" || value <= 0) {
    return;
  }

  const existingIndex = state.checkins.findIndex(
    (checkin) => checkin.habit_id === habit.id && checkin.date === date,
  );
  const currentValue =
    existingIndex >= 0 ? (state.checkins[existingIndex]!.value ?? 0) : 0;
  const nextValue = Math.max(currentValue, value);
  if (
    nextValue <= currentValue &&
    existingIndex >= 0 &&
    state.checkins[existingIndex]?.status === "success"
  ) {
    return;
  }

  const { status: resolvedStatus, value: resolvedValue } = resolveDemoCheckinStatus(
    habit,
    { habit_id: habit.id, date, value: nextValue },
    state,
  );
  const previewNextGoal = demoPreviewNextGoal(habit, resolvedStatus, resolvedValue);
  const checkin: CheckinResponse = {
    id: existingIndex >= 0 ? state.checkins[existingIndex]!.id : crypto.randomUUID(),
    habit_id: habit.id,
    date,
    status: resolvedStatus,
    value: resolvedValue,
    updated_at: nowIso(),
    current_goal: habit.current_goal,
    preview_next_goal: previewNextGoal,
  };

  if (existingIndex >= 0) {
    state.checkins[existingIndex] = checkin;
  } else {
    state.checkins.push(checkin);
  }

  if (resolvedValue != null) {
    creditDemoReadingFromCheckin(state, habit, date, resolvedValue);
  }
}

function reconcileDemoBooksCheckinFromReading(
  state: DemoState,
  habit: HabitResponse,
  date: string,
): void {
  if (habit.template_id !== "books") {
    return;
  }

  const reading = state.readingByHabitId[habit.id];
  if (!reading) {
    return;
  }

  const pagesToday = demoPagesReadToday(reading, date);
  if (pagesToday <= 0) {
    return;
  }

  upsertDemoBooksCheckinValue(state, habit, date, pagesToday);
}

export function demoSelectHabitBook(
  habitId: string,
  data: SelectHabitBookRequest,
): HabitReadingProgress {
  const state = ensureState();
  const habit = state.habits.find((row) => row.id === habitId && row.is_active);

  if (!habit) {
    throw new Error("Привычка не найдена");
  }

  if (habit.template_id !== "books") {
    throw new Error("Reading progress is only available for books habits");
  }

  if (!isKnownBookId(data.book_id)) {
    throw new Error("Unknown book_id");
  }

  const existing = state.readingByHabitId[habitId];
  const hasBaseline = data.checkin_baseline !== undefined;
  const planDate = hasBaseline ? todayDate() : null;
  const checkinBaseline = Math.max(0, data.checkin_baseline ?? 0);

  if (existing?.book_id === data.book_id) {
    const normalized = normalizeReadingProgress(existing);
    state.readingByHabitId[habitId] = normalized;
    saveState(state);
    return normalized;
  }

  const planDateForReset = todayDate();
  state.checkins = state.checkins.filter(
    (checkin) => !(checkin.habit_id === habitId && checkin.date === planDateForReset),
  );

  const next: DemoReadingProgress = {
    book_id: data.book_id,
    pages_read: 0,
    pages_credited_today: hasBaseline ? checkinBaseline : 0,
    last_read_page: 1,
    timer_remaining_seconds: null,
    timer_saved_date: null,
    reader_day_start_page: null,
    reader_day_date: null,
    last_checkin_date: planDate,
    completed_at: null,
    page_count: getKnownBookPageCount(data.book_id),
  };

  state.readingByHabitId[habitId] = next;
  saveState(state);
  return next;
}

export function demoClearHabitBook(habitId: string): void {
  const state = ensureState();
  const habit = state.habits.find((row) => row.id === habitId && row.is_active);

  if (!habit) {
    throw new Error("Привычка не найдена");
  }

  if (habit.template_id !== "books") {
    throw new Error("Reading progress is only available for books habits");
  }

  const planDate = todayDate();
  state.checkins = state.checkins.filter(
    (checkin) => !(checkin.habit_id === habitId && checkin.date === planDate),
  );
  delete state.readingByHabitId[habitId];
  saveState(state);
}

export function demoResetTodayCheckin(habitId: string, date?: string): void {
  const state = ensureState();
  const planDate = date ?? todayDate();
  saveState(removeDemoTodayCheckin(state, habitId, planDate));
}

export function demoReopenTodayCheckin(habitId: string, date?: string): void {
  const state = ensureState();
  const planDate = date ?? todayDate();
  const index = state.checkins.findIndex(
    (checkin) => checkin.habit_id === habitId && checkin.date === planDate,
  );

  if (index < 0) {
    return;
  }

  const existing = state.checkins[index]!;
  if (existing.status !== "success") {
    return;
  }

  state.checkins[index] = { ...existing, status: "pending" };
  saveState(state);
}

export function demoUpdateReadingBookmark(
  habitId: string,
  data: import("@mytodo/shared").UpdateReadingBookmarkRequest,
): HabitReadingProgress {
  const state = ensureState();
  const habit = state.habits.find((row) => row.id === habitId && row.is_active);

  if (!habit) {
    throw new Error("Привычка не найдена");
  }

  if (habit.template_id !== "books") {
    throw new Error("Reading progress is only available for books habits");
  }

  const existing = state.readingByHabitId[habitId];
  if (!existing) {
    throw new Error("Select a book before setting a bookmark");
  }

  const pageCount = existing.page_count ?? getKnownBookPageCount(existing.book_id);
  const nextLastReadPage =
    data.last_read_page !== undefined
      ? pageCount != null
        ? Math.min(Math.max(1, data.last_read_page), pageCount)
        : Math.max(1, data.last_read_page)
      : existing.last_read_page;
  const finishedBook =
    pageCount != null && nextLastReadPage >= pageCount;
  const next: DemoReadingProgress = {
    ...existing,
    ...(data.last_read_page !== undefined
      ? {
          last_read_page: nextLastReadPage,
        }
      : {}),
    ...(data.timer_remaining_seconds !== undefined
      ? {
          timer_remaining_seconds: Math.max(0, data.timer_remaining_seconds),
          timer_saved_date: data.timer_saved_date ?? todayDate(),
        }
      : {}),
    ...(data.reader_day_start_page !== undefined
      ? { reader_day_start_page: Math.max(1, data.reader_day_start_page) }
      : {}),
    ...(data.reader_day_date !== undefined ? { reader_day_date: data.reader_day_date } : {}),
    ...(finishedBook
      ? { completed_at: existing.completed_at ?? nowIso() }
      : {}),
  };

  state.readingByHabitId[habitId] = next;
  reconcileDemoBooksCheckinFromReading(state, habit, todayDate());
  saveState(state);
  return next;
}

function computeDemoAbstinenceElapsed(lastRelapseAt: string) {
  const totalSeconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(lastRelapseAt).getTime()) / 1000),
  );
  return {
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    total_seconds: totalSeconds,
  };
}

function demoHabitStreakDays(state: DemoState, habit: HabitResponse, planDate: string): number {
  return computeHabitStreak(
    state.checkins
      .filter((row) => row.habit_id === habit.id)
      .map((row) => ({ date: row.date, status: row.status })),
    planDate,
    habit.created_at.slice(0, 10),
    habit.type,
    habit.phase,
  );
}

function mapHabitToTodayLight(
  habit: HabitResponse,
  checkin: CheckinResponse | null,
  reading: DemoReadingProgress | null = null,
  nutritionLog: HabitNutritionLog | null = null,
  state?: DemoState,
  planDate?: string,
): TodayLightHabit {
  const previewNextGoal = demoPreviewNextGoal(habit, checkin?.status, checkin?.value ?? null);
  const displayName = demoHabitDisplayName(habit);
  return {
    ...habit,
    name: displayName,
    icon: resolveHabitIcon({
      icon: habit.icon,
      template_id: habit.template_id,
      category_key: habit.category_key,
      name: displayName,
      side: habit.side,
    }),
    checkin: checkin
      ? {
          id: checkin.id,
          date: checkin.date,
          status: checkin.status,
          value: checkin.value,
          updated_at: checkin.updated_at,
          current_goal: checkin.current_goal,
          preview_next_goal: previewNextGoal,
        }
      : null,
    preview_next_goal: previewNextGoal,
    streak_days:
      state && planDate ? demoHabitStreakDays(state, habit, planDate) : 0,
    ...(habit.template_id === "books" ? { reading } : {}),
    ...(isNutritionHabit(habit) ? { nutrition_log: nutritionLog } : {}),
  };
}

function mapHabitToTodayDark(
  habit: HabitResponse,
  checkin: CheckinResponse | null,
  doomScrollActive: DoomScrollSessionResponse | null = null,
  state?: DemoState,
  planDate?: string,
): TodayDarkHabit {
  return {
    ...mapHabitToTodayLight(habit, checkin, null, null, state, planDate),
    timer:
      isAbstinenceTimerHabit(habit.phase) && habit.last_relapse_at
        ? {
            started_at: habit.last_relapse_at,
            elapsed: computeDemoAbstinenceElapsed(habit.last_relapse_at),
          }
        : null,
    doom_scroll_active: doomScrollActive,
  };
}

function buildDemoWarmupDay(user: UserProfile, planDate: string) {
  const info = resolveWarmupDayInfo({
    onboardingCompletedAt: user.onboarding_completed_at
      ? new Date(user.onboarding_completed_at)
      : null,
    registeredAt: new Date(user.created_at),
    planDate,
    timezone: user.timezone,
    wakeTime: user.wake_time,
    sleepTime: user.sleep_time,
  });
  const harshness = Math.min(3, Math.max(1, user.harshness_level)) as 1 | 2 | 3;

  return {
    active: info.active,
    slot: info.slot,
    message: getWarmupDayMessage(info.slot, harshness),
    early_rise_enforcement: info.earlyRiseEnforcement,
  };
}

function ensureDemoEarlyRiseWeekendSkips(state: DemoState, date: string): void {
  if (!isWeekendDate(date)) {
    return;
  }

  for (const habit of state.habits.filter(
    (row) => row.is_active && row.category_key === "early_rise",
  )) {
    const existing = state.checkins.find(
      (checkin) => checkin.habit_id === habit.id && checkin.date === date,
    );

    if (
      existing &&
      (existing.status === "success" ||
        existing.status === "fail" ||
        existing.status === "skipped")
    ) {
      continue;
    }

    if (existing) {
      existing.status = "skipped";
      existing.value = null;
      existing.updated_at = nowIso();
      continue;
    }

    state.checkins.push(makeCheckin(habit, date, "skipped", null));
  }
}

function buildLightTodayResponse(): TodayLightResponse {
  let state = ensureState();
  const date = todayDate();
  ensureDemoEarlyRiseWeekendSkips(state, date);
  state = reconcileDemoForeignLanguageMinutes(state);
  const sideHabits = state.habits.filter((h) => h.side === "light" && h.is_active);
  for (const habit of sideHabits) {
    reconcileDemoBooksCheckinFromReading(state, habit, date);
  }
  saveState(state);
  const todayCheckins = state.checkins.filter((c) => c.date === date);
  const stats = buildTodayStats(state, sideHabits, todayCheckins);

  return todayLightResponseSchema.parse({
    date,
    greeting_name: state.user.name,
    daily_budget_min: state.user.daily_budget_min,
    minutes_logged_today: stats.minutes_today,
    stats,
    habits: sideHabits.map((habit) => {
      const checkin = todayCheckins.find((c) => c.habit_id === habit.id) ?? null;
      const reading = state.readingByHabitId[habit.id] ?? null;
      const nutritionLog = state.nutritionByHabitId[habit.id] ?? null;
      return mapHabitToTodayLight(habit, checkin, reading, nutritionLog, state, date);
    }),
    daily_plan: buildDemoDailyPlan(state, "light", date),
    warmup_day: buildDemoWarmupDay(state.user, date),
  });
}

function getDemoSocialMediaRemainingMinutes(state: DemoState, habit: HabitResponse): number {
  const date = todayDate();
  const checkin = state.checkins.find((row) => row.habit_id === habit.id && row.date === date);
  const consumed = checkin?.value ?? 0;
  return Math.max(0, habit.current_goal - consumed);
}

function toDemoDoomScrollResponse(
  session: DemoDoomScrollSession | null,
): DoomScrollSessionResponse | null {
  if (!session || session.completed) {
    return null;
  }

  const now = Date.now();
  const endsAt = new Date(session.ends_at).getTime();
  if (endsAt <= now) {
    return null;
  }

  return {
    id: session.id,
    habit_id: session.habit_id,
    started_at: session.started_at,
    ends_at: session.ends_at,
    duration_min: session.duration_min,
    completed: session.completed,
    remaining_sec: Math.max(0, Math.ceil((endsAt - now) / 1000)),
  };
}

function findDemoActiveDoomScrollSession(
  state: DemoState,
  habitId: string,
): DemoDoomScrollSession | null {
  const now = Date.now();
  return (
    state.doomScrollSessions.find(
      (session) =>
        session.habit_id === habitId &&
        !session.completed &&
        new Date(session.ends_at).getTime() > now,
    ) ?? null
  );
}

function computeDemoDoomScrollMinutes(
  startedAt: string,
  endsAt: string,
  endedAt: Date,
): number {
  const startMs = new Date(startedAt).getTime();
  const plannedEndMs = new Date(endsAt).getTime();
  const endMs = Math.min(endedAt.getTime(), plannedEndMs);
  return Math.max(0, Math.round((endMs - startMs) / 60_000));
}

function finalizeDemoDoomScrollSession(
  state: DemoState,
  sessionId: string,
  endedAt: Date,
): DemoState {
  const index = state.doomScrollSessions.findIndex((row) => row.id === sessionId);
  if (index < 0) {
    return state;
  }

  const session = state.doomScrollSessions[index]!;
  if (session.completed) {
    return state;
  }

  const habit = state.habits.find((row) => row.id === session.habit_id);
  if (!habit) {
    return state;
  }

  const minutes = computeDemoDoomScrollMinutes(session.started_at, session.ends_at, endedAt);
  const nextSessions = [...state.doomScrollSessions];
  nextSessions[index] = { ...session, completed: true };

  let nextState: DemoState = { ...state, doomScrollSessions: nextSessions };
  if (minutes > 0) {
    const date = todayDate();
    const existingIndex = nextState.checkins.findIndex(
      (row) => row.habit_id === habit.id && row.date === date,
    );
    const currentValue = existingIndex >= 0 ? (nextState.checkins[existingIndex]!.value ?? 0) : 0;
    const nextValue = currentValue + minutes;
    const status = resolveCheckinStatus(
      {
        type: habit.type,
        side: habit.side,
        currentGoal: habit.current_goal,
        templateId: habit.template_id,
      },
      { value: nextValue },
    );
    const checkin: CheckinResponse = {
      id: existingIndex >= 0 ? nextState.checkins[existingIndex]!.id : crypto.randomUUID(),
      habit_id: habit.id,
      date,
      status,
      value: nextValue,
      updated_at: nowIso(),
      current_goal: habit.current_goal,
      preview_next_goal: demoPreviewNextGoal(habit, status, nextValue),
    };
    const checkins = [...nextState.checkins];
    if (existingIndex >= 0) {
      checkins[existingIndex] = checkin;
    } else {
      checkins.push(checkin);
    }
    nextState = { ...nextState, checkins };
  }

  saveState(nextState);
  return nextState;
}

function reconcileDemoDoomScrollSessions(state: DemoState): DemoState {
  const now = Date.now();
  let next = state;
  for (const session of state.doomScrollSessions) {
    if (session.completed) {
      continue;
    }
    if (new Date(session.ends_at).getTime() <= now) {
      next = finalizeDemoDoomScrollSession(next, session.id, new Date(session.ends_at));
    }
  }
  return next;
}

export function demoStartDoomScroll(
  habitId: string,
  data: StartDoomScrollRequest = {},
): DoomScrollSessionResponse {
  let state = reconcileDemoDoomScrollSessions(ensureState());
  const habit = state.habits.find((row) => row.id === habitId && row.template_id === "social_media");
  if (!habit) {
    throw new Error("Doom scroll доступен только для привычки «Соцсети»");
  }

  if (findDemoActiveDoomScrollSession(state, habitId)) {
    throw new Error("Сессия уже запущена");
  }

  const remainingMin = getDemoSocialMediaRemainingMinutes(state, habit);
  if (remainingMin <= 0) {
    throw new Error("Лимит на сегодня исчерпан");
  }

  const sessionMin = Math.min(DOOM_SCROLL_DURATION_MIN, remainingMin);
  const now = new Date();
  const endsAt = new Date(now.getTime() + sessionMin * 60_000);
  const session: DemoDoomScrollSession = {
    id: crypto.randomUUID(),
    habit_id: habitId,
    started_at: now.toISOString(),
    ends_at: endsAt.toISOString(),
    duration_min: sessionMin,
    completed: false,
    platform: data.platform ?? null,
  };

  state = { ...state, doomScrollSessions: [...state.doomScrollSessions, session] };
  saveState(state);

  const response = toDemoDoomScrollResponse(session);
  if (!response) {
    throw new Error("Не удалось запустить сессию");
  }
  return response;
}

export function demoStopDoomScroll(habitId: string): DoomScrollStopResponse {
  let state = ensureState();
  const session = state.doomScrollSessions.find(
    (row) => row.habit_id === habitId && !row.completed,
  );
  if (!session) {
    throw new Error("Активная сессия не найдена");
  }

  const now = new Date();
  const endedAt =
    new Date(session.ends_at).getTime() <= now.getTime() ? new Date(session.ends_at) : now;
  state = finalizeDemoDoomScrollSession(state, session.id, endedAt);
  const habit = state.habits.find((row) => row.id === habitId)!;
  const date = todayDate();
  const checkin = state.checkins.find((row) => row.habit_id === habitId && row.date === date);
  const finalized = state.doomScrollSessions.find((row) => row.id === session.id)!;
  const minutes = computeDemoDoomScrollMinutes(
    finalized.started_at,
    finalized.ends_at,
    endedAt,
  );

  return {
    session: {
      id: finalized.id,
      habit_id: finalized.habit_id,
      started_at: finalized.started_at,
      ends_at: finalized.ends_at,
      duration_min: finalized.duration_min,
      completed: true,
      remaining_sec: 0,
    },
    minutes_added: minutes,
    checkin: {
      date,
      status: checkin?.status ?? "pending",
      value: checkin?.value ?? null,
      current_goal: habit.current_goal,
      preview_next_goal: checkin?.preview_next_goal ?? habit.current_goal,
    },
  };
}

export function demoGetActiveDoomScroll(habitId: string): DoomScrollSessionResponse | null {
  const state = reconcileDemoDoomScrollSessions(ensureState());
  return toDemoDoomScrollResponse(findDemoActiveDoomScrollSession(state, habitId));
}

function buildDarkTodayResponse(): TodayDarkResponse {
  let state = ensureState();
  state = reconcileDemoDoomScrollSessions(state);
  const date = todayDate();
  ensureDemoEarlyRiseWeekendSkips(state, date);
  const sideHabits = state.habits.filter((h) => h.side === "dark" && h.is_active);
  const todayCheckins = state.checkins.filter((c) => c.date === date);
  const stats = buildTodayStats(state, sideHabits, todayCheckins);

  return todayDarkResponseSchema.parse({
    date,
    greeting_name: state.user.name,
    stats,
    habits: sideHabits.map((habit) => {
      const checkin = todayCheckins.find((c) => c.habit_id === habit.id) ?? null;
      const doomActive = toDemoDoomScrollResponse(findDemoActiveDoomScrollSession(state, habit.id));
      return mapHabitToTodayDark(habit, checkin, doomActive, state, date);
    }),
    daily_plan: buildDemoDailyPlan(state, "dark", date),
    warmup_day: buildDemoWarmupDay(state.user, date),
  });
}

function findDemoActiveSessionByHabit(
  state: DemoState,
  habitId: string,
): DemoHabitSession | null {
  const session = state.sessions.find(
    (row) => row.habit_id === habitId && !row.completed && row.ended_at === null,
  );
  return session ?? null;
}

function listCompletedBlockMeta(
  state: DemoState,
  date: string,
): Map<string, { actual_value: number | null; actual_minutes: number | null }> {
  const result = new Map<string, { actual_value: number | null; actual_minutes: number | null }>();

  for (const session of state.sessions) {
    if (!session.completed || !session.block_id || !session.ended_at) {
      continue;
    }

    if (formatLocalDate(new Date(session.ended_at)) !== date) {
      continue;
    }

    result.set(session.block_id, {
      actual_value: session.value_added,
      actual_minutes: session.actual_min,
    });
  }

  return result;
}

function resolveActiveBlockId(state: DemoState): string | null {
  const active = state.sessions
    .filter((session) => !session.completed && session.ended_at === null && session.block_id)
    .sort((a, b) => a.started_at.localeCompare(b.started_at))[0];
  return active?.block_id ?? null;
}

function buildDemoDailyPlan(
  state: DemoState,
  side: "light" | "dark",
  date: string,
) {
  const todayCheckins = new Map(
    state.checkins.filter((checkin) => checkin.date === date).map((checkin) => [checkin.habit_id, checkin]),
  );
  const completedBlockMeta = listCompletedBlockMeta(state, date);
  const completedBlockIds = new Set(completedBlockMeta.keys());
  const activeBlockId = resolveActiveBlockId(state);

  if (side === "light") {
    return buildDailyPlan({
      date,
      budgetMin: state.user.daily_budget_min,
      habits: state.habits
        .filter((habit) => habit.side === "light" && habit.is_active)
        .map((habit) => {
          const displayName = demoHabitDisplayName(habit);
          return {
            id: habit.id,
            name: displayName,
            icon: resolveHabitIcon({
              icon: habit.icon,
              template_id: habit.template_id,
              category_key: habit.category_key,
              name: displayName,
              side: habit.side,
            }),
            unit: habit.unit,
            current_goal: habit.current_goal,
            checkin_value: todayCheckins.get(habit.id)?.value ?? 0,
            template_id: habit.template_id,
            category_key: habit.category_key,
          };
        }),
      completedBlockIds,
      activeBlockId,
      completedBlockMeta,
    });
  }

  const darkAwarenessHabits = state.habits.filter((habit) => {
    if (!habit.is_active || habit.side !== "dark") {
      return false;
    }
    if (habit.type !== "limit" || habit.template_id === "social_media") {
      return false;
    }
    return todayCheckins.get(habit.id)?.status !== "success";
  });

  if (darkAwarenessHabits.length === 0) {
    return undefined;
  }

  const basePlan = buildDailyPlan({
    date,
    budgetMin: darkAwarenessHabits.length * AWARENESS_SESSION_MIN,
    habits: darkAwarenessHabits.map((habit) => ({
      id: habit.id,
      name: demoHabitDisplayName(habit),
      icon: habit.icon,
      unit: habit.unit,
      current_goal: AWARENESS_SESSION_MIN,
      checkin_value: 0,
    })),
    completedBlockIds,
    activeBlockId,
    completedBlockMeta,
  });

  return {
    ...basePlan,
    blocks: basePlan.blocks.map((block) => ({
      ...block,
      expected_yield: 0,
    })),
  };
}

function getSupportedSessionHabit(state: DemoState, habitId: string): HabitResponse {
  const habit = state.habits.find((row) => row.id === habitId && row.is_active);
  if (!habit) {
    throw new Error("Привычка не найдена");
  }

  const isLightHabit = habit.side === "light";
  const isAllowedDarkLimit =
    habit.side === "dark" && habit.type === "limit" && habit.template_id !== "social_media";

  if (!isLightHabit && !isAllowedDarkLimit) {
    throw new Error("Для этой привычки таймер недоступен");
  }

  return habit;
}

function getDemoExerciseElapsedMs(session: DemoHabitSession): number {
  if (session.paused_at && session.paused_remaining_seconds != null) {
    const totalMs = sessionTotalSeconds(session) * 1000;
    return Math.max(0, totalMs - session.paused_remaining_seconds * 1000);
  }

  return Math.max(0, Date.now() - new Date(session.started_at).getTime());
}

function toDemoSessionResponse(session: DemoHabitSession): HabitSessionResponse {
  const isPaused = Boolean(session.paused_at && !session.completed && !session.ended_at);
  const totalMs = sessionTotalSeconds(session) * 1000;
  const remainingSeconds =
    session.completed || session.ended_at
      ? 0
      : isPaused && session.paused_remaining_seconds != null
        ? session.paused_remaining_seconds
        : Math.max(
            0,
            Math.ceil((new Date(session.started_at).getTime() + totalMs - Date.now()) / 1000),
          );
  return {
    id: session.id,
    habit_id: session.habit_id,
    block_id: session.block_id,
    started_at: session.started_at,
    ended_at: session.ended_at,
    planned_min: session.planned_min,
    planned_seconds: session.planned_seconds ?? null,
    actual_min: session.actual_min,
    value_added: session.value_added,
    completed: session.completed,
    is_paused: isPaused,
    remaining_seconds: remainingSeconds,
  };
}

function upsertSessionCheckin(
  state: DemoState,
  habit: HabitResponse,
  value: number,
  now: string,
  options?: { mode?: "add" | "set" },
): { date: string; status: CheckinResponse["status"]; value: number; current_goal: number; preview_next_goal: number } {
  const mode = options?.mode ?? "add";
  const date = todayDate();
  const existingIndex = state.checkins.findIndex(
    (checkin) => checkin.habit_id === habit.id && checkin.date === date,
  );
  const existing = existingIndex >= 0 ? state.checkins[existingIndex]! : null;

  if (existing?.status === "skipped") {
    throw new Error("Cannot add session value on a skipped day");
  }

  const currentValue = existing?.value ?? 0;
  const rawValue = mode === "set" ? value : currentValue + value;
  const nextValue =
    habit.template_id === "books" ? Math.max(currentValue, rawValue) : rawValue;
  let status: CheckinResponse["status"];
  if (isForeignLanguageHabit({ category_key: habit.category_key, name: habit.name })) {
    status =
      existing?.status === "success"
        ? "success"
        : resolveForeignLanguageCheckinStatus(nextValue, habit.current_goal);
  } else {
    status = resolveCheckinStatus(
      {
        type: habit.type,
        side: habit.side,
        currentGoal: habit.current_goal,
        templateId: habit.template_id,
      },
      { value: nextValue },
    );
  }

  const previewNextGoal = demoPreviewNextGoal(habit, status, nextValue);

  const checkin: CheckinResponse = {
    id: existing?.id ?? crypto.randomUUID(),
    habit_id: habit.id,
    date,
    status,
    value: nextValue,
    updated_at: now,
    current_goal: habit.current_goal,
    preview_next_goal: previewNextGoal,
  };

  if (existingIndex >= 0) {
    state.checkins[existingIndex] = checkin;
  } else {
    state.checkins.push(checkin);
  }

  if (habit.template_id === "books") {
    creditDemoReadingFromCheckin(state, habit, date, nextValue);
  }

  return {
    date,
    status,
    value: nextValue,
    current_goal: habit.current_goal,
    preview_next_goal: previewNextGoal,
  };
}

export function demoGetTodayLight(): TodayLightResponse {
  return buildLightTodayResponse();
}

export function demoGetNutritionTodayLog(habitId: string): HabitNutritionLog | null {
  const state = ensureState();
  const log = state.nutritionByHabitId[habitId] ?? null;
  if (!log || log.date !== todayDate()) {
    return null;
  }
  return log;
}

export function demoPutNutritionTodayLog(
  habitId: string,
  data: PutNutritionTodayRequest,
): HabitNutritionLog {
  const state = ensureState();
  const habit = state.habits.find((row) => row.id === habitId);
  if (!habit || !isNutritionHabit(habit)) {
    throw new Error("Привычка питания не найдена");
  }

  const ingredientIds = [...new Set(data.ingredient_ids)];
  if (ingredientIds.length < NUTRITION_MIN_INGREDIENTS) {
    throw new Error(`Нужно минимум ${NUTRITION_MIN_INGREDIENTS} продукта`);
  }
  for (const id of ingredientIds) {
    if (!isKnownNutritionIngredientId(id)) {
      throw new Error(`Неизвестный продукт: ${id}`);
    }
  }
  if (data.recipe_id && !isKnownNutritionRecipeId(data.recipe_id)) {
    throw new Error(`Неизвестный рецепт: ${data.recipe_id}`);
  }

  const date = todayDate();
  const existing = state.nutritionByHabitId[habitId];
  const log: HabitNutritionLog = {
    id: existing?.id ?? crypto.randomUUID(),
    habit_id: habitId,
    date,
    ingredient_ids: ingredientIds,
    recipe_id:
      data.recipe_id !== undefined ? (data.recipe_id ?? null) : (existing?.recipe_id ?? null),
    updated_at: nowIso(),
  };

  state.nutritionByHabitId[habitId] = log;
  saveState(state);
  return log;
}

export function demoGetTodayDark(): TodayDarkResponse {
  return buildDarkTodayResponse();
}

export function demoCreateCheckin(data: CreateCheckinRequest): CheckinResponse {
  const state = ensureState();
  const date = data.date ?? todayDate();
  const habit = state.habits.find((h) => h.id === data.habit_id);

  if (!habit) {
    throw new Error("Привычка не найдена");
  }

  if (isNutritionHabit(habit)) {
    throw new Error("Для этой привычки отметка не нужна");
  }

  const existingIndex = state.checkins.findIndex(
    (c) => c.habit_id === data.habit_id && c.date === date,
  );

  let request = data;
  if (habit.template_id === "books" && data.value !== undefined) {
    const currentValue =
      existingIndex >= 0 ? (state.checkins[existingIndex]!.value ?? 0) : 0;
    if (data.value < currentValue) {
      request = { ...data, value: currentValue };
    }
  }

  const { status: resolvedStatus, value: resolvedValue } = resolveDemoCheckinStatus(
    habit,
    request,
    state,
  );
  const previewNextGoal = demoPreviewNextGoal(habit, resolvedStatus, resolvedValue);

  const checkin: CheckinResponse = {
    id: existingIndex >= 0 ? state.checkins[existingIndex]!.id : crypto.randomUUID(),
    habit_id: data.habit_id,
    date,
    status: resolvedStatus,
    value: resolvedValue,
    updated_at: nowIso(),
    current_goal: habit.current_goal,
    preview_next_goal: previewNextGoal,
  };

  if (existingIndex >= 0) {
    state.checkins[existingIndex] = checkin;
  } else {
    state.checkins.push(checkin);
  }

  if (resolvedValue != null) {
    creditDemoReadingFromCheckin(state, habit, date, resolvedValue);
  }

  if (
    usesAbstinenceStreakRules(habit.type, habit.phase) &&
    resolvedStatus === "fail"
  ) {
    const habitIndex = state.habits.findIndex((row) => row.id === habit.id);
    if (habitIndex >= 0) {
      state.habits[habitIndex] = {
        ...state.habits[habitIndex]!,
        last_relapse_at: nowIso(),
      };
    }
  }

  saveState(state);
  return checkin;
}

export function demoStartHabitSession(
  habitId: string,
  data: StartHabitSessionRequest = {},
): HabitSessionResponse {
  const state = ensureState();
  getSupportedSessionHabit(state, habitId);

  if (findDemoActiveSessionByHabit(state, habitId)) {
    throw new Error("Сессия уже запущена");
  }

  const plannedSeconds =
    data.planned_seconds != null && data.planned_seconds > 0 ? data.planned_seconds : null;
  const plannedMin =
    data.planned_min ??
    (plannedSeconds != null ? sessionBudgetMinutes(plannedSeconds) : SESSION_TARGET_MIN);

  const session: DemoHabitSession = {
    id: crypto.randomUUID(),
    habit_id: habitId,
    block_id: data.block_id ?? null,
    started_at: nowIso(),
    ended_at: null,
    planned_min: plannedMin,
    planned_seconds: plannedSeconds,
    actual_min: null,
    value_added: null,
    completed: false,
  };

  state.sessions.push(session);
  saveState(state);
  return toDemoSessionResponse(session);
}

export function demoCompleteHabitSession(
  habitId: string,
  data: CompleteHabitSessionRequest = {},
): HabitSessionCompleteResponse {
  const state = ensureState();
  const habit = getSupportedSessionHabit(state, habitId);
  const session = findDemoActiveSessionByHabit(state, habitId);

  if (!session) {
    throw new Error("Активная сессия не найдена");
  }

  const elapsedMs = getDemoExerciseElapsedMs(session);
  const totalMs = sessionTotalSeconds(session) * 1000;
  const completedFullTimer =
    !(data.ended_early ?? false) && elapsedMs >= Math.max(0, totalMs - 500);
  if (elapsedMs < 5_000 && !completedFullTimer) {
    throw new Error("Сессия слишком короткая — подождите ещё несколько секунд");
  }

  const actualMin = computeSessionCompletionMinutes(
    elapsedMs,
    session.planned_min,
    session.planned_seconds,
    data.ended_early ?? false,
  );
  const useDailyTotal = habit.side === "dark" && habit.type === "limit";

  let valueToAdd: number;
  if (data.ended_early) {
    if (habit.unit === "minutes") {
      valueToAdd = session.planned_min;
    } else if (useDailyTotal) {
      if (data.actual_value == null || data.actual_value < 0) {
        throw new Error("actual_value must be zero or greater for limit habits");
      }
      valueToAdd = data.actual_value;
    } else if (data.actual_value == null || data.actual_value <= 0) {
      throw new Error("actual_value must be greater than zero for non-minute habits");
    } else {
      valueToAdd = data.actual_value;
    }
  } else if (habit.unit === "minutes") {
    valueToAdd = actualMin;
  } else if (useDailyTotal) {
    if (data.actual_value == null || data.actual_value < 0) {
      throw new Error("actual_value must be zero or greater for limit habits");
    }
    valueToAdd = data.actual_value;
  } else if (data.actual_value == null || data.actual_value <= 0) {
    throw new Error("actual_value must be greater than zero for non-minute habits");
  } else {
    valueToAdd = data.actual_value;
  }

  const now = nowIso();
  const checkin = upsertSessionCheckin(
    state,
    habit,
    valueToAdd,
    now,
    useDailyTotal ? { mode: "set" } : undefined,
  );

  const updatedSession: DemoHabitSession = {
    ...session,
    ended_at: now,
    completed: true,
    actual_min: actualMin,
    value_added: valueToAdd,
    block_id: data.block_id ?? session.block_id,
  };

  const index = state.sessions.findIndex((row) => row.id === session.id);
  if (index >= 0) {
    state.sessions[index] = updatedSession;
  }

  saveState(state);
  return {
    session: toDemoSessionResponse(updatedSession),
    checkin,
    value_added: valueToAdd,
  };
}

export function demoStopHabitSession(habitId: string): HabitSessionResponse {
  const state = ensureState();
  getSupportedSessionHabit(state, habitId);
  const session = findDemoActiveSessionByHabit(state, habitId);

  if (!session) {
    throw new Error("Активная сессия не найдена");
  }

  const updatedSession: DemoHabitSession = {
    ...session,
    ended_at: nowIso(),
    completed: false,
    actual_min: null,
    value_added: null,
  };

  const index = state.sessions.findIndex((row) => row.id === session.id);
  if (index >= 0) {
    state.sessions[index] = updatedSession;
  }

  saveState(state);
  return toDemoSessionResponse(updatedSession);
}

export function demoPauseHabitSession(habitId: string): HabitSessionResponse {
  const state = ensureState();
  getSupportedSessionHabit(state, habitId);
  const session = findDemoActiveSessionByHabit(state, habitId);

  if (!session) {
    throw new Error("Активная сессия не найдена");
  }

  if (session.paused_at && session.paused_remaining_seconds != null) {
    return toDemoSessionResponse(session);
  }

  const remainingSeconds = Math.max(
    0,
    Math.ceil(
      (new Date(session.started_at).getTime() + sessionTotalSeconds(session) * 1000 - Date.now()) /
        1000,
    ),
  );
  const updatedSession: DemoHabitSession = {
    ...session,
    paused_at: nowIso(),
    paused_remaining_seconds: remainingSeconds,
  };

  const index = state.sessions.findIndex((row) => row.id === session.id);
  if (index >= 0) {
    state.sessions[index] = updatedSession;
  }

  saveState(state);
  return toDemoSessionResponse(updatedSession);
}

export function demoResumeHabitSession(habitId: string): HabitSessionResponse {
  const state = ensureState();
  getSupportedSessionHabit(state, habitId);
  const session = findDemoActiveSessionByHabit(state, habitId);

  if (!session) {
    throw new Error("Активная сессия не найдена");
  }

  if (!session.paused_at || session.paused_remaining_seconds == null) {
    return toDemoSessionResponse(session);
  }

  const totalSeconds = sessionTotalSeconds(session);
  const elapsedSeconds = Math.max(0, totalSeconds - session.paused_remaining_seconds);
  const newStartedAt = new Date(Date.now() - elapsedSeconds * 1000).toISOString();
  const updatedSession: DemoHabitSession = {
    ...session,
    started_at: newStartedAt,
    paused_at: null,
    paused_remaining_seconds: null,
  };

  const index = state.sessions.findIndex((row) => row.id === session.id);
  if (index >= 0) {
    state.sessions[index] = updatedSession;
  }

  saveState(state);
  return toDemoSessionResponse(updatedSession);
}

export function demoGetActiveHabitSession(habitId: string): HabitSessionActiveResponse {
  const state = ensureState();
  getSupportedSessionHabit(state, habitId);
  const session = findDemoActiveSessionByHabit(state, habitId);
  return {
    session: session ? toDemoSessionResponse(session) : null,
  };
}

function listMonthDates(month: string): string[] {
  const [year, monthNum] = month.split("-").map(Number);
  const lastDay = new Date(year!, monthNum!, 0).getDate();
  return Array.from({ length: lastDay }, (_, index) => {
    const day = String(index + 1).padStart(2, "0");
    return `${year}-${String(monthNum).padStart(2, "0")}-${day}`;
  });
}

function resolveDemoStatsHabitStatus(
  habit: HabitResponse,
  dayDate: string,
  checkin: { status: string } | undefined,
): DayColorValue | "pending" {
  const today = todayDate();

  if (isCompanionLightHabit({ category_key: habit.category_key, name: habit.name })) {
    return "skipped";
  }

  if (isEarlyRiseCategoryKey(habit.category_key ?? "") && isWeekendDate(dayDate)) {
    return "skipped";
  }

  if (dayDate > today) {
    return "pending";
  }

  if (checkin?.status === "success" || checkin?.status === "fail" || checkin?.status === "skipped") {
    return checkin.status;
  }

  if (checkin?.status === "pending") {
    return dayDate === today ? "pending" : "fail";
  }

  if (usesAbstinenceStreakRules(habit.type, habit.phase)) {
    return "success";
  }

  if (dayDate === today) {
    return "pending";
  }

  return "fail";
}

function resolveDemoChartMinutesTotal(
  habit: HabitResponse,
  checkin: { value: number | null } | undefined,
  englishWatchMinutes = 0,
): number {
  if (isForeignLanguageHabit({ category_key: habit.category_key, name: habit.name })) {
    return sumMinutesHabitValueForTodayStats(habit, checkin?.value ?? 0, englishWatchMinutes);
  }

  const value = checkin?.value ?? 0;
  if (value <= 0) {
    return 0;
  }

  if (habit.template_id === "social_media") {
    return value;
  }

  if (habit.unit === "minutes") {
    return value;
  }

  return 0;
}

function resolveDemoDayForSide(
  state: DemoState,
  side: StatsSide,
  dayDate: string,
): { color: DayColorValue; habits: StatsCalendarResponse["days"][number]["habits"] } {
  const habitsForSide = state.habits.filter((habit) => habit.side === side);
  const habitIds = new Set(habitsForSide.map((habit) => habit.id));
  const dayCheckins = state.checkins.filter(
    (checkin) => checkin.date === dayDate && habitIds.has(checkin.habit_id),
  );

  if (habitsForSide.length === 0) {
    return { color: "pending", habits: [] };
  }

  const habits = habitsForSide.map((habit) => {
    const checkin = dayCheckins.find((row) => row.habit_id === habit.id);
    const status = resolveDemoStatsHabitStatus(habit, dayDate, checkin);
    const englishWatchMinutes = sumDemoEnglishWatchMinutesToday(state, dayDate);
    const chartMinutes = resolveDemoChartMinutesTotal(habit, checkin, englishWatchMinutes);
    const isForeignLanguage = isForeignLanguageHabit({
      category_key: habit.category_key,
      name: habit.name,
    });
    return {
      habit_id: habit.id,
      name: habit.name,
      side: habit.side,
      type: habit.type,
      phase: habit.phase,
      unit: habit.unit,
      template_id: habit.template_id,
      status,
      value: isForeignLanguage ? (chartMinutes > 0 ? chartMinutes : null) : (checkin?.value ?? null),
      goal: habit.current_goal,
      minutes_total: chartMinutes,
    };
  });

  return {
    color: computeDemoDayColor(habits.map((habit) => habit.status)),
    habits,
  };
}

export function demoGetStatsCalendar(month: string, side: StatsSide): StatsCalendarResponse {
  const state = ensureState();
  const dates = listMonthDates(month);

  return {
    month,
    days: dates.map((date) => {
      const resolved = resolveDemoDayForSide(state, side, date);
      return {
        date,
        color: resolved.color,
        habits: resolved.habits,
      };
    }),
  };
}

export function demoGetStatsMonth(month: string, side: StatsSide): StatsMonthResponse {
  const calendar = demoGetStatsCalendar(month, side);
  const today = todayDate();
  let successDays = 0;
  let relapses = 0;
  let skippedDays = 0;
  let closedDays = 0;

  for (const day of calendar.days) {
    if (day.date > today) continue;
    if (day.habits.length === 0) continue;
    if (day.color === "pending") continue;

    closedDays += 1;
    if (day.color === "success") successDays += 1;
    if (day.color === "fail") relapses += 1;
    if (day.color === "skipped") skippedDays += 1;
  }

  return {
    month,
    side,
    success_days: successDays,
    success_rate: closedDays > 0 ? Math.round((successDays / closedDays) * 100) : 0,
    relapses,
    skipped_days: skippedDays,
    closed_days: closedDays,
  };
}

export function demoGetHabitProgress(
  habitId: string,
  period: ProgressPeriod,
): StatsProgressResponse {
  const state = ensureState();
  const habit = state.habits.find((row) => row.id === habitId);
  if (!habit) {
    throw new Error("Привычка не найдена");
  }

  const today = todayDate();
  const daysBack = period === "week" ? 6 : period === "month" ? 29 : 89;
  const startDate = addDaysLocal(today, -daysBack);
  const dates = Array.from({ length: daysBack + 1 }, (_, index) => addDaysLocal(startDate, index));

  const points = dates.map((date) => {
    const checkin = state.checkins.find((row) => row.habit_id === habitId && row.date === date);
    const englishWatchMinutes = sumDemoEnglishWatchMinutesToday(state, date);
    const chartMinutes = resolveDemoChartMinutesTotal(habit, checkin, englishWatchMinutes);
    const isForeignLanguage = isForeignLanguageHabit({
      category_key: habit.category_key,
      name: habit.name,
    });
    return {
      date,
      goal: habit.current_goal,
      value: isForeignLanguage ? (chartMinutes > 0 ? chartMinutes : null) : (checkin?.value ?? null),
      status: checkin?.status ?? (date === today ? "pending" : null),
      minutes_total: chartMinutes,
    };
  });

  const chartMode =
    habit.type === "abstinence" || habit.phase === "abstinence"
      ? ("abstinence" as const)
      : habit.type === "limit"
        ? ("limit" as const)
        : ("target" as const);

  return {
    habit_id: habitId,
    period,
    start_date: startDate,
    end_date: today,
    side: habit.side,
    type: habit.type,
    phase: habit.phase,
    unit: habit.unit,
    chart_mode: chartMode,
    points,
  };
}

export function demoGetStatsWeek(side: StatsSide): StatsWeekResponse {
  const state = ensureState();
  const today = todayDate();
  const weekStart = weekStartMonday(today);
  const habitsForSide = state.habits.filter((habit) => habit.side === side && habit.is_active);
  const habitIds = new Set(habitsForSide.map((habit) => habit.id));

  const days = Array.from({ length: 7 }, (_, index) => {
    const dayDate = addDaysLocal(weekStart, index);
    const dayCheckins = state.checkins.filter(
      (checkin) => checkin.date === dayDate && habitIds.has(checkin.habit_id),
    );

    const statuses = habitsForSide.map((habit) => {
      const checkin = dayCheckins.find((row) => row.habit_id === habit.id);
      return resolveDemoStatsHabitStatus(habit, dayDate, checkin);
    });

    return {
      date: dayDate,
      color: computeDemoDayColor(statuses),
      completed: statuses.filter((status) => status === "success").length,
      total: habitsForSide.length,
    };
  });

  return {
    week_start: weekStart,
    side,
    days,
  };
}

export function demoSubscribePush(data: PushSubscribeRequest): PushSubscribeResponse {
  return {
    id: crypto.randomUUID(),
    endpoint: data.endpoint,
  };
}

export function demoSendCoachChat(body: CoachChatRequest): CoachChatResponse {
  const state = ensureState();
  const habit = state.habits.find((row) => row.id === body.habit_id);
  if (!habit) {
    throw new Error("Habit not found");
  }
  if (habit.side !== "dark" || !isCoachEligibleDarkHabit(habit.template_id)) {
    throw new Error("Coach is not available for this habit");
  }

  const date = todayDate();
  const usage =
    state.coachChatUsage?.date === date ? state.coachChatUsage.count : 0;
  if (usage >= COACH_DAILY_MESSAGE_LIMIT) {
    throw new Error(`Лимит сообщений на сегодня (${COACH_DAILY_MESSAGE_LIMIT}) исчерпан`);
  }

  const harshness = Math.min(3, Math.max(1, state.user.harshness_level)) as 1 | 2 | 3;
  const reply = resolveDarkCoachReply(habit.template_id, harshness, body.message);

  state.coachChatUsage = { date, count: usage + 1 };
  saveState(state);

  return {
    reply,
    messages_left: Math.max(0, COACH_DAILY_MESSAGE_LIMIT - usage - 1),
    source: "template",
  };
}
