/**
 * @file Perf scenario: hot-reload of extremely large externally-added / modified files. Writes a
 * 100k-line list to disk WHILE the app is open (the real `fs.watch` SSE path), and asserts the app
 * stays responsive through the reload and the catalog picks the new/changed file up automatically —
 * no freeze when a huge file lands out from under it.
 */
import { test, expect } from "@playwright/test";
import { MAX_LOAD, bigListText, writePerfList, removePerfList } from "./fixtures.js";
import { scrollAndSampleFrames, BUDGETS } from "./helpers.js";

const FILE = "perf-harness-hot.txt";
const LABEL = "perf-harness-hot";

// Sample frame intervals for ~1.5s of idle/scroll so a background reload's jank (if any) shows up.
async function stayssmooth(page) {
  const frames = await scrollAndSampleFrames(page, {
    scroller: ".mg-tree",
    distance: 200,
    steps: 90,
  });
  return frames;
}

test.describe("Hot-reload — huge external files", () => {
  test.afterAll(() => removePerfList(FILE));

  test("adding & modifying a 100k-line file on disk doesn't freeze the app", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("tab", { name: "Manage" }).click();
    await page.locator(".mg-tree").waitFor({ state: "visible" });

    // --- Externally ADD a huge file while the app is open (fs.watch → SSE → catalog refresh). ---
    writePerfList(FILE, bigListText(MAX_LOAD.manageLines, "added"));

    // The app stays smooth right after the big write.
    const framesAfterAdd = await stayssmooth(page);
    expect(framesAfterAdd.median, "median frame time after add (ms)").toBeLessThan(
      BUDGETS.scrollMedianMs,
    );
    expect(framesAfterAdd.p95, "p95 frame time after add (ms)").toBeLessThan(BUDGETS.scrollP95Ms);

    // And the new file auto-appears in the tree (hot-reload applied without a manual refresh).
    await page.locator(".mg-sidebar .picker-filter").fill(LABEL);
    await expect(page.locator(".mg-pill", { hasText: LABEL }).first()).toBeVisible({
      timeout: 15_000,
    });

    // --- Externally MODIFY the same huge file. ---
    writePerfList(FILE, bigListText(MAX_LOAD.manageLines + 5, "modified"));
    const framesAfterMod = await stayssmooth(page);
    expect(framesAfterMod.median, "median frame time after modify (ms)").toBeLessThan(
      BUDGETS.scrollMedianMs,
    );

    // Selecting the (now modified) huge file still loads its windowed rows.
    await page.locator(".mg-pill", { hasText: LABEL }).first().click();
    await page.locator(".mg-rows .mg-row").first().waitFor({ state: "visible", timeout: 15_000 });
    await expect(page.locator(".mg-count-note")).toContainText("100,005");
  });
});
