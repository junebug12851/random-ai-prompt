/**
 * @file Unit tests for the settings store (gui/src/lib/settings.js). Settings now persist through
 * the storage cache (gui/storage/cache.js) rather than direct localStorage: the main blob lives
 * under the `settings` namespace and each provider's params under `providers/<id>`. The shared
 * setup resets the cache between tests, so we seed it directly with `setCached`.
 */
import { describe, it, expect } from "vitest";
import { defaultSettings, loadSettings, saveSettings } from "../src/lib/settings.js";
import { getCached, setCached } from "../storage/cache.js";

describe("settings store", () => {
  it("returns the defaults when nothing is stored", () => {
    expect(loadSettings()).toEqual(defaultSettings);
    expect(defaultSettings.mode).toBe("StableDiffusion");
  });

  it("merges stored settings over the defaults", () => {
    setCached("settings", { promptCount: 7 });
    const s = loadSettings();
    expect(s.promptCount).toBe(7);
    expect(s.mode).toBe(defaultSettings.mode); // untouched defaults survive
  });

  it("persists the main blob and fans provider params out to per-provider namespaces", () => {
    saveSettings({ ...defaultSettings, cfg: 9, providerParams: { openai: { size: "512x512" } } });
    expect(getCached("settings").cfg).toBe(9);
    expect(getCached("settings").providerParams).toBeUndefined(); // not in the main blob
    expect(getCached("providers/openai")).toEqual({ size: "512x512" });
  });

  it("reassembles providerParams from the per-provider namespaces on load", () => {
    setCached("settings", { cfg: 9 });
    setCached("providers/openai", { size: "512x512" });
    setCached("providers/comfyui", { steps: 40 });
    const s = loadSettings();
    expect(s.cfg).toBe(9);
    expect(s.providerParams).toEqual({ openai: { size: "512x512" }, comfyui: { steps: 40 } });
  });

  it("migrates the removed Danbooru word lists back to safe defaults", () => {
    setCached("settings", { keywordsFilename: "d-keyword", artistFilename: "d-artist" });
    const s = loadSettings();
    expect(s.keywordsFilename).toBe("keyword");
    expect(s.artistFilename).toBe("artist");
  });
});
