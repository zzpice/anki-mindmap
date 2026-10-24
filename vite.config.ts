import { defineConfig } from "vite";
import { sourceFingerprint } from "./scripts/test_build.mjs";
export default defineConfig({
  plugins: [{ name: "test-build-fingerprint", generateBundle() {
    this.emitFile({ type: "asset", fileName: "source-fingerprint.json",
      source: JSON.stringify({ sourceFingerprint: sourceFingerprint() }) });
  } }],
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: {
    outDir: "build/runtime",
    target: "es2020",
    // Keep both backdrop-filter spellings. The CSS optimizer can collapse the
    // original standard + WebKit declarations to a WebKit-only rule, losing
    // the frosted Cloze effect in Chromium/Anki Desktop.
    cssMinify: false,
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
