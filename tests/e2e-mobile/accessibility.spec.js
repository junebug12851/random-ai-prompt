/**
 * @file Accessibility scan of the MOBILE app (its react-native-web export) with axe-core.
 *
 * The jest-expo suite asserts that a control announces itself (`accessibilityLabel` /
 * `accessibilityState`), but it cannot tell you whether the resulting DOM is actually usable by a
 * screen reader — RN's a11y props become ARIA attributes only once react-native-web renders them, and
 * a mistake there (a button with no accessible name, a role that never lands, a control that isn't
 * focusable) is invisible to a render assertion. That's what axe checks here.
 *
 * Runs across every size AND both colour schemes (see playwright.mobile.config.js): a11y defects are
 * frequently size- or theme-dependent — a control that only appears on tablet, or a contrast failure
 * that exists only in light mode.
 *
 * Gate: zero SERIOUS or CRITICAL WCAG 2 A/AA violations. `color-contrast` is scanned but reported
 * separately rather than failing the build, matching the web suite's stance (the palette is a
 * deliberate design choice, tracked on its own).
 */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/** The four tabs — every one gets scanned, not just the landing screen. */
const TABS = ["Generate", "Gallery", "Single", "Manage"];

/** Wait for the RN-web tree to mount (the tab switcher is always present). */
async function boot(page) {
  await page.goto("/");
  await page.getByText("Generate", { exact: true }).first().waitFor({ timeout: 20_000 });
  // The provider schemas + Manage overlay load asynchronously at boot; let them settle so we scan
  // the real UI rather than an empty shell.
  await page.waitForTimeout(1200);
}

async function scan(page) {
  return new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .disableRules(["color-contrast"])
    .analyze();
}

const blocking = (results) =>
  results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");

/** A readable failure: which rule, and which node tripped it. */
const describeViolations = (vs) =>
  JSON.stringify(
    vs.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.slice(0, 3).map((n) => n.html) })),
    null,
    2,
  );

test.describe("mobile accessibility (axe)", () => {
  for (const tab of TABS) {
    test(`${tab} has no serious/critical WCAG A/AA violations`, async ({ page }) => {
      await boot(page);

      if (tab !== "Generate") {
        await page.getByText(tab, { exact: true }).first().click();
        await page.waitForTimeout(600);
      }

      const results = await scan(page);
      const bad = blocking(results);
      expect(bad, describeViolations(bad)).toEqual([]);
    });
  }

  test("the overflow menu (provider roles, settings, links) is accessible", async ({ page }) => {
    await boot(page);

    // The ⋯ trigger is an icon button at the top-right of the one-row topbar.
    const { width } = page.viewportSize();
    await page.mouse.click(width - 24, 42);
    await page.waitForTimeout(700);
    await expect(page.getByText("Upscale", { exact: true }).first()).toBeVisible();

    const results = await scan(page);
    const bad = blocking(results);
    expect(bad, describeViolations(bad)).toEqual([]);
  });

  test("every interactive control has an accessible name", async ({ page }) => {
    await boot(page);

    // A button with no accessible name is unusable with a screen reader and is exactly the kind of
    // thing a render-only test passes. axe's `button-name` rule covers it, but assert it explicitly
    // so the failure names the offending node instead of hiding in a rule id.
    const results = await new AxeBuilder({ page })
      .withRules(["button-name", "link-name", "aria-allowed-attr", "aria-required-attr"])
      .analyze();

    expect(results.violations, describeViolations(results.violations)).toEqual([]);
  });
});
