import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { UserProfile } from "@mytodo/shared";
import { clearTokens, getAccessToken } from "../../lib/auth-storage";
import { ClientApiError, getMe, login as apiLogin, logout as apiLogout, register as apiRegister, updateMe as apiUpdateMe, enterDemoShowcase as apiEnterDemoShowcase } from "../../lib/api";
import type { LoginRequest, PatchMeRequest, RegisterRequest } from "@mytodo/shared";

type AuthState = {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  authExitBlocked: boolean;
  setAuthExitBlocked: (blocked: boolean) => void;
  login: (data: LoginRequest) => Promise<UserProfile>;
  register: (data: RegisterRequest) => Promise<UserProfile>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<UserProfile | null>;
  updateProfile: (data: PatchMeRequest) => Promise<UserProfile>;
  enterDemoShowcase: () => Promise<UserProfile>;
};

const AuthContext = createContext<AuthState | null>(null);

const TRANSIENT_STATUS_CODES = new Set([500, 502, 503, 504]);

function isTransientError(err: unknown): boolean {
  return err instanceof ClientApiError && TRANSIENT_STATUS_CODES.has(err.status);
}

function shouldClearSession(err: unknown): boolean {
  return err instanceof ClientApiError && (err.status === 401 || err.status === 404);
}

async function fetchMeWithRetry(): Promise<UserProfile> {
  try {
    return await getMe();
  } catch (err) {
    if (!isTransientError(err)) {
      throw err;
    }

    await new Promise((resolve) => setTimeout(resolve, 750));
    return getMe();
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authExitBlocked, setAuthExitBlocked] = useState(false);

  const refreshUser = useCallback(async () => {
    if (!getAccessToken()) {
      setUser(null);
      return null;
    }

    try {
      const profile = await fetchMeWithRetry();
      setUser(profile);
      return profile;
    } catch (err) {
      if (shouldClearSession(err)) {
        clearTokens();
      }
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await refreshUser();
      setIsLoading(false);
    })();
  }, [refreshUser]);

  const login = useCallback(async (data: LoginRequest) => {
    const response = await apiLogin(data);
    setUser(response.user);
    return response.user;
  }, []);

  const register = useCallback(async (data: RegisterRequest) => {
    const response = await apiRegister(data);
    setUser(response.user);
    return response.user;
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (data: PatchMeRequest) => {
    const profile = await apiUpdateMe(data);
    setUser(profile);
    return profile;
  }, []);

  const enterDemoShowcase = useCallback(async () => {
    const response = await apiEnterDemoShowcase();
    setUser(response.user);
    return response.user;
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: user !== null,
      authExitBlocked,
      setAuthExitBlocked,
      login,
      register,
      logout,
      refreshUser,
      updateProfile,
      enterDemoShowcase,
    }),
    [user, isLoading, authExitBlocked, login, register, logout, refreshUser, updateProfile, enterDemoShowcase],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
