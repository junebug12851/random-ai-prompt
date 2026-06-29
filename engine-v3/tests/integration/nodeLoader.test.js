/**
 * @file Integration test for src/core/nodeLoader.js against the REAL on-disk
 * data/ tree. Catches drift between the loader and the actual lists / dynamic
 * prompts / markers without hard-coding counts (which would be brittle as content grows).
 */
import { describe, it, expect } from "vitest";
import { nodeLoader } from "../../src/core/nodeLoader.js";

describe("nodeLoader — lists", () => {
  it("exposes a non-empty, de-duplicated list-name set", () => {
    const names = nodeLoader.listNames();
    expect(Array.isArray(names)).toBe(true);
    expect(names.length).toBeGreaterThan(0);
    expect(new Set(names).size).toBe(names.length);
  });

  it("resolves a bare list ref by path suffix and returns lines", () => {
    const lines = nodeLoader.readListLines("color");
    expect(Array.isArray(lines)).toBe(true);
    expect(lines.length).toBeGreaterThan(0);
  });

  it("returns null for a list that does not exist", () => {
    expect(nodeLoader.readListLines("definitely-not-a-real-list-xyz")).toBeNull();
  });

  it("includes more lines for an nsfw-bearing base when adult is on", () => {
    const off = nodeLoader.readListLines("clothes", false) || [];
    const on = nodeLoader.readListLines("clothes", true) || [];
    expect(on.length).toBeGreaterThanOrEqual(off.length);
  });

  it("exposes forced-prefix and implied-group dirs as arrays", () => {
    expect(Array.isArray(nodeLoader.forcedPrefixDirs())).toBe(true);
    expect(Array.isArray(nodeLoader.groupListDirs())).toBe(true);
  });
});

describe("nodeLoader — dynamic prompts", () => {
  it("exposes a non-empty generator catalog", () => {
    const names = nodeLoader.dynamicPromptNames();
    expect(names.length).toBeGreaterThan(0);
  });

  it("loads each catalog generator to a module with a default function", () => {
    const names = nodeLoader.dynamicPromptNames();
    // Spot-check the first few so the test stays fast but catches a broken compile/loader.
    for (const key of names.slice(0, 5)) {
      const mod = nodeLoader.loadDynamicPrompt(key);
      expect(mod, key).toBeTruthy();
      expect(typeof mod.default, key).toBe("function");
    }
  });

  it("returns null for an unknown generator key", () => {
    expect(nodeLoader.loadDynamicPrompt("nope/nope-xyz")).toBeNull();
  });
});

describe("nodeLoader — metadata + group accessors", () => {
  it("returns arrays for the forced-prefix and group dir accessors", () => {
    for (const fn of [
      nodeLoader.dynPromptForcedPrefixDirs,
      nodeLoader.dynPromptForcedPrefixDirsAll,
      nodeLoader.dynPromptGroupDirs,
      nodeLoader.dynPromptGroupDirsAll,
    ]) {
      expect(Array.isArray(fn())).toBe(true);
    }
  });

  it("reads optional list/generator metadata sidecars without throwing (object or null)", () => {
    const listMeta = nodeLoader.readListMeta("color");
    expect(listMeta === null || typeof listMeta === "object").toBe(true);
    const firstGen = nodeLoader.dynamicPromptNames()[0];
    const genMeta = nodeLoader.readDynPromptMeta(firstGen);
    expect(genMeta === null || typeof genMeta === "object").toBe(true);
  });

  it("returns null reading a group file for a non-group name", () => {
    expect(nodeLoader.readDynPromptGroup("definitely-not-a-group-xyz")).toBeNull();
  });
});
