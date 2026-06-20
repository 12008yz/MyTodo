import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PrimaryButton } from "../../components/PrimaryButton";
import { WelcomeLayout } from "../../components/WelcomeLayout";
import type { IconAnimationPhase, IconTransition } from "../../constants/transitions";

type TransitionPhase = "idle" | "exiting" | "entering-icons";

export function WelcomePage() {
  const navigate = useNavigate();
  const [transitionPhase, setTransitionPhase] = useState<TransitionPhase>("idle");

  const isTransitioning = transitionPhase !== "idle";

  const handleStart = () => {
    if (isTransitioning) return;
    setTransitionPhase("exiting");
  };

  const handleIconsAnimationComplete = useCallback(
    (phase: IconAnimationPhase) => {
      if (phase === "exit") {
        navigate("/login", { state: { iconTransition: "enter-from-bottom" } });
      }
    },
    [navigate],
  );

  const iconTransition: IconTransition =
    transitionPhase === "exiting"
      ? "exit-up"
      : transitionPhase === "entering-icons"
        ? "enter-from-bottom"
        : "idle";

  const contentHidden = transitionPhase === "exiting";

  return (
    <WelcomeLayout
      variant="default"
      iconTransition={iconTransition}
      contentHidden={contentHidden}
      onIconsAnimationComplete={handleIconsAnimationComplete}
    >
      <h1 className="welcome__title">Новая глава</h1>
      <p className="welcome__description">
        <span className="welcome__description-line">
          Приложение для контроля привычек:
        </span>
        <span className="welcome__description-line">
          светлая сторона роста и тёмная сторона
        </span>
        <span className="welcome__description-line">отказа от вредного!</span>
      </p>

      <PrimaryButton onClick={handleStart} disabled={isTransitioning}>
        Начать
      </PrimaryButton>
    </WelcomeLayout>
  );
}
