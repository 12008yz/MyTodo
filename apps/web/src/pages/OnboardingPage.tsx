import { useAuth } from "../features/auth/AuthProvider";

export function OnboardingPage() {
  const { user } = useAuth();

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <h1 className="mb-2 text-2xl font-semibold">Онбординг</h1>
      <p className="text-slate-600">
        Привет, {user?.name}! Здесь будет мастер настройки профиля и привычек (блок 2
        frontend).
      </p>
    </div>
  );
}
