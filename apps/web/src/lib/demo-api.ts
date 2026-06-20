import {
  computeDailyBudgetMin,
  HABIT_TEMPLATES,
  type AuthResponse,
  type CreateHabitRequest,
  type EnglishSettingsResponse,
  type HabitResponse,
  type LoginRequest,
  type PatchEnglishSettingsRequest,
  type PatchMeRequest,
  type RegisterRequest,
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
    return JSON.parse(raw) as DemoState;
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
  const onboardingFieldsProvided =
    patch.weight_kg !== undefined ||
    patch.height_cm !== undefined ||
    patch.free_time_min !== undefined ||
    patch.wake_time !== undefined ||
    patch.sleep_time !== undefined ||
    patch.harshness_level !== undefined;

  if (onboardingFieldsProvided) {
    next.onboarding_completed = true;
  }

  if (patch.free_time_min !== undefined) {
    next.daily_budget_min = computeDailyBudgetMin(patch.free_time_min);
  }

  if (patch.harshness_level !== undefined) {
    next.effective_harshness_level = patch.harshness_level;
  }

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

  if (state.habits.filter((habit) => habit.is_active).length >= 6) {
    throw new Error("Максимум 6 активных привычек");
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
