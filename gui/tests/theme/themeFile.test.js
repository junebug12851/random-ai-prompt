/**
 * @file Tests for theme-file parse/validate/serialize. The rejection cases are
 * the security contract: only allow-listed fields + hex colours get through, so
 * a theme file can't smuggle arbitrary CSS.
 */
import { describe, it, expect } from "vitest";
import { parseThemeFile, serializeTheme } from "../../src/theme/themeFile.js";

const valid = {
  id: "ocean",
  label: "Ocean",
  swatch: "#2299ff",
  dark: { accent: "#2299ff", ink: "#001022" },
  light: { accent: "#88ccff", ink: "#001022" },
};

describe("parseThemeFile", () => {
  it("accepts a bare theme object, a JSON string, and a wrapped file", () => {
    expect(parseThemeFile(valid).ok).toBe(true);
    expect(parseThemeFile(JSON.stringify(valid)).ok).toBe(true);
    expect(parseThemeFile({ format: "rap-theme", version: 1, theme: valid }).ok).toBe(true);
  });

  it("normalizes id + colours and clamps the label", () => {
    const r = parseThemeFile({
      ...valid,
      id: "  OCEAN  ",
      label: "  " + "x".repeat(60),
      dark: { accent: "#2299FF", ink: "#001022" },
    });
    expect(r.ok).toBe(true);
    expect(r.theme.id).toBe("ocean");
    expect(r.theme.dark.accent).toBe("#2299ff");
    expect(r.theme.label.length).toBeLessThanOrEqual(40);
  });

  it("rejects invalid JSON", () => {
    expect(parseThemeFile("{ not json").ok).toBe(false);
  });

  it("rejects a bad or missing id", () => {
    expect(parseThemeFile({ ...valid, id: "Bad Id!" }).ok).toBe(false);
    expect(parseThemeFile({ ...valid, id: "" }).ok).toBe(false);
  });

  it("rejects non-hex colours (no arbitrary CSS) and missing tones", () => {
    expect(parseThemeFile({ ...valid, dark: { accent: "red", ink: "#000" } }).ok).toBe(false);
    expect(parseThemeFile({ ...valid, dark: { accent: "url(x)", ink: "#000" } }).ok).toBe(false);
    expect(parseThemeFile({ ...valid, light: { accent: "#fff" } }).ok).toBe(false);
  });

  it("ignores unknown fields (allow-list only)", () => {
    const r = parseThemeFile({ ...valid, evil: "x", onclick: "alert(1)" });
    expect(r.ok).toBe(true);
    expect(r.theme).not.toHaveProperty("evil");
    expect(r.theme).not.toHaveProperty("onclick");
    expect(Object.keys(r.theme).sort()).toEqual(["dark", "id", "label", "light", "swatch"]);
  });
});

describe("serializeTheme", () => {
  it("round-trips through parseThemeFile", () => {
    const theme = parseThemeFile(valid).theme;
    const parsed = parseThemeFile(serializeTheme(theme));
    expect(parsed.ok).toBe(true);
    expect(parsed.theme).toEqual(theme);
  });
});
