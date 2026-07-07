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
    include: ["tests/**/*.test.{js,jsx}", "frontend/**/*.test.{js,jsx}"],
    coverage: {
      provider: "v8",
      reportsDirectory: "coverage",
      include: ["frontend/**/*.{js,jsx}"],
      exclude: [
        "frontend/main.jsx",
        "frontend/i18n/compiled/**",
        // CodeMirror language support — the StreamLanguage grammar and its context-aware
        // autocomplete source — verified via the e2e editor specs, not unit-mounted.
        "frontend/lib/dpl/dplLanguage.js",
        "frontend/lib/dpl/dplComplete.js",
        // CodeMirror interactive glue — the hover intensity/focus dials and the `+` line-action
        // gutter/menu are DOM/ViewPlugin code, verified in the live editor (Chrome) + e2e, not
        // unit-mounted (jsdom has no layout, so coordsAtPos/posAtCoords are meaningless here).
        "frontend/lib/dpl/dplDials.js",
        "frontend/lib/dpl/dplLineActions.js",
        "frontend/lib/providers/index.js",
        "**/*.test.{js,jsx}",
      ],
      // `lcov` is added for Codecov (CI uploads gui/coverage/lcov.info); text+html are for humans.
      reporter: ["text", "html", "lcov"],
      // CI gate (owner-approved). The well-covered logic lives in frontend/lib (~73% lines);
      // it gets a real floor. The components/editors are exercised by the Playwright e2e
      // flows rather than unit-mounted, so the GLOBAL floor is intentionally modest — it
      // catches a gross regression without forcing every editor to be unit-tested.
      thresholds: {
        lines: 25,
        statements: 25,
        functions: 25,
        branches: 18,
        "frontend/lib/**/*.js": {
          lines: 65,
          statements: 65,
          functions: 60,
          branches: 50,
        },
      },
    },
  },
});
