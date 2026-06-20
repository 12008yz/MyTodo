import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Gender } from "@mytodo/shared";
import { GENDERS } from "@mytodo/shared";
import { ClientApiError } from "../lib/api";
import { useAuth } from "../features/auth/AuthProvider";

const genderLabels: Record<Gender, string> = {
  male: "Мужской",
  female: "Женский",
  other: "Другой",
};

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [age, setAge] = useState(25);
  const [gender, setGender] = useState<Gender>("male");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      await register({ email, password, name, age, gender });
      navigate("/onboarding");
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Не удалось зарегистрироваться");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-8">
      <h1 className="mb-2 text-2xl font-semibold">Новая глава</h1>
      <p className="mb-6 text-slate-600">Создание аккаунта</p>

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
          <span className="mb-1 block text-sm">Пароль (мин. 8 символов)</span>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm">Имя</span>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm">Возраст</span>
          <input
            type="number"
            required
            min={10}
            max={120}
            value={age}
            onChange={(e) => setAge(Number(e.target.value))}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm">Пол</span>
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value as Gender)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
          >
            {GENDERS.map((value) => (
              <option key={value} value={value}>
                {genderLabels[value]}
              </option>
            ))}
          </select>
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900"
        >
          {pending ? "Регистрация…" : "Зарегистрироваться"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        Уже есть аккаунт?{" "}
        <Link to="/login" className="font-medium text-slate-900 underline dark:text-slate-100">
          Войти
        </Link>
      </p>
    </div>
  );
}
