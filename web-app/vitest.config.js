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
      exclude: ["src/main.jsx", "**/*.test.{js,jsx}"],
      reporter: ["text", "html"],
    },
  },
});
