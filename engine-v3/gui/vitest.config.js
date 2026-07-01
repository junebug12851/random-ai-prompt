/**
 * @file
 * Vitest config for the React SPA. Reuses the app's Vite config (react plugin,
 * the lodash alias, and the repo-root `fs.allow` the shared core engine needs) and
 * layers on a jsdom environment for component tests plus Testing Library setup.
 */
import { mergeConfig } from "vitest/config";
import viteConfig from "./vite.config.js";

export default mergeConfig(viteConfig, {
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["./tests/setup.js"],
    include: ["tests/**/*.test.{js,jsx}", "src/**/*.test.{js,jsx}"],
    coverage: {
      provider: "v8",
      reportsDirectory: "coverage",
      include: ["src/**/*.{js,jsx}"],
      exclude: [
        "src/main.jsx",
        "src/i18n/compiled/**",
        // CodeMirror language support — the StreamLanguage grammar and its context-aware
        // autocomplete source — verified via the e2e editor specs, not unit-mounted.
        "src/lib/dpl/dplLanguage.js",
        "src/lib/dpl/dplComplete.js",
        "src/lib/providers/index.js",
        "**/*.test.{js,jsx}",
      ],
      // `lcov` is added for Codecov (CI uploads gui/coverage/lcov.info); text+html are for humans.
      reporter: ["text", "html", "lcov"],
      // CI gate (owner-approved). The well-covered logic lives in src/lib (~73% lines);
      // it gets a real floor. The components/editors are exercised by the Playwright e2e
      // flows rather than unit-mounted, so the GLOBAL floor is intentionally modest — it
      // catches a gross regression without forcing every editor to be unit-tested.
      thresholds: {
        lines: 25,
        statements: 25,
        functions: 25,
        branches: 18,
        "src/lib/**/*.js": {
          lines: 65,
          statements: 65,
          functions: 60,
          branches: 50,
        },
      },
    },
  },
});
