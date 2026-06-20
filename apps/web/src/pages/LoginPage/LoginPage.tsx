import type { FormEvent } from "react";
import { useState } from "react";
import type { PanelVisualState } from "../../components/AuthPanels";
import { PrimaryButton } from "../../components/PrimaryButton";
import "./LoginPage.css";

type LoginPageProps = {
  showContent?: boolean;
  panelState?: PanelVisualState;
  exitActive?: boolean;
  onRegistration?: () => void;
  onSubmit?: (data: { email: string; password: string }) => Promise<void>;
  error?: string | null;
  pending?: boolean;
};

export function LoginPage({
  showContent = true,
  panelState = "visible",
  exitActive = false,
  onRegistration,
  onSubmit,
  error,
  pending = false,
}: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const interactive = showContent && panelState === "visible" && !pending;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!interactive) return;
    void onSubmit?.({ email, password });
  };

  const panelClassName = [
    "login__panel",
    panelState === "inactive" ? "login__panel--inactive" : "",
    panelState === "exiting" ? "login__panel--exiting" : "",
    panelState === "exiting" && exitActive ? "login__panel--exit-active" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={panelClassName} aria-hidden={!interactive}>
      <h1 className="welcome__title">Вход</h1>

      <form id="login-form" className="login__fields" onSubmit={handleSubmit}>
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
          autoComplete="current-password"
          placeholder="Пароль"
          aria-label="Пароль"
          tabIndex={interactive ? 0 : -1}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </form>

      {error ? <p className="login__error">{error}</p> : null}

      <PrimaryButton
        type="submit"
        form="login-form"
        tabIndex={interactive ? 0 : -1}
        disabled={!interactive}
      >
        {pending ? "Вход…" : "Войти"}
      </PrimaryButton>

      <button
        type="button"
        className="login__link"
        onClick={onRegistration}
        tabIndex={interactive ? 0 : -1}
      >
        Регистрация
      </button>
    </div>
  );
}
