import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./App.css";
import "./features/charts/HabitTrendCard.css";
import { AuthProvider } from "./features/auth/AuthProvider";
import { AppShell } from "./layouts/AppShell/AppShell";
import { GuestWelcomeFlow } from "./pages/GuestWelcomeFlow";
import { HomePage } from "./pages/HomePage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { ProfilePage } from "./pages/ProfilePage/ProfilePage";
import { BookReaderPage } from "./pages/BookReaderPage/BookReaderPage";
import { EnglishPage } from "./pages/EnglishPage/EnglishPage";
import { NutritionPage } from "./pages/NutritionPage/NutritionPage";
import { ProgressPage } from "./pages/ProgressPage/ProgressPage";
import { AuthGuard, GuestGuard, OnboardingGuard } from "./routes/guards";
import { NotFoundRedirect } from "./routes/NotFoundRedirect";

const ChartsPage = lazy(() =>
  import("./pages/ChartsPage/ChartsPage").then((module) => ({ default: module.ChartsPage })),
);

function ChartsPageFallback() {
  return (
    <div className="habit-trend-card habit-trend-card--skeleton" aria-busy="true" aria-label="Загрузка графиков" />
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <main className="app">
          <Routes>
            <Route element={<GuestGuard />}>
              <Route path="/welcome" element={<GuestWelcomeFlow />} />
              <Route path="/login" element={<GuestWelcomeFlow />} />
              <Route path="/register" element={<GuestWelcomeFlow />} />
            </Route>

            <Route element={<OnboardingGuard />}>
              <Route path="/onboarding" element={<OnboardingPage />} />
            </Route>

            <Route element={<AuthGuard />}>
              <Route path="/habits/:habitId/read" element={<BookReaderPage />} />
              <Route path="/habits/:habitId/nutrition" element={<NutritionPage />} />
              <Route path="/english" element={<EnglishPage />} />
              <Route element={<AppShell />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/progress" element={<ProgressPage />} />
                <Route
                  path="/charts"
                  element={
                    <Suspense fallback={<ChartsPageFallback />}>
                      <ChartsPage />
                    </Suspense>
                  }
                />
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
