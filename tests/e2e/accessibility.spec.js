/**
 * @file Accessibility scan of the SPA with axe-core. Asserts there are no
 * serious/critical WCAG 2 A/AA violations. Color-contrast is excluded here because
 * the dark theme's palette is a deliberate design choice tracked separately; remove
 * that exclusion to tighten the gate.
 */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("accessibility", () => {
  test("home page has no serious/critical WCAG A/AA violations", async ({ page }) => {
    await page.goto("/");
    await page.locator(".topbar").waitFor();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .disableRules(["color-contrast"])
      .analyze();

    const blocking = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    // Surface details in the test output if this ever fails.
    expect(blocking, JSON.stringify(blocking.map((v) => v.id), null, 2)).toEqual([]);
  });

  test("results region is reachable after generating", async ({ page }) => {
    await page.goto("/");
    await page.locator("textarea").fill("a fox");
    await page.getByRole("button", { name: "Generate prompt" }).click();
    await expect(page.getByRole("heading", { name: "Prompts" })).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .disableRules(["color-contrast"])
      .analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(blocking, JSON.stringify(blocking.map((v) => v.id), null, 2)).toEqual([]);
  });
});
