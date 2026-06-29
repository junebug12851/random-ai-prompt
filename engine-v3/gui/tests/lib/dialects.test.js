/**
 * @file Unit tests for gui/providers/_shared/dialects.js — the dialect → engine-mode map.
 */
import { describe, it, expect } from "vitest";
import { DIALECTS, engineModeFor } from "../../providers/_shared/dialects.js";

describe("dialects", () => {
  it("maps each known dialect to its engine mode", () => {
    expect(engineModeFor("sd")).toBe("StableDiffusion");
    expect(engineModeFor("novelai")).toBe("NovelAI");
    expect(engineModeFor("midjourney")).toBe("Midjourney");
    expect(engineModeFor("plain")).toBe("Plain");
  });

  it("falls back to Plain for an unknown dialect", () => {
    expect(engineModeFor("nonsense")).toBe("Plain");
    expect(engineModeFor(undefined)).toBe("Plain");
  });

  it("every dialect declares id/label/engineMode/emphasis", () => {
    for (const [id, d] of Object.entries(DIALECTS)) {
      expect(d.id, id).toBe(id);
      expect(d.label).toBeTruthy();
      expect(d.engineMode).toBeTruthy();
      expect(d.emphasis).toBeTruthy();
    }
  });
});
