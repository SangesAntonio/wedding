import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" così il sito funziona anche dentro una sottocartella (GitHub Pages).
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    target: "es2020",
    chunkSizeWarningLimit: 1200,
  },
});
