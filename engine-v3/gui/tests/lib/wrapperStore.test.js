/**
 * @file Unit tests for gui/src/lib/wrapperStore.js — the localStorage-backed
 * START/END wrapper presets + the editable built-in Default. localStorage is
 * cleared between tests by the shared setup.
 */
import { describe, it, expect } from "vitest";
import {
  DEFAULT_WRAPPER_SEED,
  getDefaultWrapper,
  saveDefaultWrapper,
  resetDefaultWrapper,
  getWrappers,
  saveWrapper,
  renameWrapper,
  removeWrapper,
} from "../../src/lib/wrapperStore.js";

describe("default wrapper", () => {
  it("returns the seed when never edited", () => {
    expect(getDefaultWrapper()).toEqual(DEFAULT_WRAPPER_SEED);
  });
  it("persists an edit and resets back to the seed", () => {
    saveDefaultWrapper({ start: "open", end: "close" });
    expect(getDefaultWrapper()).toEqual({ start: "open", end: "close" });
    resetDefaultWrapper();
    expect(getDefaultWrapper()).toEqual(DEFAULT_WRAPPER_SEED);
  });
});

describe("wrapper presets", () => {
  it("starts empty", () => {
    expect(getWrappers()).toEqual({});
  });
  it("saves and reads a preset", () => {
    saveWrapper("mine", { start: "a", end: "b" });
    expect(getWrappers().mine).toEqual({ start: "a", end: "b" });
  });
  it("renames a preset (no-op on missing source or blank target)", () => {
    saveWrapper("old", { start: "a", end: "b" });
    renameWrapper("old", "new");
    const all = getWrappers();
    expect(all.new).toEqual({ start: "a", end: "b" });
    expect(all.old).toBeUndefined();
    renameWrapper("ghost", "x"); // no-op
    expect(getWrappers().x).toBeUndefined();
  });
  it("removes a preset", () => {
    saveWrapper("temp", { start: "a", end: "b" });
    removeWrapper("temp");
    expect(getWrappers().temp).toBeUndefined();
  });
  it("normalizes missing start/end to empty strings", () => {
    saveWrapper("partial", { start: "only-start" });
    expect(getWrappers().partial).toEqual({ start: "only-start", end: "" });
  });
});
