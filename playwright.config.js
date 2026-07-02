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
  // Visual-regression specs render pixel-exact screenshots and need per-OS baselines
  // (`*-chromium-win32.png` / `*-chromium-linux.png`). Set `PLAYWRIGHT_SKIP_VISUAL=1` to skip
  // them on a runner that has no committed baselines for its platform yet (the E2E and a11y
  // specs are rendering-independent and always run).
  testIgnore: process.env.PLAYWRIGHT_SKIP_VISUAL ? ["**/visual.spec.js"] : [],
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
  // Browser by OS so each platform's visual baselines stay reproducible:
  // - Windows → system Google Chrome (`channel: "chrome"`); the bundled
  //   Chrome-for-Testing build fails to launch on some Windows side-by-side (SxS)
  //   setups. Baselines: `*-chromium-win32.png`.
  // - Linux → Playwright's bundled chromium (no channel). This is exactly what the
  //   CI e2e job uses (ubuntu-latest + `npx playwright install --with-deps chromium`),
  //   so the committed `*-chromium-linux.png` baselines match CI. Regenerate them on
  //   the same runner via the "Update visual baselines (Linux)" workflow
  //   (`.github/workflows/visual-baselines.yml`), then commit the downloaded PNGs.
  //
  // Cross-browser: the default run is Chromium-only (the fast local gate, and the
  // only browser with committed visual baselines). Set `PLAYWRIGHT_ALL_BROWSERS=1`
  // (the `test:e2e:all` script / the CI cross-browser job) to also run Firefox, WebKit,
  // and a mobile (Pixel 7) viewport. Visual-regression stays Chromium-only — pixel
  // baselines are per-engine — so the extra projects skip `visual.spec.js`.
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        channel: process.platform === "win32" ? "chrome" : undefined,
      },
    },
    ...(process.env.PLAYWRIGHT_ALL_BROWSERS
      ? [
          {
            name: "firefox",
            use: { ...devices["Desktop Firefox"] },
            testIgnore: "**/visual.spec.js",
          },
          {
            name: "webkit",
            use: { ...devices["Desktop Safari"] },
            testIgnore: "**/visual.spec.js",
          },
          {
            name: "mobile-chrome",
            use: { ...devices["Pixel 7"] },
            testIgnore: "**/visual.spec.js",
          },
        ]
      : []),
  ],
  webServer: {
    command: `npm run web:build && npm --prefix gui run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 240000,
  },
});
