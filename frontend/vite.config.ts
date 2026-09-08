import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// CrimeNet AI — Vite configuration.
// The dev server proxies /api and /ws to the FastAPI backend so the browser
// only ever talks to same-origin URLs (works behind the preview proxy too).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 3000,
    allowedHosts: true, // accept the live-preview host in sandboxed environments
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://localhost:8000",
        ws: true,
        changeOrigin: true,
      },
      "/health": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      "/docs": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      "/openapi.json": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  preview: { host: "0.0.0.0", port: 3000, allowedHosts: true },
  build: {
    outDir: "dist",
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
  },
});
