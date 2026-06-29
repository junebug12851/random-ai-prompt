/**
 * @file Run the Playwright suite across ALL browsers (Chromium + Firefox + WebKit +
 * mobile) by setting PLAYWRIGHT_ALL_BROWSERS for the child process. A tiny cross-platform
 * wrapper so `npm run test:e2e:all` works the same on Windows and Linux/CI (no cross-env
 * dependency). Requires the extra browsers once: `npx playwright install firefox webkit`.
 */
import { spawnSync } from "node:child_process";

const r = spawnSync("npx", ["playwright", "test"], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, PLAYWRIGHT_ALL_BROWSERS: "1" },
});
process.exit(r.status ?? 1);
