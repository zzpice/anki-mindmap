import { defineConfig } from "vite";
export default defineConfig({
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: {
    outDir: "build/runtime",
    target: "es2020",
    sourcemap: "hidden",
    lib: {
      entry: "src/entry.tsx",
      name: "AnkiMindmap",
      formats: ["iife"],
      fileName: () => "_mm_react.js",
      cssFileName: "_mm_react",
    },
  },
});
