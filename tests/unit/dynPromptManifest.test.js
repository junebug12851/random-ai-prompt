/**
 * @file Unit tests for src/dynPromptManifest.js — the dynamic-prompt analog of
 * listManifest's group/wildcard helpers.
 */
import { describe, it, expect } from "vitest";
import {
  isReservedAny,
  dynGroupDirs,
  dynGroupMembers,
  RESERVED_ANY,
} from "../../engine/dynPromptManifest.js";

describe("isReservedAny", () => {
  it("matches the {#any} wildcard and its sfw/nsfw variants", () => {
    expect(isReservedAny("any")).toBe(true);
    expect(isReservedAny("any-sfw")).toBe(true);
    expect(isReservedAny("any-nsfw")).toBe(true);
    expect(RESERVED_ANY).toBe("any");
  });
  it("does not match look-alikes or real names", () => {
    expect(isReservedAny("anyx")).toBe(false);
    expect(isReservedAny("company")).toBe(false);
    expect(isReservedAny("scene")).toBe(false);
  });
});

describe("dynGroupDirs", () => {
  it("treats a folder with 2+ generators as an implied group", () => {
    expect(dynGroupDirs(["scene/a", "scene/b", "style/x"])).toEqual(["scene"]);
  });
  it("excludes the frozen v1/ tree from grouping", () => {
    expect(dynGroupDirs(["scene/a", "scene/b", "v1/x/a", "v1/x/b"])).toEqual(["scene"]);
  });
  it("honors enable/disable marker overrides", () => {
    expect(dynGroupDirs(["solo/only"], ["solo"], [])).toEqual(["solo"]);
    expect(dynGroupDirs(["scene/a", "scene/b"], [], ["scene"])).toEqual([]);
  });
});

describe("dynGroupMembers", () => {
  it("returns only the direct children of a group folder (no descendants)", () => {
    const names = ["scene/a", "scene/b", "scene/sub/c", "other/d"];
    expect(dynGroupMembers("scene", names).sort()).toEqual(["scene/a", "scene/b"]);
  });
  it("returns [] for a folder with no direct members", () => {
    expect(dynGroupMembers("scene", ["other/d"])).toEqual([]);
  });
});
