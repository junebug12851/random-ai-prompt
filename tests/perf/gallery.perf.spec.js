/**
 * @file Perf scenario: a 100,000-image photo gallery. Proves the virtualized grid keeps the DOM
 * bounded (only ~viewport cells exist regardless of the total), stays smooth to scroll deep into the
 * feed, and doesn't blow the heap — the un-virtualized grid would mount 100k <img> nodes and hang.
 */
import { test, expect } from "@playwright/test";
import { MAX_LOAD } from "./fixtures.js";
import {
  routeGallery,
  domCount,
  heapMB,
  scrollAndSampleFrames,
  timeUntil,
  BUDGETS,
} from "./helpers.js";

test.describe("Gallery — 100k images", () => {
  test.beforeEach(async ({ page }) => {
    await routeGallery(page, MAX_LOAD.galleryImages);
  });

  test("stays bounded, smooth, and within the heap ceiling", async ({ page }) => {
    await page.goto("/");

    // Open the Gallery tab and wait for the virtualized grid to render its first cells.
    const openMs = await timeUntil(
      () => page.getByRole("tab", { name: "Gallery" }).click(),
      () => page.locator(".g-grid .g-cell").first().waitFor({ state: "visible" }),
    );
    expect(openMs, "open the 100k gallery").toBeLessThan(BUDGETS.tabSwitchMs * 3);

    // The count reflects the full feed…
    await expect(page.locator(".g-count")).toContainText("100,000");

    // …but only a small window of cells is actually in the DOM (the virtualization proof).
    const cellsAtTop = await domCount(page, ".g-cell");
    expect(cellsAtTop, "rendered cells at top").toBeGreaterThan(0);
    expect(cellsAtTop, "rendered cells at top").toBeLessThan(BUDGETS.maxGalleryCells);

    // Scroll deep into the feed and sample frame intervals.
    const frames = await scrollAndSampleFrames(page, { scroller: ".gallery-view", steps: 150 });
    expect(frames.count, "sampled frames").toBeGreaterThan(30);
    expect(frames.median, "median frame time (ms)").toBeLessThan(BUDGETS.scrollMedianMs);
    expect(frames.p95, "p95 frame time (ms)").toBeLessThan(BUDGETS.scrollP95Ms);

    // Still bounded after scrolling far in.
    const cellsDeep = await domCount(page, ".g-cell");
    expect(cellsDeep, "rendered cells deep in the feed").toBeLessThan(BUDGETS.maxGalleryCells);

    const heap = await heapMB(page);
    if (heap != null) expect(heap, "JS heap (MB)").toBeLessThan(BUDGETS.heapCeilingMB);
  });
});
