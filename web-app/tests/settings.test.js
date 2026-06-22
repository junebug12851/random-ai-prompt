/**
 * @file Unit tests for the browser settings store (web-app/src/lib/settings.js).
 */
import { describe, it, expect } from "vitest";
import { defaultSettings, loadSettings, saveSettings } from "../src/lib/settings.js";

const KEY = "rap.settings.v2";

describe("settings store", () => {
  it("returns the defaults when nothing is stored", () => {
    expect(loadSettings()).toEqual(defaultSettings);
    expect(defaultSettings.mode).toBe("StableDiffusion");
  });

  it("merges stored settings over the defaults", () => {
    localStorage.setItem(KEY, JSON.stringify({ promptCount: 7 }));
    const s = loadSettings();
    expect(s.promptCount).toBe(7);
    expect(s.mode).toBe(defaultSettings.mode); // untouched defaults survive
  });

  it("persists settings as JSON", () => {
    saveSettings({ ...defaultSettings, cfg: 9 });
    expect(JSON.parse(localStorage.getItem(KEY)).cfg).toBe(9);
  });

  it("migrates the removed Danbooru word lists back to safe defaults", () => {
    localStorage.setItem(KEY, JSON.stringify({ keywordsFilename: "d-keyword", artistFilename: "d-artist" }));
    const s = loadSettings();
    expect(s.keywordsFilename).toBe("keyword");
    expect(s.artistFilename).toBe("artist");
  });

  it("falls back to defaults on corrupt JSON", () => {
    localStorage.setItem(KEY, "{not valid json");
    expect(loadSettings()).toEqual(defaultSettings);
  });
});
