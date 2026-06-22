/**
 * @file Visual-regression specs. Baselines are committed under
 * tests/e2e/__screenshots__ and refreshed with `npm run test:e2e:update`. Dynamic
 * regions (the random suggestion in the prompt box, generated results) are masked so
 * only stable chrome is compared.
 */
import { test, expect } from "@playwright/test";

test.describe("visual regression", () => {
  test("top bar is stable", async ({ page }) => {
    await page.goto("/");
    const topbar = page.locator(".topbar");
    await topbar.waitFor();
    await expect(topbar).toHaveScreenshot("topbar.png");
  });

  test("building-blocks sidebar is stable", async ({ page }) => {
    await page.goto("/");
    const sidebar = page.locator(".sidebar");
    await sidebar.waitFor();
    // The block palette is driven by the bundled data, so it renders deterministically.
    await expect(sidebar).toHaveScreenshot("sidebar.png", {
      // The search field placeholder is static; mask nothing dynamic here.
      maxDiffPixelRatio: 0.03,
    });
  });

  test("full page (prompt box masked)", async ({ page }) => {
    await page.goto("/");
    await page.locator(".topbar").waitFor();
    await expect(page).toHaveScreenshot("home-full.png", {
      fullPage: true,
      // The composer's placeholder shows a random suggestion each load — mask it.
      mask: [page.locator("textarea")],
      maxDiffPixelRatio: 0.03,
    });
  });
});
