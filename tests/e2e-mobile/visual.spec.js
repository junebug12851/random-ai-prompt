/**
 * @file Visual-regression baselines for the MOBILE app (react-native-web export).
 *
 * Committed PNG baselines, one per surface × size × colour scheme (Playwright names them per project,
 * so `phone-dark/…` and `tablet-portrait-light/…` are separate files). A layout regression — a clipped
 * tab strip at 360px, a control that slides under the FAB, a panel that stops being centred on tablet —
 * changes pixels and fails here, which no marker or render test can do.
 *
 * These are a SAFETY NET, not a substitute for looking: a baseline only catches a change from the last
 * accepted state, and it will happily lock in a defect if you accept it. The screenshots still get
 * eyeballed (working-agreements §B3). Refresh deliberately with:
 *   npm run test:e2e:mobile:update
 *
 * The prompt box carries a rotating random suggestion that re-rolls every 5s, and the Gallery/Single
 * views render device images — both would make the shot non-deterministic, so they're neutralised
 * below.
 */
import { test, expect } from "@playwright/test";

const TABS = ["Generate", "Gallery", "Single", "Manage"];

/**
 * Boot the app and freeze everything time-dependent, so a baseline diff means a LAYOUT change and
 * never "the random suggestion happened to be longer this run".
 */
async function boot(page) {
  await page.goto("/");
  await page.getByText("Generate", { exact: true }).first().waitFor({ timeout: 20_000 });
  await page.waitForTimeout(1200); // provider schemas + Manage overlay settle

  // Pin the rotating suggestion: it lands in the placeholder, so it WOULD change the pixels every 5s.
  await page.addStyleTag({
    content: `
      /* Kill animation/transition timing so a shot is never caught mid-transition. */
      *, *::before, *::after { transition: none !important; animation: none !important; }
    `,
  });
  // Blank any placeholder that carries the random suggestion (the "Try: …" text).
  await page.evaluate(() => {
    for (const el of document.querySelectorAll("input, textarea")) {
      if (el.placeholder?.startsWith("Try: ")) el.placeholder = "Try: …";
    }
  });
}

test.describe("mobile visual baselines", () => {
  for (const tab of TABS) {
    test(`${tab} matches its baseline`, async ({ page }) => {
      await boot(page);

      if (tab !== "Generate") {
        await page.getByText(tab, { exact: true }).first().click();
        await page.waitForTimeout(600);
      }

      await expect(page).toHaveScreenshot(`${tab.toLowerCase()}.png`, { fullPage: false });
    });
  }

  test("the overflow menu matches its baseline", async ({ page }) => {
    await boot(page);
    const { width } = page.viewportSize();
    await page.mouse.click(width - 24, 42);
    await page.waitForTimeout(700);
    await expect(page.getByText("Upscale", { exact: true }).first()).toBeVisible();

    await expect(page).toHaveScreenshot("overflow.png", { fullPage: false });
  });
});
