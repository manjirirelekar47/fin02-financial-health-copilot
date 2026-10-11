import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const BACKEND = "http://127.0.0.1:8000";

// Proxy rule factory — Vite preserves the full path by default (no rewrite needed).
const proxy = (target) => ({ target, changeOrigin: true });

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // R1 routes:  GET /api/summary → http://127.0.0.1:8000/api/summary
      "/api": proxy(BACKEND),

      // R2 routes registered at the root (no /api prefix in FastAPI):
      "/simulate":    proxy(BACKEND),   // GET /simulate/presets, POST /simulate
      "/twin":        proxy(BACKEND),   // GET /twin/benchmark
      "/optimize":    proxy(BACKEND),   // POST /optimize
      "/categoriser": proxy(BACKEND),   // GET /categoriser/review-queue
      "/agent":       proxy(BACKEND),   // POST /agent/chat
      "/transactions": proxy(BACKEND),  // POST /transactions (live update)
      "/calibration": proxy(BACKEND),   // GET /calibration
    },
  },
});


