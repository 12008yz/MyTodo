import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AuthPanels, type AuthPanel } from "../../components/AuthPanels";
import { PrimaryButton } from "../../components/PrimaryButton";
import { WelcomeLayout } from "../../components/WelcomeLayout";
import type { IconAnimationPhase, IconTransition } from "../../constants/transitions";
import { useAuth } from "../../features/auth/AuthProvider";
import { useAuthPageTransition } from "../../hooks/useAuthPageTransition";
import { ClientApiError } from "../../lib/api";
import { isDemoMode } from "../../lib/demo-mode";

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
  const { login, register, enterDemoShowcase } = useAuth();
  const { exitTo, leavePhase, isAuthExiting, onLeaveTransitionEnd } = useAuthPageTransition();
  const navigate = useNavigate();
  const location = useLocation();

  const [page, setPage] = useState<GuestPage>(() => pathnameToPage(location.pathname));
  const [transitionPhase, setTransitionPhase] = useState<TransitionPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const activePanel = pathnameToPanel(location.pathname);
  const isLogin = page === "login";
  const isTransitioning = transitionPhase !== "idle" || isAuthExiting;

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
    setTransitionPhase("exiting");
  };

  const handleIconsAnimationComplete = useCallback((phase: IconAnimationPhase) => {
    if (phase === "exit") {
      setPage("login");
      setTransitionPhase("entering-icons");
      navigate("/register", { replace: true });
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
      exitTo(onboardingCompleted ? "/" : "/onboarding");
    },
    [exitTo],
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
    async (data: { email: string; password: string; name: string }) => {
      setError(null);
      setPending(true);
      try {
        await register({
          ...data,
          age: 25,
          gender: "male",
        });
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

  const handleDemoShowcase = useCallback(async () => {
    if (isTransitioning || pending) return;
    setError(null);
    setPending(true);
    try {
      const user = await enterDemoShowcase();
      afterAuth(user.onboarding_completed);
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Не удалось открыть демо");
    } finally {
      setPending(false);
    }
  }, [afterAuth, enterDemoShowcase, isTransitioning, pending]);

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
      leavePhase={leavePhase}
      onLeaveTransitionEnd={onLeaveTransitionEnd}
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

            <PrimaryButton onClick={handleStart} disabled={isTransitioning || pending}>
              Начать
            </PrimaryButton>

            {isDemoMode() ? (
              <div className="welcome__demo-actions">
                <button
                  type="button"
                  className="welcome__demo-button"
                  onClick={() => void handleDemoShowcase()}
                  disabled={isTransitioning || pending}
                >
                  Открыть демо с привычками
                </button>
                <p className="welcome__demo-hint">
                  Готовый профиль: светлая и тёмная стороны, статистика и чекины. Данные
                  сохраняются в браузере телефона.
                </p>
                {error ? <p className="welcome__demo-error">{error}</p> : null}
              </div>
            ) : null}
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
    </WelcomeLayout>
  );
}
