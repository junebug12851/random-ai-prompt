/**
 * @file Responsive top-bar behaviour across viewports (Phase 3 of the responsive work,
 * notes/plans/responsive.md). Functional, not pixel-based, so it runs on any platform /
 * browser without committed screenshot baselines. Verifies that:
 *   - desktop shows the secondary controls inline and hides the "⋯" overflow toggle;
 *   - narrow screens collapse the controls behind the toggle, which opens a panel and
 *     dismisses on Escape / outside-click;
 *   - the phone layout drops the wordmark and never overflows the viewport horizontally.
 */
import { test, expect } from "@playwright/test";

/* global document -- the page.evaluate() callbacks below execute in the browser context. */

const toggle = ".topbar-overflow-toggle";
const controls = ".topbar-controls";

async function hasHorizontalOverflow(page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
}

test.describe("top bar — desktop (wide)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("controls are inline; overflow toggle is hidden", async ({ page }) => {
    await page.goto("/");
    await page.locator(".topbar").waitFor();
    await expect(page.locator(".brand .wordmark")).toBeVisible();
    await expect(page.locator(controls)).toBeVisible();
    await expect(page.locator(toggle)).toBeHidden();
    expect(await hasHorizontalOverflow(page)).toBe(false);
  });
});

test.describe("top bar — phone (narrow)", () => {
  test.use({ viewport: { width: 390, height: 780 } });

  test("controls collapse behind the overflow toggle", async ({ page }) => {
    await page.goto("/");
    await page.locator(".topbar").waitFor();

    // Wordmark dropped to reclaim width; the logo stays.
    await expect(page.locator(".brand .wordmark")).toBeHidden();
    await expect(page.locator(".brand img")).toBeVisible();

    // Toggle present, panel closed to start (SSR-safe default).
    await expect(page.locator(toggle)).toBeVisible();
    await expect(page.locator(toggle)).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator(controls)).toBeHidden();

    // No horizontal overflow at phone width.
    expect(await hasHorizontalOverflow(page)).toBe(false);

    // Open: the panel and its controls (e.g. the links trigger) become reachable.
    await page.locator(toggle).click();
    await expect(page.locator(toggle)).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator(controls)).toBeVisible();
    await expect(page.locator(`${controls} .links-trigger`)).toBeVisible();

    // Escape dismisses.
    await page.keyboard.press("Escape");
    await expect(page.locator(controls)).toBeHidden();
    await expect(page.locator(toggle)).toHaveAttribute("aria-expanded", "false");

    // Reopen, then an outside click dismisses.
    await page.locator(toggle).click();
    await expect(page.locator(controls)).toBeVisible();
    await page.locator("main").click({ position: { x: 10, y: 10 } });
    await expect(page.locator(controls)).toBeHidden();
  });
});

test.describe("top bar — tablet (portrait)", () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  test("controls are collapsed at <= 820px", async ({ page }) => {
    await page.goto("/");
    await page.locator(".topbar").waitFor();
    await expect(page.locator(toggle)).toBeVisible();
    await expect(page.locator(controls)).toBeHidden();
    expect(await hasHorizontalOverflow(page)).toBe(false);
  });
});
