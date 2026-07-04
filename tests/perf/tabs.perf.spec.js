/**
 * @file Perf scenario: the **officially supported maximum simultaneous load** — a 100k-image gallery
 * + 1000 prompts + a 100k-line Manage file, all loaded at once, with every tab kept mounted. Proves
 * switching between the loaded tabs stays fast, the heap stays under the ceiling (the browser isn't
 * weighed down by all tabs staying loaded), and the virtualized surfaces stay bounded. This is the
 * whole-app stability guard for the load the app promises to handle.
 */
import { test, expect } from "@playwright/test";
import { MAX_LOAD, bigListText, writePerfList, removePerfList } from "./fixtures.js";
import {
  routeGallery,
  domCount,
  heapMB,
  scrollAndSampleFrames,
  timeUntil,
  BUDGETS,
} from "./helpers.js";

const FILE = "perf-harness-max.txt";
const LABEL = "perf-harness-max";

test.describe("Max load — everything at once", () => {
  test.beforeAll(() => writePerfList(FILE, bigListText(MAX_LOAD.manageLines)));
  test.afterAll(() => removePerfList(FILE));
  test.beforeEach(async ({ page }) => routeGallery(page, MAX_LOAD.galleryImages));

  test("100k gallery + 1000 prompts + 100k Manage file stays fast and bounded", async ({
    page,
  }) => {
    await page.goto("/");
    await page.locator(".prompt-input .cm-content").waitFor({ state: "visible" });

    // 1) 1000 prompts.
    await page.getByLabel("Prompts per run").fill("50");
    const gen = page.getByRole("button", { name: "Generate prompt" });
    for (let i = 0; i < MAX_LOAD.prompts / 50; i++) await gen.click();
    await expect(page.locator("ul.prompts > li")).toHaveCount(MAX_LOAD.prompts, {
      timeout: 60_000,
    });

    // 2) 100k gallery.
    await page.getByRole("tab", { name: "Gallery" }).click();
    await page.locator(".g-grid .g-cell").first().waitFor({ state: "visible" });
    await expect(page.locator(".g-count")).toContainText("100,000");

    // 3) 100k Manage file.
    await page.getByRole("tab", { name: "Manage" }).click();
    await page.locator(".mg-sidebar .picker-filter").fill(LABEL);
    await page.locator(".mg-pill", { hasText: LABEL }).first().click();
    await page.locator(".mg-rows .mg-row").first().waitFor({ state: "visible" });

    // Now everything is loaded and every pane is mounted. Switching between them must stay fast.
    const targets = [
      ["Generate", "ul.prompts"],
      ["Gallery", ".gallery-view .g-cell"],
      ["Manage", ".mg-main"],
      ["Single", ".view-pane.on"],
      ["Generate", "ul.prompts"],
    ];
    for (const [name, sel] of targets) {
      const ms = await timeUntil(
        () => page.getByRole("tab", { name }).click(),
        () => page.locator(sel).first().waitFor({ state: "visible" }),
      );
      expect(ms, `switch to ${name} under max load`).toBeLessThan(BUDGETS.tabSwitchMs);
    }

    // Round-trip quality: after switching away and back, SCROLLING is still as smooth as on first
    // load (no degradation from the tab churn). Check the results list (we're on Generate now)…
    const genFrames = await scrollAndSampleFrames(page, { scroller: ".home .main-col", steps: 120 });
    expect(genFrames.median, "results scroll after round-trip (ms)").toBeLessThan(BUDGETS.scrollMedianMs);

    // …and the 100k gallery after returning to it — still smooth AND still bounded.
    await page.getByRole("tab", { name: "Gallery" }).click();
    await page.locator(".gallery-view .g-cell").first().waitFor({ state: "visible" });
    const galFrames = await scrollAndSampleFrames(page, { scroller: ".gallery-view", steps: 120 });
    expect(galFrames.median, "gallery scroll after round-trip (ms)").toBeLessThan(BUDGETS.scrollMedianMs);
    expect(galFrames.p95, "gallery p95 after round-trip (ms)").toBeLessThan(BUDGETS.scrollP95Ms);
    expect(await domCount(page, ".g-cell"), "gallery cells after round-trip").toBeLessThan(
      BUDGETS.maxGalleryCells,
    );

    // The whole app under max load stays under the heap ceiling (all tabs mounted).
    const heap = await heapMB(page);
    if (heap != null)
      expect(heap, "JS heap (MB) under max load").toBeLessThan(BUDGETS.heapCeilingMB);
  });
});
