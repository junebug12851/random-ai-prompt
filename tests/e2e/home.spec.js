/**
 * @file E2E happy-path for the SPA: load, type a prompt, generate, see results, and
 * use the building-block search. Pure client-side (no image generation), so no
 * network backend is required.
 */
import { test, expect } from "@playwright/test";

test.describe("Home — prompt generation", () => {
  test("loads the app shell", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".topbar .wordmark")).toHaveText("Random AI Prompt");
    await expect(page.locator("textarea")).toBeVisible();
  });

  test("generates prompts from a typed prompt", async ({ page }) => {
    await page.goto("/");
    await page.locator("textarea").fill("a red fox in a forest");
    await page.getByRole("button", { name: "Generate prompt" }).click();

    const results = page.locator(".results-card");
    await expect(results).toBeVisible();
    await expect(results.getByRole("heading", { name: "Prompts" })).toBeVisible();
    await expect(results.locator("ul.prompts > li")).toHaveCount(1);
    await expect(results.locator("ul.prompts > li").first()).toContainText("fox");
  });

  test("filters the building blocks", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".panel-title")).toHaveText("Building blocks");
    const search = page.getByPlaceholder("Search blocks…");

    // A nonsense query shows the empty state…
    await search.fill("zzzznotarealblock");
    await expect(page.locator(".sidebar .empty")).toBeVisible();

    // …and a real query brings blocks back.
    await search.fill("color");
    await expect(page.locator(".sidebar .empty")).toHaveCount(0);
  });
});
