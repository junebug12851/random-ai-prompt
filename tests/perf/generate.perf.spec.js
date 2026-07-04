/**
 * @file Perf scenario: 1000 generated prompts in the results list. Proves the list "rolls out all at
 * once" (every row present) yet stays smooth to scroll and cheap to keep mounted across tab switches
 * — via render-containment (`content-visibility`) on the rows + a memoized row component. (The
 * placeholder-first, concurrency-limited image streaming that pairs with this at 10k images is
 * covered deterministically by the useImageBatches unit test; here we stress the list itself.)
 */
import { test, expect } from "@playwright/test";
import { MAX_LOAD } from "./fixtures.js";
import { domCount, heapMB, scrollAndSampleFrames, timeUntil, BUDGETS } from "./helpers.js";

test.describe("Generate — 1000 prompts", () => {
  test("rolls out 1000 rows, scrolls smoothly, and switches tabs fast", async ({ page }) => {
    await page.goto("/");
    await page.locator(".prompt-input .cm-content").waitFor({ state: "visible" });

    // Generate in the app's real per-run chunks (50 max, enforced by buildRoll) until 1000 exist.
    const perRun = 50;
    const runs = MAX_LOAD.prompts / perRun;
    await page.getByLabel("Prompts per run").fill(String(perRun));
    const genBtn = page.getByRole("button", { name: "Generate prompt" });

    const buildMs = await timeUntil(
      async () => {
        for (let i = 0; i < runs; i++) await genBtn.click();
      },
      () =>
        expect(page.locator("ul.prompts > li")).toHaveCount(MAX_LOAD.prompts, { timeout: 60_000 }),
    );
    // Generating 1000 prompts should never lock the tab for an unreasonable time.
    expect(buildMs, "build 1000 prompts").toBeLessThan(45_000);

    // Every prompt is present ("rolled out all at once").
    expect(await domCount(page, "li.prompt-result")).toBe(MAX_LOAD.prompts);
    await expect(page.locator(".results-card .count")).toContainText("1000");

    // Scrolling the big list stays smooth (render-containment skips off-screen rows).
    const frames = await scrollAndSampleFrames(page, { scroller: ".home .main-col", steps: 150 });
    expect(frames.count, "sampled frames").toBeGreaterThan(30);
    expect(frames.median, "median frame time (ms)").toBeLessThan(BUDGETS.scrollMedianMs);
    expect(frames.p95, "p95 frame time (ms)").toBeLessThan(BUDGETS.scrollP95Ms);

    // Switch to the Single view and back with the big list mounted — must stay responsive.
    const toSingle = await timeUntil(
      () => page.getByRole("tab", { name: "Single" }).click(),
      () => page.locator(".view-pane.on").waitFor({ state: "visible" }),
    );
    expect(toSingle, "switch to Single").toBeLessThan(BUDGETS.tabSwitchMs);
    const backToGen = await timeUntil(
      () => page.getByRole("tab", { name: "Generate" }).click(),
      () => page.locator("ul.prompts").waitFor({ state: "visible" }),
    );
    expect(backToGen, "switch back to Generate").toBeLessThan(BUDGETS.tabSwitchMs);

    const heap = await heapMB(page);
    if (heap != null) expect(heap, "JS heap (MB)").toBeLessThan(BUDGETS.heapCeilingMB);
  });
});
