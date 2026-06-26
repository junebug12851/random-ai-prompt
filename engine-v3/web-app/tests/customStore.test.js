/**
 * @file Unit tests for the browser-local custom store (web-app/src/lib/customStore.js).
 */
import { describe, it, expect } from "vitest";
import { getCustomPresets, saveCustomPreset, removeCustomPreset } from "../src/lib/customStore.js";

describe("custom presets", () => {
  it("saves, reads, and removes a settings patch", () => {
    saveCustomPreset("anime", { mode: "NovelAI", cfg: 7 });
    expect(getCustomPresets().anime).toEqual({ mode: "NovelAI", cfg: 7 });
    removeCustomPreset("anime");
    expect(getCustomPresets()).toEqual({});
  });
});
