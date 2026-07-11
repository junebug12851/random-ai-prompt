/**
 * @file
 * @brief Playwright config for the MOBILE target (`tests/e2e-mobile/`).
 *
 * Separate from the root `playwright.config.js` (which drives the web SPA) because it serves a
 * different artifact: the mobile app's **react-native-web export**. That's how a React Native UI is
 * driven in a browser — the same components, the same handlers, rendered through react-native-web —
 * so axe can scan it, Playwright can shoot it, and the perf specs can drive it at max load. It is a
 * proxy for the device, not a replacement: it verifies the component tree, the a11y semantics, the
 * layout at every size, and the render cost of large lists. It cannot verify native-only behavior
 * (real gesture handling, native module I/O) — that stays the job of the jest-expo suite and a real
 * device.
 *
 * Sizes mirror the mandate: no feature loss from a size change, so every spec runs across the
 * phone→tablet range, in BOTH colour schemes (the app defaults to "system", so light-only would
 * never render the dark canvas the design is built around).
 *
 * Run: `npm run test:e2e:mobile`  (needs `npx playwright install chromium` once).
 */
import { defineConfig, devices } from "@playwright/test";

const PORT = 8100;

/** The device matrix — matches scripts/mobile-visual-parity.mjs. */
const SIZES = [
  { id: "phone-small", width: 360, height: 800 },
  { id: "phone", width: 390, height: 844 },
  { id: "phone-large", width: 430, height: 932 },
  { id: "tablet-portrait", width: 834, height: 1112 },
  { id: "tablet-landscape", width: 1112, height: 834 },
];

const projects = [];
for (const size of SIZES) {
  for (const colorScheme of ["light", "dark"]) {
    projects.push({
      name: `${size.id}-${colorScheme}`,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: size.width, height: size.height },
        colorScheme,
        // Expose the size/scheme to the specs (visual baselines are named per project).
        deviceScaleFactor: 1,
      },
    });
  }
}

export default defineConfig({
  testDir: "tests/e2e-mobile",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  timeout: 60_000,
  expect: {
    // Visual baselines: allow a hair of anti-aliasing noise, nothing more.
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: "disabled" },
  },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects,
  webServer: {
    command: `npm --prefix targets/mobile run export:web && node scripts/serve-mobile-web.mjs --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
