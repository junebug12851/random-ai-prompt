/**
 * @file
 * Root Vitest config — the Node-side test suite (core engine, shared browser-safe
 * modules, integration, contract/API, snapshot, and bug-regression tests). Runs in the
 * `node` environment; the React SPA has its own jsdom config under `targets/web/`.
 *
 * Scope rule (matches CLAUDE.md): tests target the ACTIVE engine (`engine/core/**`) and the
 * shared pure modules only — never the legacy classic server (`engine/server.js`,
 * `engine/web/frontend/**`, `engine/core/stages/**` except the pure stages the core engine
 * still imports, i.e. cleanup.js / prompt-salt.js).
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.js"],
    // The SPA suite is run separately (npm run test:web) with its own jsdom config.
    exclude: ["node_modules/**", "targets/web/**", "tests/e2e/**"],
    globals: false,
    coverage: {
      provider: "v8",
      reportsDirectory: "coverage/node",
      include: [
        "engine/core/**/*.js",
        "engine/contentSafety.js",
        "engine/gatedLists.js",
        "engine/listManifest.js",
        // The barrel above was split into these three focused, browser-safe modules; the list
        // tests exercise them through it, so they must be measured here or their coverage is lost
        // (SonarCloud then counts every line as uncovered).
        "engine/listTags.js",
        "engine/nameOrder.js",
        "engine/listResolve.js",
        "engine/blockManifest.js",
        "engine/promptFilesAndSuggestions.js",
        "engine/helpers/*.js",
        "engine/core/stages/cleanup.js",
        "engine/core/stages/prompt-salt.js",
      ],
      // The browser loader + its code-split prompt-corpus module are exercised by the SPA (jsdom)
      // suite via import.meta.glob, so they aren't measurable from the Node environment — exclude them
      // from the Node gate.
      exclude: ["engine/core/browserLoader.js", "engine/core/browserCatalogData.js"],
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
