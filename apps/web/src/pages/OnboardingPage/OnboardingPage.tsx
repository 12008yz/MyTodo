import { PrimaryButton } from "../../components/PrimaryButton";
import { WelcomeLayout } from "../../components/WelcomeLayout";
import { useAuth } from "../../features/auth/AuthProvider";

export function OnboardingPage() {
  const { user } = useAuth();

  return (
    <WelcomeLayout variant="login" iconTransition="idle">
      <div className="welcome__page-stack">
        <div className="login__panel">
          <h1 className="welcome__title">Онбординг</h1>
          <p className="welcome__description">
            <span className="welcome__description-line">
              {user?.name}, настроим профиль и привычки.
            </span>
            <span className="welcome__description-line">
              Полный мастер — в блоке 2 frontend.
            </span>
          </p>
          <PrimaryButton type="button" disabled>
            Скоро
          </PrimaryButton>
        </div>
      </div>
    </WelcomeLayout>
  );
}
