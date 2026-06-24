import { buildDailyPlan } from "@mytodo/domain";
import {
  AWARENESS_SESSION_MIN,
  SESSION_TARGET_MIN,
  computeDailyBudgetMin,
  HABIT_TEMPLATES,
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

type DemoState = {
  user: UserProfile;
  habits: HabitResponse[];
  english: EnglishSettingsResponse;
  checkins: CheckinResponse[];
  sessions: DemoHabitSession[];
};

type DemoHabitSession = Omit<HabitSessionResponse, "remaining_seconds">;

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
      sessions: parsed.sessions ?? [],
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
    sessions: [],
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
): HabitResponse {

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
  const state = loadState();
  if (!state?.user.onboarding_completed) {
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
    user,
    habits: [],
    english: defaultEnglish(),
    checkins: [],
    sessions: [],
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

function makeCheckin(
  habit: HabitResponse,
  date: string,
  status: CheckinResponse["status"],
  value: number | null,
): CheckinResponse {
  return {
    id: crypto.randomUUID(),
    habit_id: habit.id,
    date,
    status,
    value,
    updated_at: nowIso(),
    current_goal: habit.current_goal,
    preview_next_goal: habit.current_goal,
  };
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
  user.free_time_min = 60;
  user.daily_budget_min = computeDailyBudgetMin(60);
  user.wake_time = "07:00";
  user.sleep_time = "23:00";
  user.harshness_level = 2;
  user.effective_harshness_level = 2;

  const createdAt = addDaysLocal(todayDate(), -21) + "T10:00:00.000Z";

  const running = createHabitResponse(
    user,
    { template_id: "running", baseline_value: 20 },
    createdAt,
  );
  running.current_goal = 30;

  const pushups = createHabitResponse(
    user,
    { template_id: "pushups", baseline_value: 10 },
    createdAt,
  );
  pushups.current_goal = 15;

  const smoking = createHabitResponse(
    user,
    { template_id: "smoking", baseline_value: 15 },
    createdAt,
  );
  smoking.current_goal = 12;

  const social = createHabitResponse(
    user,
    { template_id: "social_media", baseline_value: 45 },
    createdAt,
  );
  social.current_goal = 30;

  const habits = [running, pushups, smoking, social];
  const today = todayDate();
  const weekStart = weekStartMonday(today);
  const checkins: CheckinResponse[] = [
    makeCheckin(running, today, "pending", 18),
    makeCheckin(pushups, today, "success", 15),
    makeCheckin(smoking, today, "pending", 8),
    makeCheckin(social, today, "pending", 22),
  ];

  for (let offset = 0; offset < 7; offset += 1) {
    const date = addDaysLocal(weekStart, offset);
    if (date >= today) continue;

    checkins.push(
      makeCheckin(running, date, offset % 2 === 0 ? "success" : "skipped", offset % 2 === 0 ? 30 : null),
      makeCheckin(pushups, date, "success", 15),
      makeCheckin(smoking, date, offset === 1 ? "fail" : "success", offset === 1 ? 14 : 10),
      makeCheckin(social, date, "success", 25),
    );
  }

  return {
    user,
    habits,
    english: defaultEnglish(),
    checkins,
    sessions: [],
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
          icon: habit.icon,
          unit: habit.unit,
          current_goal: habit.current_goal,
          checkin_value: todayCheckins.get(habit.id)?.value ?? 0,
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

function elapsedMinutesSince(startedAtIso: string): number {
  const elapsedMs = Date.now() - new Date(startedAtIso).getTime();
  return Math.max(0, Math.floor(elapsedMs / 60_000));
}

function toDemoSessionResponse(session: DemoHabitSession): HabitSessionResponse {
  const remainingSeconds =
    session.completed || session.ended_at
      ? 0
      : Math.max(
          0,
          Math.ceil(
            (new Date(session.started_at).getTime() + session.planned_min * 60_000 - Date.now()) /
              1000,
          ),
        );
  return {
    ...session,
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

  const checkin: CheckinResponse = {
    id: existing?.id ?? crypto.randomUUID(),
    habit_id: habit.id,
    date,
    status,
    value: nextValue,
    updated_at: now,
    current_goal: habit.current_goal,
    preview_next_goal: habit.current_goal,
  };

  if (existingIndex >= 0) {
    state.checkins[existingIndex] = checkin;
  } else {
    state.checkins.push(checkin);
  }

  return {
    date,
    status,
    value: nextValue,
    current_goal: habit.current_goal,
    preview_next_goal: habit.current_goal,
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

export function demoStartHabitSession(
  habitId: string,
  data: StartHabitSessionRequest = {},
): HabitSessionResponse {
  const state = ensureState();
  getSupportedSessionHabit(state, habitId);

  if (findDemoActiveSessionByHabit(state, habitId)) {
    throw new Error("Habit session already active for this habit");
  }

  const session: DemoHabitSession = {
    id: crypto.randomUUID(),
    habit_id: habitId,
    block_id: data.block_id ?? null,
    started_at: nowIso(),
    ended_at: null,
    planned_min: data.planned_min ?? SESSION_TARGET_MIN,
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

  const actualMin = Math.max(1, elapsedMinutesSince(session.started_at));
  const useDailyTotal = habit.side === "dark" && habit.type === "limit";

  let valueToAdd: number;
  if (habit.unit === "minutes") {
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
