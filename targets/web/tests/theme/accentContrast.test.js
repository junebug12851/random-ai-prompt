/**
 * @file Accessibility guardrail: every accent preset must be legible.
 *
 * Asserts two WCAG contrast contracts for each accent, in both bases:
 *  - ink-on-accent >= 4.5  (a button label on an accent-filled button — normal text)
 *  - accent-on-canvas >= 3.0 on the DARK base (accent used as an icon/large label on
 *    the dark canvas — the 3:1 UI/large-text threshold). Light isn't asserted here:
 *    the accent is not used as small text on light surfaces (matches the shipped
 *    mint, which is intentionally low-contrast-as-text on light).
 *
 * A failure means an accent would ship illegible — fix the value in presets.js.
 */
import { describe, it, expect } from "vitest";
import { ACCENTS } from "../../frontend/theme/presets.js";

const DARK_CANVAS = "#1c1c1f"; // --p-dark-canvas

function channel(c) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}
function luminance(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

describe("accent preset contrast (WCAG AA)", () => {
  for (const accent of ACCENTS) {
    it(`${accent.id}: ink is legible on the accent (both bases)`, () => {
      expect(contrast(accent.dark.ink, accent.dark.accent)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(accent.light.ink, accent.light.accent)).toBeGreaterThanOrEqual(4.5);
    });

    it(`${accent.id}: the dark-base accent reads on the dark canvas`, () => {
      expect(contrast(accent.dark.accent, DARK_CANVAS)).toBeGreaterThanOrEqual(3.0);
    });
  }
});
