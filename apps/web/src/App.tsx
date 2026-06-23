import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./App.css";
import { AuthProvider } from "./features/auth/AuthProvider";
import { AppShell } from "./layouts/AppShell/AppShell";
import { GuestWelcomeFlow } from "./pages/GuestWelcomeFlow";
import { HomePage } from "./pages/HomePage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { ChartsPage } from "./pages/ChartsPage/ChartsPage";
import { ProfilePage } from "./pages/ProfilePage/ProfilePage";
import { ProgressPage } from "./pages/ProgressPage/ProgressPage";
import { AuthGuard, GuestGuard, OnboardingGuard } from "./routes/guards";
import { NotFoundRedirect } from "./routes/NotFoundRedirect";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <main className="app">
          <Routes>
            <Route element={<GuestGuard />}>
              <Route element={<GuestWelcomeFlow />}>
                <Route path="/welcome" />
                <Route path="/login" />
                <Route path="/register" />
              </Route>
            </Route>

            <Route element={<OnboardingGuard />}>
              <Route path="/onboarding" element={<OnboardingPage />} />
            </Route>

            <Route element={<AuthGuard />}>
              <Route element={<AppShell />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/progress" element={<ProgressPage />} />
                <Route path="/charts" element={<ChartsPage />} />
                <Route path="/profile" element={<ProfilePage />} />
              </Route>
            </Route>

            <Route path="*" element={<NotFoundRedirect />} />
          </Routes>
        </main>
      </AuthProvider>
    </BrowserRouter>
  );
}
