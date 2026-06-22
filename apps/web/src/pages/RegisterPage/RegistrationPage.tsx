import type { FormEvent } from "react";
import { useState } from "react";
import type { PanelVisualState } from "../../components/AuthPanels";
import { PrimaryButton } from "../../components/PrimaryButton";
import { getDemoPrefillCredentials } from "../../lib/demo-api";
import { isDemoMode } from "../../lib/demo-mode";
import "../LoginPage/LoginPage.css";

type RegistrationPageProps = {
  showContent?: boolean;
  panelState?: PanelVisualState;
  exitActive?: boolean;
  onLogin?: () => void;
  onSubmit?: (data: { email: string; password: string; name: string }) => Promise<void>;
  error?: string | null;
  pending?: boolean;
};

export function RegistrationPage({
  showContent = true,
  panelState = "visible",
  exitActive = false,
  onLogin,
  onSubmit,
  error,
  pending = false,
}: RegistrationPageProps) {
  const demoCredentials = isDemoMode() ? getDemoPrefillCredentials() : null;
  const [email, setEmail] = useState(demoCredentials?.email ?? "");
  const [password, setPassword] = useState(demoCredentials?.password ?? "");

  const interactive = showContent && panelState === "visible" && !pending;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!interactive) return;
    const name = email.split("@")[0]?.trim() || "User";
    void onSubmit?.({ email, password, name });
  };

  const panelClassName = [
    "login__panel",
    "login__panel--register",
    panelState === "inactive" ? "login__panel--inactive" : "",
    panelState === "exiting" ? "login__panel--exiting" : "",
    panelState === "exiting" && exitActive ? "login__panel--exit-active" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={panelClassName} aria-hidden={!interactive}>
      <h1 className="welcome__title">Регистрация</h1>

      <form id="registration-form" className="login__fields" onSubmit={handleSubmit}>
        <input
          className="login__field"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="Email"
          aria-label="Email"
          tabIndex={interactive ? 0 : -1}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="login__field"
          type="password"
          name="password"
          autoComplete="new-password"
          placeholder="Пароль"
          aria-label="Пароль"
          tabIndex={interactive ? 0 : -1}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
        />
      </form>

      {error ? <p className="login__error">{error}</p> : null}

      <PrimaryButton
        type="submit"
        form="registration-form"
        tabIndex={interactive ? 0 : -1}
        disabled={!interactive}
      >
        {pending ? "Регистрация…" : "Создать аккаунт"}
      </PrimaryButton>

      <button
        type="button"
        className="login__link"
        onClick={onLogin}
        tabIndex={interactive ? 0 : -1}
      >
        Вход
      </button>
    </div>
  );
}
