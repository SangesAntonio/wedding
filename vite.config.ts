import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

// base "./" così il sito funziona anche dentro una sottocartella (GitHub Pages).
// Due pagine: l'invito (index.html) e l'area sposi (sposi/index.html), con bundle separati.
// Tailwind agisce solo sui CSS che lo importano: cioè solo l'area sposi.
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": resolve(__dirname, "src") },
  },
  build: {
    target: "es2020",
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      input: {
        invito: resolve(__dirname, "index.html"),
        sposi: resolve(__dirname, "sposi/index.html"),
      },
    },
  },
});
