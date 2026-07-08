/**
 * @file Unit tests for the shared, engine-owned preset module (`engine/presets.js`) — name listing,
 * safe loading (incl. the path-traversal guard), resolution, and the nested→flat `applyPreset` mapping.
 */
import { describe, it, expect } from "vitest";
import { presetNames, loadPreset, resolvePresets, applyPreset } from "../../engine/presets.js";

describe("presetNames / loadPreset", () => {
  it("lists the built-in presets", () => {
    const names = presetNames();
    expect(Array.isArray(names)).toBe(true);
    expect(names.length).toBeGreaterThan(0);
    expect(names).toContain("no-people");
  });

  it("loads a known preset as an object", () => {
    const preset = loadPreset("no-people");
    expect(preset && typeof preset === "object").toBe(true);
  });

  it("returns null for unknown names", () => {
    expect(loadPreset("definitely-not-a-preset")).toBeNull();
  });

  it("refuses path traversal / separators / non-strings (no arbitrary file reads)", () => {
    expect(loadPreset("../../../etc/passwd")).toBeNull();
    expect(loadPreset("..")).toBeNull();
    expect(loadPreset("a/b")).toBeNull();
    expect(loadPreset("a\\b")).toBeNull();
    expect(loadPreset("   ")).toBeNull();
    expect(loadPreset("")).toBeNull();
    expect(loadPreset(null)).toBeNull();
    expect(loadPreset(42)).toBeNull();
  });
});

describe("resolvePresets", () => {
  it("resolves a comma/space-separated list in order", () => {
    expect(resolvePresets("no-people, 1k")).toHaveLength(2);
  });

  it("returns [] for an empty spec", () => {
    expect(resolvePresets("")).toEqual([]);
    expect(resolvePresets(null)).toEqual([]);
  });

  it("throws on an unknown preset", () => {
    expect(() => resolvePresets("nope-xyz-123")).toThrow(/Unknown preset/);
  });
});

describe("applyPreset", () => {
  it("merges settings flat and maps imageSettings + upscaleSettings onto flat keys", () => {
    const base = { a: 1, imageWidth: 512, upscaleSettings: { x: 1 } };
    const preset = {
      settings: { includeAdult: true },
      imageSettings: { width: 768, height: 1024, steps: 30, cfg: 7, negativePrompt: "no", sampler: "Euler" },
      upscaleSettings: { upscaleToSize: true },
    };
    const out = applyPreset(base, preset);
    expect(out.includeAdult).toBe(true);
    expect(out.imageWidth).toBe(768);
    expect(out.imageHeight).toBe(1024);
    expect(out.imageSteps).toBe(30);
    expect(out.cfg).toBe(7);
    expect(out.negativePrompt).toBe("no");
    expect(out.sampler).toBe("Euler");
    expect(out.upscaleSettings).toEqual({ x: 1, upscaleToSize: true });
    expect(out.a).toBe(1);
  });

  it("returns the base unchanged for a non-object preset", () => {
    const base = { a: 1 };
    expect(applyPreset(base, null)).toBe(base);
    expect(applyPreset(base, "nope")).toBe(base);
  });
});
