import {
  computeDailyBudgetMin,
  HABIT_TEMPLATES,
  todayDarkResponseSchema,
  todayLightResponseSchema,
  type AuthResponse,
  type CheckinResponse,
  type CreateCheckinRequest,
  type CreateHabitRequest,
  type EnglishSettingsResponse,
  type HabitResponse,
  type LoginRequest,
  type PatchEnglishSettingsRequest,
  type PatchMeRequest,
  type PushSubscribeRequest,
  type PushSubscribeResponse,
  type RegisterRequest,
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

type DemoState = {
  user: UserProfile;
  habits: HabitResponse[];
  english: EnglishSettingsResponse;
  checkins: CheckinResponse[];
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

function loadState(): DemoState | null {
  try {
    const raw = localStorage.getItem(DEMO_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DemoState;
    return {
      ...parsed,
      checkins: parsed.checkins ?? [],
    };
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
    user: buildUser({ email: DEMO_EMAIL, name: "Демо-воин" }),
    habits: [],
    english: defaultEnglish(),
    checkins: [],
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
): HabitResponse {
  const createdAt = nowIso();

  if ("template_id" in data) {
    const template = HABIT_TEMPLATES[data.template_id];
    const baseline = data.baseline_value ?? 0;

    return {
      id: crypto.randomUUID(),
      user_id: user.id,
      name: template.name,
      type: template.type,
      side: template.side,
      unit: template.unit,
      baseline_value: baseline,
      current_goal: Math.max(baseline, template.growthStep),
      growth_step: template.growthStep,
      progression_direction: template.progressionDirection,
      phase: template.phase,
      last_relapse_at: template.type === "abstinence" ? createdAt : null,
      allows_weekly_skip: template.side === "light",
      is_custom: false,
      icon: resolveTemplateIcon(data.template_id),
      is_active: true,
      template_id: data.template_id,
      harshness_level: user.harshness_level,
      created_at: createdAt,
    };
  }

  const baseline = data.baseline_value;

  return {
    id: crypto.randomUUID(),
    user_id: user.id,
    name: data.name,
    type: "target",
    side: "light",
    unit: data.unit,
    baseline_value: baseline,
    current_goal: Math.max(baseline, 1),
    growth_step: data.unit === "minutes" ? 5 : 1,
    progression_direction: "increase",
    phase: "reduction",
    last_relapse_at: null,
    allows_weekly_skip: true,
    is_custom: true,
    icon: data.icon ?? null,
    is_active: true,
    template_id: null,
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
  const state = ensureState();
  return toAuthResponse(state.user);
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
    user,
    habits: [],
    english: defaultEnglish(),
    checkins: [],
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

  const habit = createHabitResponse(state.user, data);
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

function todayDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
  return d.toISOString().slice(0, 10);
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

function mapHabitToTodayLight(
  habit: HabitResponse,
  checkin: CheckinResponse | null,
): TodayLightHabit {
  return {
    ...habit,
    checkin: checkin
      ? {
          id: checkin.id,
          date: checkin.date,
          status: checkin.status,
          value: checkin.value,
          updated_at: checkin.updated_at,
          current_goal: checkin.current_goal,
          preview_next_goal: checkin.preview_next_goal,
        }
      : null,
    preview_next_goal: checkin?.preview_next_goal ?? habit.current_goal,
    streak_days: checkin?.status === "success" ? 1 : 0,
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
      return mapHabitToTodayLight(habit, checkin);
    }),
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
  });
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

  const checkin: CheckinResponse = {
    id: existingIndex >= 0 ? state.checkins[existingIndex]!.id : crypto.randomUUID(),
    habit_id: data.habit_id,
    date,
    status: resolvedStatus,
    value: resolvedValue,
    updated_at: nowIso(),
    current_goal: habit.current_goal,
    preview_next_goal: habit.current_goal,
  };

  if (existingIndex >= 0) {
    state.checkins[existingIndex] = checkin;
  } else {
    state.checkins.push(checkin);
  }

  saveState(state);
  return checkin;
}

export function demoGetStatsWeek(side: StatsSide): StatsWeekResponse {
  const date = todayDate();
  const weekStart = weekStartMonday(date);
  const days = Array.from({ length: 7 }, (_, index) => {
    const d = new Date(`${weekStart}T12:00:00`);
    d.setDate(d.getDate() + index);
    const dayDate = d.toISOString().slice(0, 10);
    const isToday = dayDate === date;

    return {
      date: dayDate,
      color: isToday ? ("pending" as const) : ("skipped" as const),
      completed: isToday ? 0 : 0,
      total: ensureState().habits.filter((h) => h.side === side).length,
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
