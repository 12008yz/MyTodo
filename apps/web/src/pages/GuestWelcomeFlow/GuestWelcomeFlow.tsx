import { useCallback, useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import type { Gender } from "@mytodo/shared";
import { AuthPanels, type AuthPanel } from "../../components/AuthPanels";
import { PrimaryButton } from "../../components/PrimaryButton";
import { WelcomeLayout } from "../../components/WelcomeLayout";
import type { IconAnimationPhase, IconTransition } from "../../constants/transitions";
import { useAuth } from "../../features/auth/AuthProvider";
import { ClientApiError } from "../../lib/api";

type GuestPage = "welcome" | "login";
type TransitionPhase = "idle" | "exiting" | "entering-icons";

const GUEST_PATHS = new Set(["/welcome", "/login", "/register"]);

function pathnameToPage(pathname: string): GuestPage {
  return pathname === "/welcome" ? "welcome" : "login";
}

function pathnameToPanel(pathname: string): AuthPanel {
  return pathname === "/register" ? "registration" : "login";
}

export function GuestWelcomeFlow() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [page, setPage] = useState<GuestPage>(() => pathnameToPage(location.pathname));
  const [transitionPhase, setTransitionPhase] = useState<TransitionPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const activePanel = pathnameToPanel(location.pathname);
  const isLogin = page === "login";
  const isTransitioning = transitionPhase !== "idle";

  useEffect(() => {
    if (!GUEST_PATHS.has(location.pathname)) {
      navigate("/welcome", { replace: true });
    }
  }, [location.pathname, navigate]);

  useEffect(() => {
    if (transitionPhase !== "idle") return;
    setPage(pathnameToPage(location.pathname));
  }, [location.pathname, transitionPhase]);

  const handleStart = () => {
    if (isTransitioning) return;
    navigate("/onboarding", { replace: true });
  };

  const handleIconsAnimationComplete = useCallback((phase: IconAnimationPhase) => {
    if (phase === "exit") {
      setPage("login");
      setTransitionPhase("entering-icons");
      navigate("/login", { replace: true });
      return;
    }

    setTransitionPhase("idle");
  }, [navigate]);

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

  const iconTransition: IconTransition =
    transitionPhase === "exiting"
      ? "exit-up"
      : transitionPhase === "entering-icons"
        ? "enter-from-bottom"
        : "idle";

  const contentHidden = transitionPhase === "exiting";

  const showLoginContent =
    isLogin && (transitionPhase === "entering-icons" || transitionPhase === "idle");

  const contentEntering = isLogin && transitionPhase === "entering-icons";

  return (
    <WelcomeLayout
      variant={isLogin ? "login" : "default"}
      iconTransition={iconTransition}
      contentHidden={contentHidden}
      contentEntering={contentEntering}
      onIconsAnimationComplete={handleIconsAnimationComplete}
    >
      <div className="welcome__page-stack">
        {!isLogin ? (
          <>
            <div className="welcome__intro">
              <h1 className="welcome__title">Новая глава</h1>
              <p className="welcome__lead">Твоя перезагрузка начинается сегодня.</p>
              <p className="welcome__description welcome__description--landing">
                Выбирай привычки, которые сделают тебя сильнее. Откажись от того, что
                тянет вниз. Ежедневный контроль, помодоро и поддержка, которая не даст
                свернуть с пути.
              </p>
            </div>

            <PrimaryButton onClick={handleStart} disabled={isTransitioning}>
              Начать
            </PrimaryButton>
          </>
        ) : null}
        <AuthPanels
          prehidden={!isLogin}
          showContent={showLoginContent}
          activePanel={activePanel}
          onPanelChange={handlePanelChange}
          onLogin={handleLogin}
          onRegister={handleRegister}
          authError={error}
          pending={pending}
        />
      </div>
      <Outlet />
    </WelcomeLayout>
  );
}
