/**
 * @file Real unit + parity tests for the Metro mobile data loader (engine/core/metroLoader.js) — the
 * third isomorphic loader (beside nodeLoader/browserLoader) that drives the unchanged engine on the
 * Expo/RN target by reading the generated static catalog.
 *
 * This test EARNS metroLoader.js's Node coverage rather than excluding it: the loader is plain,
 * Node-importable JS, so we import it against the full-tier catalog, exercise every accessor, and —
 * most importantly — prove it drives `createEngine` byte-identically to `nodeLoader` on a set of
 * seeded prompts (which forces real work through readListLines, loadBlock, the DPL compile path, and
 * metroBridge). The exhaustive 150-generation sweep lives in scripts/metro-parity-check.mjs; this is
 * the focused, coverage-bearing companion that runs inside the Vitest gate.
 *
 * The generated catalog (engine/core/metroCatalogData.js) is built — and nodeLoader's built-in name
 * sets + parity generations are snapshotted — by tests/setup/metro-catalog.globalSetup.js, BEFORE any
 * worker spawns. Comparing against those frozen snapshots (via inject) instead of a live nodeLoader
 * read keeps this deterministic: it can't race manageFs.test.js writing transient fixtures into the
 * shared engine/data/blocks root, nor a concurrent-read scan miss on Windows.
 */
import { describe, it, expect, beforeAll, inject } from "vitest";
import { createEngine } from "../../engine/core/engine.js";
import baseSettings from "../../engine/settings.js";

// Loaded dynamically in beforeAll: metroLoader statically imports the generated catalog, which
// globalSetup builds before this file evaluates.
let metroLoader;

beforeAll(async () => {
  ({ metroLoader } = await import("../../engine/core/metroLoader.js"));
});

describe("metroLoader — accessor surface", () => {
  it("exposes the same built-in list + block name sets as nodeLoader", () => {
    expect(new Set(metroLoader.listNames())).toEqual(new Set(inject("builtinListNames")));
    expect(new Set(metroLoader.blockNames())).toEqual(new Set(inject("builtinBlockNames")));
  });

  it("returns a stable block-name list on repeated calls (no internal mutation)", () => {
    const names = metroLoader.blockNames();
    expect(names.length).toBeGreaterThan(0);
    expect(metroLoader.blockNames()).toEqual(names);
  });

  it("resolves real list lines and honors includeAdult", () => {
    const listName = metroLoader.listNames().find((n) => {
      const lines = metroLoader.readListLines(n, true);
      return Array.isArray(lines) && lines.length > 0;
    });
    expect(listName).toBeTruthy();
    const sfw = metroLoader.readListLines(listName, false);
    const all = metroLoader.readListLines(listName, true);
    expect(Array.isArray(sfw)).toBe(true);
    expect(Array.isArray(all)).toBe(true);
    // SFW view can never contain MORE than the adult-inclusive view.
    expect(sfw.length).toBeLessThanOrEqual(all.length);
    // Unknown names resolve to null (not a throw), matching the loader contract.
    expect(metroLoader.readListLines("definitely/not/a/real/list", true)).toBeNull();
  });

  it("caches readListLines (same reference on the second call)", () => {
    const name = metroLoader.listNames().find((n) => metroLoader.readListLines(n, false)?.length);
    const first = metroLoader.readListLines(name, false);
    const second = metroLoader.readListLines(name, false);
    expect(second).toBe(first); // cached identity, not just deep-equal
  });

  it("loads a block and caches it; unknown blocks return null", () => {
    const key = metroLoader.blockNames()[0];
    const mod = metroLoader.loadBlock(key);
    expect(mod).toBeTruthy();
    expect(metroLoader.loadBlock(key)).toBe(mod); // module cache identity
    expect(metroLoader.loadBlock("no/such/block")).toBeNull();
  });

  it("every block name loads to a non-null module (exercises .js + compiled .dpl paths)", () => {
    for (const key of metroLoader.blockNames()) {
      expect(metroLoader.loadBlock(key), `block failed to load: ${key}`).not.toBeNull();
    }
  });

  it("exposes group/dir/meta accessors with the expected shapes", () => {
    expect(Array.isArray(metroLoader.forcedPrefixDirs())).toBe(true);
    expect(Array.isArray(metroLoader.groupListDirs())).toBe(true);
    expect(Array.isArray(metroLoader.blockForcedPrefixDirs())).toBe(true);
    expect(Array.isArray(metroLoader.blockForcedPrefixDirsAll())).toBe(true);
    expect(typeof metroLoader.blockGroupDirs()).toBe("object");
    expect(typeof metroLoader.blockGroupDirsAll()).toBe("object");
    // Meta accessors return an object for known names or null for unknown ones (never throw).
    const someList = metroLoader.listNames()[0];
    expect(() => metroLoader.readListMeta(someList)).not.toThrow();
    expect(metroLoader.readListMeta("no/such/list")).toBeNull();
    const someBlock = metroLoader.blockNames()[0];
    expect(() => metroLoader.readBlockMeta(someBlock)).not.toThrow();
    expect(metroLoader.readBlockMeta("no/such/block")).toBeNull();
    expect(() => metroLoader.readBlockGroup("anything")).not.toThrow();
  });

  it("exposes presets (mobile ships built-in presets; nodeLoader exposes none)", () => {
    const names = metroLoader.presetNames();
    expect(Array.isArray(names)).toBe(true);
    if (names.length) {
      expect(metroLoader.loadPreset(names[0])).toBeTruthy();
    }
    expect(metroLoader.loadPreset("no/such/preset")).toBeNull();
  });
});

describe("metroLoader — engine parity with nodeLoader", () => {
  // A focused seeded-generation smoke: identical output proves metroLoader drives the pipeline exactly
  // like the filesystem loader, through list resolution, block loading, DPL compilation, and the
  // metroBridge js-sidecar path. The nodeLoader baseline is captured in globalSetup (clean state), so
  // this compares metro's live output against a frozen, race-free reference. (The full 150-case sweep
  // is scripts/metro-parity-check.mjs.)
  it("produces byte-identical seeded generations", () => {
    const mEng = createEngine(metroLoader);
    const prompts = inject("parityPrompts");
    const expected = inject("nodeGenerations");
    for (const prompt of prompts) {
      for (let seed = 1; seed <= 4; seed++) {
        const s = { ...baseSettings, prompt, seed, generateImages: false };
        expect(
          mEng.generate(s),
          `divergence at prompt=${JSON.stringify(prompt)} seed=${seed}`,
        ).toBe(expected[`${prompt}::${seed}`]);
      }
    }
  });
});
