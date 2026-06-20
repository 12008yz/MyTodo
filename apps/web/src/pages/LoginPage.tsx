import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ClientApiError } from "../lib/api";
import { useAuth } from "../features/auth/AuthProvider";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      const user = await login({ email, password });
      navigate(user.onboarding_completed ? "/" : "/onboarding");
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Не удалось войти");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <h1 className="mb-2 text-2xl font-semibold">Новая глава</h1>
      <p className="mb-6 text-slate-600">Вход в аккаунт</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm">Пароль</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900"
        >
          {pending ? "Вход…" : "Войти"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        Нет аккаунта?{" "}
        <Link to="/register" className="font-medium text-slate-900 underline dark:text-slate-100">
          Регистрация
        </Link>
      </p>
    </div>
  );
}
