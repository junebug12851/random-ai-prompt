/**
 * @file Regression: the DPL autocomplete popup + its info panel must stay readable in dark mode.
 * CodeMirror injects its default (light) tooltip theme UNLAYERED, which beats our `@layer components`
 * overrides unless they use `!important` — without the fix the info panel rendered light-on-light
 * (near-invisible). This asserts a dark surface + light text in a dark colour scheme.
 * See targets/web/frontend/styles/components/generic-code-highlighting.css.
 */
import { test, expect } from "@playwright/test";

/* global getComputedStyle -- the evaluate() callbacks run in the browser context. */

/** Perceived luminance (0–255) of a `rgb(...)` string. */
function lum(rgb) {
  const [r, g, b] = rgb.match(/\d+/g).map(Number);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

test.describe("autocomplete popup contrast", () => {
  test.use({ colorScheme: "dark" });

  test("the completion info panel is a dark surface with light text", async ({ page }) => {
    await page.goto("/");
    await page.locator(".composer-field").waitFor();
    const editor = page.locator(".prompt-input .cm-content");
    await editor.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.press("Delete");
    for (const ch of "{#fut") {
      await page.keyboard.type(ch);
      await page.waitForTimeout(60); // let CM's activate-on-typing open the popup
    }

    const info = page.locator(".cm-completionInfo");
    await info.waitFor({ timeout: 8000 });
    const bg = await info.evaluate((el) => getComputedStyle(el).backgroundColor);
    const fg = await page.locator(".cm-dpl-info-desc").evaluate((el) => getComputedStyle(el).color);

    // Dark surface (not CM's light rgb(245,245,245) default) and light text → readable.
    expect(lum(bg)).toBeLessThan(90);
    expect(lum(fg)).toBeGreaterThan(140);
  });
});
