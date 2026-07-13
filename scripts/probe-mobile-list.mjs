/**
 * @file A one-off probe: does the mobile results list VIRTUALIZE?
 *
 * The on-device gate proved the app's render path is super-linear (engine: 20→675 ms, 200→5.2 s,
 * 1000→13.3 s — linear and fine; total: 200 prompts never finished in 600 s). That points at the list.
 * The react-native-web export reproduces the same pathology, and it iterates in seconds instead of
 * 40-minute CI cycles — so the diagnosis happens here, and the *verdict* still happens on the device.
 *
 * Run: node scripts/probe-mobile-list.mjs [N]
 * (Needs the export: `npm --prefix targets/mobile run export:web`, and Playwright's chromium.)
 */
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";

const N = Number(process.argv[2] || 100);
const PORT = 8123;

const server = spawn(process.execPath, ["scripts/serve-mobile-web.mjs", "--port", String(PORT)], {
  stdio: "ignore",
});
await new Promise((r) => setTimeout(r, 1500));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
try {
  await page.goto(`http://127.0.0.1:${PORT}/`);
  await page.getByText("Generate", { exact: true }).first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(1000);

  const count = page.getByLabel("Number of prompts per roll");
  await count.fill(String(N));

  const t0 = Date.now();
  await page.getByLabel("Generate prompts").click();

  // Wait for the app to say it produced them all — the same signal the device suite waits on.
  await page
    .getByText(`${N} generated`)
    .waitFor({ timeout: 120000 })
    .catch(() => {});
  const elapsed = Date.now() - t0;

  // THE question: how many result rows are actually in the DOM? A virtualized list holds a window
  // (~10–20). If this is ~N, the list is mounting everything and that is the whole bug.
  const rows = await page.locator("text=/^#\\d+$/").count();
  console.log(`N=${N}  elapsed=${elapsed}ms  rows mounted in the DOM: ${rows}`);
  console.log(
    rows > N * 0.5
      ? "VERDICT: NOT virtualizing — the list mounts (nearly) every row."
      : "VERDICT: virtualized — a bounded window of rows is mounted.",
  );
} finally {
  await browser.close();
  server.kill();
}
