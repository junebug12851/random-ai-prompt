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
        "src/diffSettings.js",
        "src/gatedLists.js",
        "src/listManifest.js",
        "src/helpers/keywordRepeater.js",
        "src/prompt-modules/cleanup.js",
        "src/prompt-modules/prompt-salt.js",
      ],
      reporter: ["text", "html"],
    },
  },
});
