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

/* global document, getComputedStyle -- the page.evaluate() callbacks run in the browser context. */

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

// --- Phase 4a: the building-block palette becomes a phone drawer ---

const fab = ".palette-fab";
const sidebar = "#block-palette";

/** Wait for the drawer's slide transition to settle, then return its left edge (x). */
async function sidebarX(page) {
  const box = await page.locator(sidebar).boundingBox();
  return box ? box.x : null;
}

test.describe("building-block palette — desktop", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("palette is inline; no drawer trigger", async ({ page }) => {
    await page.goto("/");
    await page.locator(sidebar).waitFor();
    await expect(page.locator(sidebar)).toBeVisible();
    await expect(page.locator(fab)).toBeHidden();
    // In-flow (left edge at/after the viewport's left origin).
    expect(await sidebarX(page)).toBeGreaterThanOrEqual(0);
  });
});

test.describe("building-block palette — phone drawer", () => {
  test.use({ viewport: { width: 390, height: 780 } });

  test("palette is an off-canvas drawer opened by the trigger", async ({ page }) => {
    await page.goto("/");
    await page.locator(".workspace").waitFor();

    // Trigger present, drawer parked off-canvas to the left, composer full width.
    await expect(page.locator(fab)).toBeVisible();
    await expect(page.locator(fab)).toHaveAttribute("aria-expanded", "false");
    await expect.poll(() => sidebarX(page)).toBeLessThan(0);
    expect(await hasHorizontalOverflow(page)).toBe(false);

    // Open: the drawer slides fully into view and its blocks are reachable.
    await page.locator(fab).click();
    await expect(page.locator(fab)).toHaveAttribute("aria-expanded", "true");
    await expect.poll(() => sidebarX(page)).toBeGreaterThanOrEqual(0);
    await expect(page.locator(`${sidebar} .picker-filter`)).toBeVisible();

    // Escape dismisses it back off-canvas.
    await page.keyboard.press("Escape");
    await expect.poll(() => sidebarX(page)).toBeLessThan(0);

    // Reopen, then the in-drawer ✕ (same handler as the scrim tap-away) dismisses it.
    await page.locator(fab).click();
    await expect.poll(() => sidebarX(page)).toBeGreaterThanOrEqual(0);
    await page.locator(`${sidebar} .palette-close`).click();
    await expect.poll(() => sidebarX(page)).toBeLessThan(0);
  });
});

// --- Phase 4b: the Single view stacks image over metadata on narrow screens ---

const FEED = {
  items: [
    {
      path: "/api/output/responsive-test.png",
      file: "responsive-test.png",
      name: "responsive-test",
      mtime: Date.now(),
      meta: {
        provider: "test",
        providerLabel: "Test",
        prompt: { dpl: "a red fox", roll: "a red fox", ai: null, final: "a red fox" },
        settings: { width: 512, height: 512 },
        savedAt: new Date().toISOString(),
      },
    },
  ],
};

/** Number of column tracks in the single-view body grid at the current width. */
async function singleBodyColumnCount(page) {
  // Populate the local-only gallery feed so the Single view has an image to show.
  await page.route("**/api/feed", (route) => route.fulfill({ json: FEED }));
  const feedLoaded = page.waitForResponse((r) => r.url().includes("/api/feed"));
  await page.goto("/");
  await feedLoaded;
  await page.getByRole("tab", { name: "Single" }).click();
  const body = page.locator(".g-single-body");
  await body.waitFor();
  return body.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
}

test.describe("single view — desktop", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("image + metadata are two columns", async ({ page }) => {
    expect(await singleBodyColumnCount(page)).toBe(2);
  });
});

test.describe("single view — phone", () => {
  test.use({ viewport: { width: 390, height: 800 } });

  test("image stacks over metadata (one column, image un-stuck)", async ({ page }) => {
    expect(await singleBodyColumnCount(page)).toBe(1);
    const pos = await page
      .locator(".g-single-img")
      .evaluate((el) => getComputedStyle(el).position);
    expect(pos).toBe("static");
    expect(await hasHorizontalOverflow(page)).toBe(false);
  });
});
