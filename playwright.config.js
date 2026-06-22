/**
 * @file
 * Playwright config for the SPA's E2E, visual-regression, and accessibility specs.
 * Builds the React app and serves the static `dist/` via `vite preview`, then drives
 * it in a real browser. Generation is prompt-only (no SD WebUI needed); any provider
 * network call in a test is route-mocked.
 */
import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : [["list"], ["html", { open: "never" }]],
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.02, animations: "disabled" },
  },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  // Use the system-installed Google Chrome (`channel: "chrome"`). The bundled
  // Chrome-for-Testing build fails to launch on some Windows machines with a
  // side-by-side ("SxS") configuration error; the system Chrome has the correct
  // runtime. CI can drop this `channel` to use the bundled browser instead.
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], channel: "chrome" } }],
  webServer: {
    command: `npm run web:build && npm --prefix web-app run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 240000,
  },
});
