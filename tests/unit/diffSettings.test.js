/**
 * @file Unit tests for src/diffSettings.js — the live-vs-defaults diff that
 * userSettings() persists.
 */
import { describe, it, expect } from "vitest";
import diffSettings from "../../src/diffSettings.js";

const defaults = {
  settings: { mode: "StableDiffusion", keywordCount: 5, noAnd: false },
  imageSettings: { steps: 32, cfg: 11 },
  upscaleSettings: { factor: 2 },
  serverSettings: { port: 7861 },
};

describe("diffSettings", () => {
  it("returns empty groups when nothing differs", () => {
    const diff = diffSettings(structuredClone(defaults), defaults);
    expect(diff).toEqual({
      settings: {},
      imageSettings: {},
      upscaleSettings: {},
      serverSettings: {},
    });
  });

  it("captures only the changed keys, per group", () => {
    const live = structuredClone(defaults);
    live.settings.keywordCount = 9;
    live.imageSettings.cfg = 7;
    const diff = diffSettings(live, defaults);
    expect(diff.settings).toEqual({ keywordCount: 9 });
    expect(diff.imageSettings).toEqual({ cfg: 7 });
    expect(diff.upscaleSettings).toEqual({});
  });

  it("uses deep equality (unchanged nested objects are not diffed)", () => {
    const d = {
      settings: { promptModules: ["a", "b"] },
      imageSettings: {},
      upscaleSettings: {},
      serverSettings: {},
    };
    const live = structuredClone(d);
    expect(diffSettings(live, d).settings).toEqual({});
    live.settings.promptModules = ["a", "c"];
    expect(diffSettings(live, d).settings).toEqual({ promptModules: ["a", "c"] });
  });

  it("ignores a group that is absent on the live settings", () => {
    const live = { settings: { keywordCount: 1 } };
    const diff = diffSettings(live, defaults);
    expect(diff.settings).toEqual({ keywordCount: 1 });
    expect(diff.imageSettings).toEqual({});
  });
});
