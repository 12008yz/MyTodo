import { buildDailyPlan, calibrateHabit, computeNextGoal, recalculateLightGoal, type CalibrationProfile } from "@mytodo/domain";
import {
  AWARENESS_SESSION_MIN,
  SESSION_TARGET_MIN,
  sessionBudgetMinutes,
  sessionTotalSeconds,
  SOCIAL_MEDIA_MIN_GOAL,
  computeDailyBudgetMin,
  HABIT_TEMPLATE_IDS,
  HABIT_TEMPLATES,
  resolveHabitIcon,
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
  type HabitResponse,
  type HabitSessionActiveResponse,
  type HabitSessionCompleteResponse,
  type HabitSessionResponse,
  type HabitReadingProgress,
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
} from "@mytodo/shared";
import { setTokens } from "./auth-storage";
import { DEMO_EMAIL, DEMO_PASSWORD } from "./demo-mode";

const DEMO_STORAGE_KEY = "mytodo_demo_state";
const DEMO_ACCESS_TOKEN = "demo-access-token";
const DEMO_REFRESH_TOKEN = "demo-refresh-token";
/** Bump when showcase seed changes — existing localStorage is refreshed on login. */
const DEMO_STATE_VERSION = 3;

type DemoReadingProgress = HabitReadingProgress;

type DemoState = {
  version: number;
  user: UserProfile;
  habits: HabitResponse[];
  english: EnglishSettingsResponse;
  checkins: CheckinResponse[];
  sessions: DemoHabitSession[];
  readingByHabitId: Record<string, DemoReadingProgress>;
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
  };
}

function defaultEnglish(): EnglishSettingsResponse {
  return {
    is_enabled: false,
    current_day: 1,
    started_at: null,
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

function loadState(): DemoState | null {
  try {
    const raw = localStorage.getItem(DEMO_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DemoState;
    if ((parsed.version ?? 1) < DEMO_STATE_VERSION) {
      return null;
    }
    return normalizeDemoHabitGoals({
      ...parsed,
      checkins: parsed.checkins ?? [],
      sessions: parsed.sessions ?? [],
      readingByHabitId: parsed.readingByHabitId ?? {},
    });
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
    checkins: [],
    sessions: [],
    readingByHabitId: {},
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
    checkins: [],
    sessions: [],
    readingByHabitId: {},
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
    minGoal: habit.template_id === "social_media" ? SOCIAL_MEDIA_MIN_GOAL : undefined,
  };
}

function demoPreviewNextGoal(
  habit: HabitResponse,
  status: CheckinResponse["status"] | undefined,
): number {
  const dayStatus =
    status === "success" || status === "fail" || status === "skipped"
      ? status
      : status === "pending"
        ? "fail"
        : "success";

  return computeNextGoal(toDemoProgressionHabit(habit), dayStatus);
}

function makeCheckin(
  habit: HabitResponse,
  date: string,
  status: CheckinResponse["status"],
  value: number | null,
): CheckinResponse {
  const previewNextGoal = demoPreviewNextGoal(habit, status);
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
  pushups: 10,
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
  { name: "Медитация", unit: "minutes", baseline: 10, categoryKey: "meditation" },
  { name: "Иностранный язык", unit: "minutes", baseline: 15, categoryKey: "language" },
  { name: "Дневник благодарности", unit: "minutes", baseline: 5, categoryKey: "gratitude" },
  { name: "Силовая тренировка", unit: "minutes", baseline: 20, categoryKey: "strength_workout" },
  { name: "Растяжка", unit: "minutes", baseline: 10, categoryKey: "stretching" },
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
  byTemplate("pushups")!.current_goal = 15;
  byTemplate("smoking")!.current_goal = 12;
  byTemplate("social_media")!.current_goal = 30;

  const earlyRise = habits.find((habit) => habit.category_key === "early_rise");
  if (earlyRise) {
    earlyRise.current_goal = 5;
    earlyRise.success_days_at_goal = 2;
  }

  return habits;
}

function buildShowcaseCheckins(habits: HabitResponse[], today: string, weekStart: string): CheckinResponse[] {
  const checkins: CheckinResponse[] = [];

  habits.forEach((habit, index) => {
    let status: CheckinResponse["status"];
    let value: number | null;

    if (habit.type === "abstinence") {
      status = index % 2 === 0 ? "success" : "pending";
      value = null;
    } else if (habit.category_key === "early_rise" || habit.category_key === "healthy_nutrition") {
      status = index % 3 === 0 ? "success" : "pending";
      value = status === "success" ? habit.current_goal : null;
    } else if (habit.type === "target") {
      if (index % 5 === 0) {
        status = "success";
        value = habit.current_goal;
      } else if (index % 5 === 1) {
        status = "pending";
        value = Math.max(0, Math.floor(habit.current_goal * 0.55));
      } else {
        return;
      }
    } else {
      if (index % 4 === 0) {
        status = "success";
        value = Math.max(0, habit.current_goal - 1);
      } else if (index % 4 === 1) {
        status = "pending";
        value = Math.min(habit.current_goal + 2, habit.current_goal + 5);
      } else {
        return;
      }
    }

    checkins.push(makeCheckin(habit, today, status, value));
  });

  for (let offset = 0; offset < 7; offset += 1) {
    const date = addDaysLocal(weekStart, offset);
    if (date >= today) continue;

    for (const habit of habits) {
      const failDay = offset === 1 && habit.side === "dark" && habit.type === "limit";

      if (habit.type === "abstinence") {
        checkins.push(makeCheckin(habit, date, failDay ? "fail" : "success", null));
        continue;
      }

      if (habit.category_key === "early_rise" || habit.category_key === "healthy_nutrition") {
        checkins.push(
          makeCheckin(habit, date, offset % 3 === 0 ? "skipped" : "success", habit.current_goal),
        );
        continue;
      }

      if (habit.type === "target") {
        checkins.push(
          makeCheckin(
            habit,
            date,
            offset % 4 === 0 ? "skipped" : "success",
            offset % 4 === 0 ? null : habit.current_goal,
          ),
        );
        continue;
      }

      checkins.push(
        makeCheckin(
          habit,
          date,
          failDay ? "fail" : "success",
          failDay ? habit.current_goal + 2 : Math.max(0, habit.current_goal - 1),
        ),
      );
    }
  }

  return checkins;
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
  const habits = buildShowcaseHabits(user, createdAt);
  const today = todayDate();
  const weekStart = weekStartMonday(today);
  const checkins = buildShowcaseCheckins(habits, today, weekStart);

  return {
    version: DEMO_STATE_VERSION,
    user,
    habits,
    english: defaultEnglish(),
    checkins,
    sessions: [],
    readingByHabitId: {},
  };
}

function todayDate(): string {
  return formatLocalDate(new Date());
}

function resolveDemoCheckinStatus(
  habit: HabitResponse,
  data: CreateCheckinRequest,
): { status: CheckinResponse["status"]; value: number | null } {
  if (data.status === "skipped") {
    return { status: "skipped", value: null };
  }

  if (data.status === "fail") {
    return { status: "fail", value: null };
  }

  if (data.value === undefined) {
    return { status: "pending", value: null };
  }

  if (habit.type === "target") {
    return {
      status: data.value >= habit.current_goal ? "success" : "fail",
      value: data.value,
    };
  }

  if (habit.type === "limit") {
    return {
      status: data.value <= habit.current_goal ? "success" : "fail",
      value: data.value,
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

function buildTodayStats(checkinsToday: CheckinResponse[], habitIds: Set<string>) {
  const scoped = checkinsToday.filter((checkin) => habitIds.has(checkin.habit_id));
  const completedToday = scoped.filter((c) => c.status === "success").length;
  const relapsesThisWeek = scoped.filter((c) => c.status === "fail").length;
  const minutesToday = scoped.reduce((sum, c) => sum + (c.value ?? 0), 0);

  return {
    completed_today: completedToday,
    relapses_this_week: relapsesThisWeek,
    minutes_today: minutesToday,
    pomodoros_today: 0,
    streak_days: completedToday > 0 ? 1 : 0,
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
  const completedAt =
    pageCount != null && pagesRead >= pageCount
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
    saveState(state);
    return existing;
  }

  const next: DemoReadingProgress = {
    book_id: data.book_id,
    pages_read: 0,
    pages_credited_today: hasBaseline ? checkinBaseline : 0,
    last_checkin_date: planDate,
    completed_at: null,
    page_count: getKnownBookPageCount(data.book_id),
  };

  state.readingByHabitId[habitId] = next;
  saveState(state);
  return next;
}

function mapHabitToTodayLight(
  habit: HabitResponse,
  checkin: CheckinResponse | null,
  reading: DemoReadingProgress | null = null,
): TodayLightHabit {
  const previewNextGoal = demoPreviewNextGoal(habit, checkin?.status);
  return {
    ...habit,
    icon: resolveHabitIcon({
      icon: habit.icon,
      template_id: habit.template_id,
      category_key: habit.category_key,
      name: habit.name,
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
    streak_days: checkin?.status === "success" ? 1 : 0,
    ...(habit.template_id === "books" ? { reading } : {}),
  };
}

function mapHabitToTodayDark(
  habit: HabitResponse,
  checkin: CheckinResponse | null,
): TodayDarkHabit {
  return {
    ...mapHabitToTodayLight(habit, checkin),
    timer:
      habit.type === "abstinence" && habit.last_relapse_at
        ? {
            started_at: habit.last_relapse_at,
            elapsed: {
              days: 0,
              hours: 1,
              minutes: 0,
              seconds: 0,
              total_seconds: 3600,
            },
          }
        : null,
    doom_scroll_active: null,
  };
}

function buildLightTodayResponse(): TodayLightResponse {
  const state = ensureState();
  const date = todayDate();
  const sideHabits = state.habits.filter((h) => h.side === "light" && h.is_active);
  const habitIds = new Set(sideHabits.map((habit) => habit.id));
  const todayCheckins = state.checkins.filter((c) => c.date === date);
  const stats = buildTodayStats(todayCheckins, habitIds);

  return todayLightResponseSchema.parse({
    date,
    greeting_name: state.user.name,
    daily_budget_min: state.user.daily_budget_min,
    minutes_logged_today: stats.minutes_today,
    stats,
    habits: sideHabits.map((habit) => {
      const checkin = todayCheckins.find((c) => c.habit_id === habit.id) ?? null;
      const reading = state.readingByHabitId[habit.id] ?? null;
      return mapHabitToTodayLight(habit, checkin, reading);
    }),
    daily_plan: buildDemoDailyPlan(state, "light", date),
  });
}

function buildDarkTodayResponse(): TodayDarkResponse {
  const state = ensureState();
  const date = todayDate();
  const sideHabits = state.habits.filter((h) => h.side === "dark" && h.is_active);
  const habitIds = new Set(sideHabits.map((habit) => habit.id));
  const todayCheckins = state.checkins.filter((c) => c.date === date);
  const stats = buildTodayStats(todayCheckins, habitIds);

  return todayDarkResponseSchema.parse({
    date,
    greeting_name: state.user.name,
    stats,
    habits: sideHabits.map((habit) => {
      const checkin = todayCheckins.find((c) => c.habit_id === habit.id) ?? null;
      return mapHabitToTodayDark(habit, checkin);
    }),
    daily_plan: buildDemoDailyPlan(state, "dark", date),
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
        .map((habit) => ({
          id: habit.id,
          name: habit.name,
          icon: resolveHabitIcon({
            icon: habit.icon,
            template_id: habit.template_id,
            category_key: habit.category_key,
            name: habit.name,
            side: habit.side,
          }),
          unit: habit.unit,
          current_goal: habit.current_goal,
          checkin_value: todayCheckins.get(habit.id)?.value ?? 0,
          template_id: habit.template_id,
          category_key: habit.category_key,
        })),
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
      name: habit.name,
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
    throw new Error("Habit not found");
  }

  const isLightHabit = habit.side === "light";
  const isAllowedDarkLimit =
    habit.side === "dark" && habit.type === "limit" && habit.template_id !== "social_media";

  if (!isLightHabit && !isAllowedDarkLimit) {
    throw new Error("Habit sessions are not available for this habit");
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
  const nextValue = mode === "set" ? value : currentValue + value;
  const status: CheckinResponse["status"] =
    habit.type === "target"
      ? nextValue >= habit.current_goal
        ? "success"
        : "fail"
      : habit.type === "limit"
        ? nextValue <= habit.current_goal
          ? "success"
          : "fail"
        : "pending";

  const previewNextGoal = demoPreviewNextGoal(habit, status);

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

  creditDemoReadingFromCheckin(state, habit, date, nextValue);

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

  const existingIndex = state.checkins.findIndex(
    (c) => c.habit_id === data.habit_id && c.date === date,
  );

  const { status: resolvedStatus, value: resolvedValue } = resolveDemoCheckinStatus(habit, data);
  const previewNextGoal = demoPreviewNextGoal(habit, resolvedStatus);

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
    throw new Error("Habit session already active for this habit");
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
    throw new Error("No active habit session for this habit");
  }

  const elapsedMs = getDemoExerciseElapsedMs(session);
  if (elapsedMs < 5_000) {
    throw new Error("Session is too short to complete");
  }

  const actualMin = data.ended_early
    ? session.planned_min
    : Math.max(1, Math.ceil(elapsedMs / 60_000));
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
    throw new Error("No active habit session for this habit");
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
    throw new Error("No active habit session for this habit");
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
    throw new Error("No active habit session for this habit");
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

function resolveDemoDayForSide(
  state: DemoState,
  side: StatsSide,
  dayDate: string,
): { color: DayColorValue; habits: StatsCalendarResponse["days"][number]["habits"] } {
  const today = todayDate();
  const habitsForSide = state.habits.filter((habit) => habit.side === side && habit.is_active);
  const habitIds = new Set(habitsForSide.map((habit) => habit.id));
  const dayCheckins = state.checkins.filter(
    (checkin) => checkin.date === dayDate && habitIds.has(checkin.habit_id),
  );

  if (habitsForSide.length === 0) {
    return { color: "pending", habits: [] };
  }

  const habits = habitsForSide.map((habit) => {
    const checkin = dayCheckins.find((row) => row.habit_id === habit.id);
    const status =
      checkin?.status ??
      (dayDate > today ? "pending" : dayDate === today ? "pending" : "skipped");
    return {
      habit_id: habit.id,
      name: habit.name,
      side: habit.side,
      status,
      value: checkin?.value ?? null,
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

    closedDays += 1;
    if (day.color === "success") successDays += 1;
    if (day.color === "fail") relapses += 1;
    if (day.color === "skipped") skippedDays += 1;
  }

  return {
    month,
    side,
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
    throw new Error("Habit not found");
  }

  const today = todayDate();
  const daysBack = period === "week" ? 6 : period === "month" ? 29 : 89;
  const startDate = addDaysLocal(today, -daysBack);
  const dates = Array.from({ length: daysBack + 1 }, (_, index) => addDaysLocal(startDate, index));

  const points = dates.map((date) => {
    const checkin = state.checkins.find((row) => row.habit_id === habitId && row.date === date);
    return {
      date,
      goal: habit.current_goal,
      value: checkin?.value ?? null,
      status: checkin?.status ?? (date === today ? "pending" : null),
      minutes_total: checkin?.value ?? 0,
    };
  });

  return {
    habit_id: habitId,
    period,
    start_date: startDate,
    end_date: today,
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

    if (dayCheckins.length === 0) {
      return {
        date: dayDate,
        color: dayDate > today ? ("pending" as const) : dayDate === today ? ("pending" as const) : ("skipped" as const),
        completed: 0,
        total: habitsForSide.length,
      };
    }

    const statuses = habitsForSide.map((habit) => {
      const checkin = dayCheckins.find((row) => row.habit_id === habit.id);
      return checkin?.status ?? (dayDate === today ? "pending" : "skipped");
    });

    return {
      date: dayDate,
      color: computeDemoDayColor(statuses),
      completed: dayCheckins.filter((checkin) => checkin.status === "success").length,
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
