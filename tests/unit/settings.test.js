/**
 * @file Guard test for the engine's master default settings (src/settings.js).
 * Stages read these fields directly, so the shape/types matter — this locks the
 * contract so an accidental rename or type change is caught.
 */
import { describe, it, expect } from "vitest";
import settings from "../../engine/settings.js";

describe("default settings", () => {
  it("is a plain object with the documented prompt default", () => {
    expect(settings).toBeTypeOf("object");
    expect(settings.prompt).toBe("{#random-words}");
  });

  it("declares the v3 pipeline order", () => {
    expect(settings.promptModules).toEqual([
      "dynamic-prompt",
      "prompt-salt",
      "list",
      "emphasis",
      "cleanup",
    ]);
  });

  it("defaults to SFW StableDiffusion", () => {
    expect(settings.includeAdult).toBe(false);
    expect(settings.mode).toBe("StableDiffusion");
  });

  it("has sane numeric keyword-count bounds (min <= max)", () => {
    expect(settings.keywordCount).toBeLessThanOrEqual(settings.keywordMaxCount);
    expect(settings.minArtist).toBeLessThanOrEqual(settings.maxArtist);
  });

  it("keeps every boolean knob a real boolean", () => {
    for (const k of [
      "generateImages",
      "keywordEmphasis",
      "keywordEditing",
      "keywordAlternating",
      "includeArtist",
      "includeAdult",
      "promptSalt",
    ]) {
      expect(typeof settings[k], k).toBe("boolean");
    }
  });
});
