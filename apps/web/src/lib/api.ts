import {
  apiErrorResponseSchema,
  authResponseSchema,
  createHabitRequestSchema,
  englishSettingsResponseSchema,
  habitResponseSchema,
  type AuthResponse,
  type CreateHabitRequest,
  type HabitResponse,
  type LoginRequest,
  type PatchEnglishSettingsRequest,
  type PatchMeRequest,
  type RegisterRequest,
  type UserProfile,
  userProfileSchema,
  type EnglishSettingsResponse,
} from "@mytodo/shared";
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from "./auth-storage";
import { isDemoMode } from "./demo-mode";
import {
  demoCreateHabit,
  demoGetMe,
  demoLogin,
  demoLogout,
  demoRegister,
  demoUpdateEnglishSettings,
  demoUpdateMe,
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
