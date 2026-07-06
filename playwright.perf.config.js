/**
 * @file Playwright config for the **large-scale performance suite** (tests/perf/). Distinct from the
 * functional E2E config (playwright.config.js) because it runs against the real **release server**
 * (`targets/web/backend/serve.js`) — the full `/api/*` backend — so the Manage file-read and `fs.watch`
 * hot-reload paths are exercised for real (the gallery feed is route-mocked to 100k in-spec). Runs
 * serially (workers: 1) so scenarios don't compete for CPU and skew the timing budgets, and launches
 * Chromium with precise memory info so the heap-ceiling assertions are meaningful.
 *
 * The suite guards the officially supported maximum simultaneous load — a 100k-image gallery, 1000
 * prompts × ~10 images, and a 100k-line Manage file — staying smooth, bounded, and stable.
 */
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PERF_PORT) || 4184;

export default defineConfig({
  testDir: "tests/perf",
  testMatch: "**/*.perf.spec.js",
  fullyParallel: false,
  workers: 1, // serial — perf measurements must not compete for CPU
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 180_000, // scenarios push 100k items / 1000 prompts through the app
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
    // Precise JS-heap numbers for the memory-ceiling assertions (Chromium only).
    launchOptions: { args: ["--enable-precise-memory-info"] },
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Mirror the E2E config: system Chrome on Windows (the bundled build has SxS launch issues
        // on some Windows setups); Playwright's bundled chromium elsewhere (matches CI).
        channel: process.platform === "win32" ? "chrome" : undefined,
      },
    },
  ],
  webServer: {
    // Build once, then serve the real release build + /api backend. NO_OPEN keeps it headless.
    command: "npm run web:build && node targets/web/backend/serve.js",
    url: `http://localhost:${PORT}`,
    env: { NO_OPEN: "1", PORT: String(PORT) },
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
