/**
 * @file Unit tests for src/promptFilesAndSuggestions.js — the loader-injected
 * dynamic-prompt classifier + random suggestion builder + picker list names.
 *
 * The module is a configured singleton; the "throws before configure" case uses a
 * fresh module instance via vi.resetModules so it doesn't disturb the configured one.
 */
import { describe, it, expect, vi } from "vitest";
import promptFiles from "../../engine/promptFilesAndSuggestions.js";

const loader = {
  dynamicPromptNames: () => ["scene/beach", "fx", "user/mine", "nude-nsfw"],
  loadDynamicPrompt: (k) => ({ default: () => "out", suggestion_exclude: k === "fx" }),
  dynPromptForcedPrefixDirs: () => [],
  listNames: () => ["color", "clothes-nsfw", "artist/anime"],
};

let adult = false;
const settingsAccessor = () => ({
  settings: { includeAdult: adult },
  imageSettings: {},
  upscaleSettings: {},
});

describe("promptFilesAndSuggestions — configuration guard", () => {
  it("throws if loadAll runs before configure (fresh instance)", async () => {
    vi.resetModules();
    const fresh = (await import("../../engine/promptFilesAndSuggestions.js")).default;
    expect(() => fresh.loadDynPromptList()).toThrow(/configure/);
  });
});

describe("promptFilesAndSuggestions — classification + picker", () => {
  it("loads the catalog without error", () => {
    promptFiles.configure(loader);
    promptFiles.init(settingsAccessor);
    expect(() => promptFiles.loadAll()).not.toThrow();
  });

  it("pickerListNames hides nsfw lists when adult is off", () => {
    adult = false;
    const names = promptFiles.pickerListNames();
    expect(names).toContain("keyword");
    expect(names).toContain("color");
    expect(names).not.toContain("clothes-nsfw");
  });

  it("pickerListNames offers the keyword variants + nsfw lists when adult is on", () => {
    adult = true;
    const names = promptFiles.pickerListNames();
    expect(names).toContain("keyword-sfw");
    expect(names).toContain("keyword-nsfw");
    expect(names).toContain("clothes-nsfw");
  });
});

describe("promptFilesAndSuggestions — promptSuggestion", () => {
  it("produces a cleaned suggestion containing at least one #token (simple)", () => {
    adult = false;
    promptFiles.configure(loader);
    promptFiles.init(settingsAccessor);
    promptFiles.loadAll();
    const out = promptFiles.promptSuggestion(false);
    expect(out).toBeTypeOf("string");
    expect(out).toContain("{#");
    expect(out).not.toContain("AND,"); // the cleanup guard held
  });

  it("the full form still yields a string with #tokens over many rolls", () => {
    for (let i = 0; i < 20; i++) {
      const out = promptFiles.promptSuggestion(true);
      expect(out).toContain("{#");
      expect(out).not.toMatch(/\{#(undefined|nude-nsfw)\}/); // gated/empty never sampled when adult off
    }
  });
});
