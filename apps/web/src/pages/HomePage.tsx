import { useAuth } from "../features/auth/AuthProvider";

export function HomePage() {
  const { user, logout } = useAuth();

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Сегодня</h1>
          <p className="text-slate-600">{user?.name}</p>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600"
        >
          Выйти
        </button>
      </header>

      <p className="rounded-lg border border-dashed border-slate-300 p-4 text-slate-600 dark:border-slate-600">
        Дашборд «Сегодня» — блок 3 frontend. Trial до{" "}
        {user?.trial_ends_at
          ? new Date(user.trial_ends_at).toLocaleDateString("ru-RU")
          : "—"}
        .
      </p>
    </div>
  );
}
