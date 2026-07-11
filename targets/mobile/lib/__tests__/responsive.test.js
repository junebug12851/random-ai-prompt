/**
 * @file Unit tests for the responsive tier classifier (lib/responsive.js). Guards the mandate that the
 * mobile app mirrors the web breakpoints (phone ≤768, tablet 769–1024, wide >1024) and that larger
 * screens get two-pane + a capped reading column — with NO size-based feature loss.
 */
import {
  resolveResponsive,
  PHONE_MAX,
  TABLET_MAX,
  CONTENT_MAX_WIDTH,
} from "../responsive.js";

describe("resolveResponsive — tiers mirror the web breakpoints", () => {
  it("classifies phones (≤768) as single-column, no two-pane", () => {
    for (const w of [360, 390, 430, PHONE_MAX]) {
      const r = resolveResponsive(w, 844);
      expect(r.tier).toBe("phone");
      expect(r.isPhone).toBe(true);
      expect(r.twoPane).toBe(false);
      expect(r.isTabletOrWider).toBe(false);
    }
  });

  it("classifies tablets (769–1024) as two-pane", () => {
    for (const w of [769, 834, TABLET_MAX]) {
      const r = resolveResponsive(w, 1112);
      expect(r.tier).toBe("tablet");
      expect(r.isTablet).toBe(true);
      expect(r.twoPane).toBe(true);
      expect(r.isTabletOrWider).toBe(true);
    }
  });

  it("classifies wide (>1024) as wide + two-pane", () => {
    const r = resolveResponsive(1112, 834);
    expect(r.tier).toBe("wide");
    expect(r.isWide).toBe(true);
    expect(r.twoPane).toBe(true);
  });

  it("reports orientation and a capped reading column", () => {
    expect(resolveResponsive(1112, 834).landscape).toBe(true);
    expect(resolveResponsive(834, 1112).landscape).toBe(false);
    expect(resolveResponsive(390, 844).contentMaxWidth).toBe(CONTENT_MAX_WIDTH);
  });
});
