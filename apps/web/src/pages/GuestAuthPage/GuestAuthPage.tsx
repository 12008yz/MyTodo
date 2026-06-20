import { useCallback, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { Gender } from "@mytodo/shared";
import { AuthPanels, type AuthPanel } from "../../components/AuthPanels";
import { WelcomeLayout } from "../../components/WelcomeLayout";
import type { IconAnimationPhase, IconTransition } from "../../constants/transitions";
import { ClientApiError } from "../../lib/api";
import { useAuth } from "../../features/auth/AuthProvider";

type GuestAuthLocationState = {
  iconTransition?: IconTransition;
};

export function GuestAuthPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = (location.state as GuestAuthLocationState | null) ?? {};

  const activePanel: AuthPanel = location.pathname === "/register" ? "registration" : "login";
  const fromWelcome = locationState.iconTransition === "enter-from-bottom";
  const [iconTransition, setIconTransition] = useState<IconTransition>(
    fromWelcome ? "enter-from-bottom" : "idle",
  );
  const [contentEntering, setContentEntering] = useState(fromWelcome);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleIconsAnimationComplete = useCallback((phase: IconAnimationPhase) => {
    if (phase === "enter") {
      setIconTransition("idle");
      setContentEntering(false);
    }
  }, []);

  const handlePanelChange = useCallback(
    (panel: AuthPanel) => {
      setError(null);
      navigate(panel === "registration" ? "/register" : "/login", { replace: true });
    },
    [navigate],
  );

  const afterAuth = useCallback(
    (onboardingCompleted: boolean) => {
      navigate(onboardingCompleted ? "/" : "/onboarding", { replace: true });
    },
    [navigate],
  );

  const handleLogin = useCallback(
    async (data: { email: string; password: string }) => {
      setError(null);
      setPending(true);
      try {
        const user = await login(data);
        afterAuth(user.onboarding_completed);
      } catch (err) {
        setError(err instanceof ClientApiError ? err.message : "Не удалось войти");
      } finally {
        setPending(false);
      }
    },
    [afterAuth, login],
  );

  const handleRegister = useCallback(
    async (data: {
      email: string;
      password: string;
      name: string;
      age: number;
      gender: Gender;
    }) => {
      setError(null);
      setPending(true);
      try {
        await register(data);
        afterAuth(false);
      } catch (err) {
        setError(
          err instanceof ClientApiError ? err.message : "Не удалось зарегистрироваться",
        );
      } finally {
        setPending(false);
      }
    },
    [afterAuth, register],
  );

  return (
    <WelcomeLayout
      variant="login"
      dense={activePanel === "registration"}
      iconTransition={iconTransition}
      contentEntering={contentEntering}
      onIconsAnimationComplete={handleIconsAnimationComplete}
    >
      <div className="welcome__page-stack">
        <AuthPanels
          prehidden={false}
          showContent
          activePanel={activePanel}
          onPanelChange={handlePanelChange}
          onLogin={handleLogin}
          onRegister={handleRegister}
          authError={error}
          pending={pending}
        />
      </div>
    </WelcomeLayout>
  );
}
