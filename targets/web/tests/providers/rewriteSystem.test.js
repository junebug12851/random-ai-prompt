/**
 * @file Unit tests for shared/_shared/rewriteSystem.js — the system-prompt router. Covers the legacy
 * modes plus the DPL refine/create modes: every `dpl-*` mode must resolve to a distinct instruction
 * that embeds the shared DPL primer, so the text provider refines templates *as DPL*.
 */
import { describe, it, expect } from "vitest";
import { systemFor, DPL_PRIMER, DPL_TASKS, REWRITE_SYSTEM } from "../../shared/_shared/rewriteSystem.js";
import { DPL_REFINE_MODES, DPL_CREATE_MODE } from "../../frontend/lib/dpl/dplRefine.js";

describe("systemFor — legacy modes", () => {
  it("defaults to the prose fix", () => {
    expect(systemFor()).toBe(REWRITE_SYSTEM);
    expect(systemFor("fix")).toBe(REWRITE_SYSTEM);
    expect(systemFor("nonsense")).toBe(REWRITE_SYSTEM);
  });

  it("routes keyword + expand to their own systems", () => {
    expect(systemFor("keyword")).toMatch(/keyword\/tag list/i);
    expect(systemFor("expand")).toMatch(/25 new entries/i);
  });
});

describe("systemFor — DPL modes", () => {
  const allModes = [...DPL_REFINE_MODES, DPL_CREATE_MODE];

  it("catalog modes and the primer/task map agree", () => {
    // Every catalog mode has a task, and every task is reachable from the catalog (no orphans).
    for (const mode of allModes) expect(DPL_TASKS).toHaveProperty(mode);
    expect(Object.keys(DPL_TASKS).sort()).toEqual([...allModes].sort());
  });

  it("embeds the DPL primer and a distinct task for each mode", () => {
    const seen = new Set();
    for (const mode of allModes) {
      const sys = systemFor(mode);
      expect(sys.startsWith(DPL_PRIMER)).toBe(true);
      expect(sys).toContain("TASK:");
      expect(sys).not.toBe(REWRITE_SYSTEM);
      seen.add(sys);
    }
    expect(seen.size).toBe(allModes.length); // all distinct
  });

  it("teaches the intensity + focus dials in the primer", () => {
    expect(DPL_PRIMER).toMatch(/intensity/i);
    expect(DPL_PRIMER).toMatch(/focus/i);
    expect(DPL_PRIMER).toContain("[i>70%]");
    expect(DPL_PRIMER).toContain("[f<40%]");
  });

  it("the create prompt carries the winning-formula scaffold", () => {
    const sys = systemFor(DPL_CREATE_MODE);
    expect(sys).toMatch(/front matter/i);
    expect(sys).toMatch(/one of:/);
    expect(sys).toMatch(/\[i>70%\]/);
    expect(sys).toMatch(/\[f<40%\]/);
  });
});
