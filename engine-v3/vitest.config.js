/**
 * @file
 * Root Vitest config — the Node-side test suite (core engine, shared browser-safe
 * modules, integration, contract/API, snapshot, and bug-regression tests). Runs in the
 * `node` environment; the React SPA has its own jsdom config under `gui/`.
 *
 * Scope rule (matches CLAUDE.md): tests target the ACTIVE engine (`src/core/**`) and the
 * shared pure modules only — never the legacy classic server (`src/server.js`,
 * `src/web/frontend/**`, `src/prompt-modules/**` except the pure stages the core engine
 * still imports, i.e. cleanup.js / prompt-salt.js).
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.js"],
    // The SPA suite is run separately (npm run test:web) with its own jsdom config.
    exclude: ["node_modules/**", "gui/**", "tests/e2e/**"],
    globals: false,
    coverage: {
      provider: "v8",
      reportsDirectory: "coverage/node",
      include: [
        "src/core/**/*.js",
        "src/contentSafety.js",
        "src/gatedLists.js",
        "src/listManifest.js",
        "src/dynPromptManifest.js",
        "src/promptFilesAndSuggestions.js",
        "src/helpers/*.js",
        "src/prompt-modules/cleanup.js",
        "src/prompt-modules/prompt-salt.js",
      ],
      // The browser loader + its code-split prompt-corpus module are exercised by the SPA (jsdom)
      // suite via import.meta.glob, so they aren't measurable from the Node environment — exclude them
      // from the Node gate.
      exclude: ["src/core/browserLoader.js", "src/core/browserCatalogData.js"],
      // `lcov` is added for Codecov (CI uploads coverage/node/lcov.info); text+html are for humans.
      reporter: ["text", "html", "lcov"],
      // CI gate (owner-approved). Set with headroom below the measured numbers
      // (lines ~93 / statements ~90 / functions ~93 / branches ~80) so a real
      // regression fails CI without flaking on minor churn. Tighten as coverage grows.
      thresholds: {
        statements: 88,
        branches: 76,
        functions: 88,
        lines: 90,
      },
    },
  },
});
