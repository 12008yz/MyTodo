import { Navigate } from "react-router-dom";
import { useAuth } from "../features/auth/AuthProvider";

export function NotFoundRedirect() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return <div className="app-loading">Загрузка…</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/welcome" replace />;
  }

  if (user && !user.onboarding_completed) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Navigate to="/" replace />;
}
