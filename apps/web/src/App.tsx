import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./App.css";
import { AuthProvider } from "./features/auth/AuthProvider";
import { GuestAuthPage } from "./pages/GuestAuthPage";
import { HomePage } from "./pages/HomePage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { WelcomePage } from "./pages/WelcomePage";
import { AuthGuard, GuestGuard, OnboardingGuard } from "./routes/guards";
import { NotFoundRedirect } from "./routes/NotFoundRedirect";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <main className="app">
          <Routes>
            <Route element={<GuestGuard />}>
              <Route path="/welcome" element={<WelcomePage />} />
              <Route path="/login" element={<GuestAuthPage />} />
              <Route path="/register" element={<GuestAuthPage />} />
            </Route>

            <Route element={<OnboardingGuard />}>
              <Route path="/onboarding" element={<OnboardingPage />} />
            </Route>

            <Route element={<AuthGuard />}>
              <Route path="/" element={<HomePage />} />
            </Route>

            <Route path="*" element={<NotFoundRedirect />} />
          </Routes>
        </main>
      </AuthProvider>
    </BrowserRouter>
  );
}
