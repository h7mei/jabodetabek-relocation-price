import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  optimizeDeps: {
    // Prebundle main entry; worker is set explicitly via setWorkerUrl
    include: ["maplibre-gl"],
  },
  build: {
    // MapLibre + map chunk is expected; ScenarioMap is already lazy-loaded
    chunkSizeWarningLimit: 1000,
    target: "es2022",
  },
})
