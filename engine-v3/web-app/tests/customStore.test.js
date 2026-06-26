/**
 * @file Unit tests for the browser-local custom store (web-app/src/lib/customStore.js).
 */
import { describe, it, expect } from "vitest";
import {
  getCustomExpansions,
  saveCustomExpansion,
  removeCustomExpansion,
  getCustomPresets,
  saveCustomPreset,
  removeCustomPreset,
} from "../src/lib/customStore.js";

describe("custom expansions", () => {
  it("starts empty", () => {
    expect(getCustomExpansions()).toEqual({});
  });

  it("saves, reads, and removes", () => {
    saveCustomExpansion("mood", "moody, cinematic");
    expect(getCustomExpansions()).toEqual({ mood: "moody, cinematic" });
    saveCustomExpansion("mood", "bright");
    expect(getCustomExpansions().mood).toBe("bright"); // overwrite
    removeCustomExpansion("mood");
    expect(getCustomExpansions()).toEqual({});
  });
});

describe("custom presets", () => {
  it("saves, reads, and removes a settings patch", () => {
    saveCustomPreset("anime", { mode: "NovelAI", cfg: 7 });
    expect(getCustomPresets().anime).toEqual({ mode: "NovelAI", cfg: 7 });
    removeCustomPreset("anime");
    expect(getCustomPresets()).toEqual({});
  });
});
