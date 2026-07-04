/**
 * @file Perf scenario: a 100,000-line list in the Manage editor. Exercises the REAL file backend
 * (serve.js reads the real 100k-line file from disk), and proves the windowed entry list stays
 * bounded + smooth to scroll, the search filter over 100k entries is responsive, and switching
 * entry↔raw (CodeMirror) mode doesn't hang. The fixture file is created on disk for this spec only
 * and removed after.
 */
import { test, expect } from "@playwright/test";
import { MAX_LOAD, bigListText, writePerfList, removePerfList } from "./fixtures.js";
import { domCount, heapMB, scrollAndSampleFrames, timeUntil, BUDGETS } from "./helpers.js";

const FILE = "perf-harness-huge.txt";
const LABEL = "perf-harness-huge";

test.describe("Manage — 100k-line list", () => {
  test.beforeAll(() => writePerfList(FILE, bigListText(MAX_LOAD.manageLines)));
  test.afterAll(() => removePerfList(FILE));

  test("loads, windows, filters, and switches modes without perf loss", async ({ page }) => {
    await page.goto("/");

    // Open Manage (needs the real local backend) and find the huge list via the tree search.
    await page.getByRole("tab", { name: "Manage" }).click();
    await page.locator(".mg-tree").waitFor({ state: "visible" });
    await page.locator(".mg-sidebar .picker-filter").fill(LABEL);
    const pill = page.locator(".mg-pill", { hasText: LABEL }).first();
    await pill.waitFor({ state: "visible" });

    // Select it → the list editor reads the real 100k-line file and renders windowed rows.
    const loadMs = await timeUntil(
      () => pill.click(),
      () => page.locator(".mg-rows .mg-row").first().waitFor({ state: "visible" }),
    );
    expect(loadMs, "load + render a 100k-line list").toBeLessThan(8000);

    // The count note reflects all entries… (localized with a thousands separator)
    await expect(page.locator(".mg-count-note")).toContainText("100,000");
    // …but only a windowed slice of rows is in the DOM.
    const rowsAtTop = await domCount(page, ".mg-row");
    expect(rowsAtTop, "windowed rows").toBeGreaterThan(0);
    expect(rowsAtTop, "windowed rows").toBeLessThan(BUDGETS.maxManageRows);

    // Scroll through the list — smooth + still bounded.
    const frames = await scrollAndSampleFrames(page, { scroller: ".mg-rows", steps: 150 });
    expect(frames.median, "median frame time (ms)").toBeLessThan(BUDGETS.scrollMedianMs);
    expect(frames.p95, "p95 frame time (ms)").toBeLessThan(BUDGETS.scrollP95Ms);
    expect(await domCount(page, ".mg-row"), "rows after scroll").toBeLessThan(
      BUDGETS.maxManageRows,
    );

    // Filtering 100k entries stays responsive and narrows the match count.
    const filterMs = await timeUntil(
      () => page.locator(".mg-editor .picker-filter").fill("perf entry 99999"),
      () => expect(page.locator(".mg-count-note")).toContainText("1 match"),
    );
    expect(filterMs, "filter 100k entries").toBeLessThan(4000);
    await page.locator(".mg-editor .picker-filter").fill(""); // clear

    // Switch entry↔raw (CodeMirror over 100k lines) without hanging.
    const toRaw = await timeUntil(
      () => page.getByRole("tab", { name: "Raw" }).click(),
      () => page.locator(".mg-cm .cm-content").waitFor({ state: "visible" }),
    );
    expect(toRaw, "switch to Raw (100k lines)").toBeLessThan(8000);
    const toEntries = await timeUntil(
      () => page.getByRole("tab", { name: "Entries" }).click(),
      () => page.locator(".mg-rows .mg-row").first().waitFor({ state: "visible" }),
    );
    expect(toEntries, "switch back to Entries").toBeLessThan(8000);

    const heap = await heapMB(page);
    if (heap != null) expect(heap, "JS heap (MB)").toBeLessThan(BUDGETS.heapCeilingMB);
  });
});
