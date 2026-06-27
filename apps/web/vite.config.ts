import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig } from "vite";

function exerciseCacheHeaders(): Plugin {
  const setHeaders = (req: { url?: string }, res: { setHeader: (k: string, v: string) => void }, next: () => void) => {
    if (req.url?.startsWith("/exercises/")) {
      // Dev: avoid immutable caching so replaced files under the same path show up immediately.
      res.setHeader("Cache-Control", "no-cache");
    }
    next();
  };

  return {
    name: "exercise-cache-headers",
    configureServer(server) {
      server.middlewares.use(setHeaders);
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith("/exercises/")) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), exerciseCacheHeaders()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
