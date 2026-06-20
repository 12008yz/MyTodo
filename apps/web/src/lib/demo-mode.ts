export const DEMO_EMAIL = "demo@mytodo.app";
export const DEMO_PASSWORD = "demo12345";

/** Frontend-only flow for Vercel previews without a backend. */
export function isDemoMode(): boolean {
  if (import.meta.env.VITE_DEMO_MODE === "true") return true;
  if (import.meta.env.VITE_DEMO_MODE === "false") return false;
  return import.meta.env.PROD && !import.meta.env.VITE_API_URL;
}
