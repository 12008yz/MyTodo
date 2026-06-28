export const DEMO_EMAIL = "demo@mytodo.app";
export const DEMO_PASSWORD = "demo12345";

/** Frontend-only flow: `pnpm dev:demo` or static Vercel deploy without API. */
export function isDemoMode(): boolean {
  if (import.meta.env.MODE === "demo") return true;
  if (import.meta.env.DEV) return false;
  if (import.meta.env.VITE_DEMO_MODE === "true") return true;
  if (import.meta.env.VITE_DEMO_MODE === "false") return false;
  return import.meta.env.PROD && !import.meta.env.VITE_API_URL;
}
