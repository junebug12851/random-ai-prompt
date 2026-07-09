/**
 * @file Regression: the DPL editor's line-number gutter and active-line must stay dark-mode-correct.
 * CodeMirror 6 ships a gutter baseTheme with BOTH `&light .cm-gutters {#f5f5f5}` and a `&dark`
 * variant, picked by whether the view's theme declares `{ dark: true }`. Our editors don't, so CM
 * stayed in light mode and injected the light gutter (#f5f5f5 — a bright-white slab), the light
 * active-line gutter (#e2f2ff), and a milky blue active-line wash (rgba(204,238,255,.267)) — at the
 * same specificity as our plain-CSS override, beating it on source order. The fix moves the chrome
 * colors into a CodeMirror `theme` extension (StyleModule priority > baseTheme).
 * This asserts: a non-light gutter surface, and a NEUTRAL (not blue-tinted) active-line band.
 * See targets/web/frontend/lib/editorChrome.js.
 */
import { test, expect } from "@playwright/test";

/* global getComputedStyle -- the evaluate() callbacks run in the browser context. */

/** Normalise a computed color string (`rgb(...)`, `rgba(...)`, or `color(srgb r g b / a)`) to
 *  [r, g, b] on a 0–255 scale. The `color(srgb ...)` form reports channels as 0–1 fractions. */
function channels(str) {
  const nums = (str.match(/[\d.]+/g) || []).map(Number);
  if (/^color\(/.test(str)) return nums.slice(0, 3).map((v) => v * 255);
  return nums.slice(0, 3);
}

/** Perceived luminance (0–255). */
function lum([r, g, b]) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

test.describe("DPL editor chrome (dark mode)", () => {
  test.use({ colorScheme: "dark" });

  test("gutter is not a bright-white slab and the active line is a neutral (untinted) band", async ({
    page,
  }) => {
    await page.goto("/");
    await page.locator(".composer-field").waitFor();
    const editor = page.locator(".prompt-input .cm-content");
    await editor.click(); // give the current line an active-line highlight

    const gutterBg = await page
      .locator(".prompt-input .cm-gutters")
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    const activeLineBg = await page
      .locator(".prompt-input .cm-activeLine")
      .first()
      .evaluate((el) => getComputedStyle(el).backgroundColor);

    // The gutter must not be CM's light #f5f5f5 (lum ≈ 245). Transparent → lum 0.
    expect(lum(channels(gutterBg))).toBeLessThan(90);

    // The active line must be a neutral lift, not a blue-tinted wash. CM's default
    // rgba(204,238,255,…) has blue far above red (b − r ≈ 51); a neutral grey has b ≈ r.
    const [r, , b] = channels(activeLineBg);
    expect(b - r).toBeLessThan(20);
  });
});
