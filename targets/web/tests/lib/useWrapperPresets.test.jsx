/**
 * @file Tests for gui/src/lib/wrapper/useWrapperPresets.js — the wrapper-preset hook. The
 * localStorage-backed wrapperStore is mocked; the hook's actions are exercised and asserted against
 * the settings updates and the store calls they make.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("../../frontend/lib/wrapperStore.js", () => ({
  getWrappers: vi.fn(() => ({})),
  saveWrapper: vi.fn(),
  removeWrapper: vi.fn(),
  renameWrapper: vi.fn(),
  getDefaultWrapper: vi.fn(() => ({ start: "DS", end: "DE" })),
  saveDefaultWrapper: vi.fn(),
  DEFAULT_WRAPPER_SEED: { start: "SEED-S", end: "SEED-E" },
}));

import { useWrapperPresets } from "../../frontend/lib/wrapper/useWrapperPresets.js";
import {
  getWrappers,
  saveWrapper,
  removeWrapper,
  saveDefaultWrapper,
} from "../../frontend/lib/wrapperStore.js";

function mount(settings = { wrapperName: "Default" }) {
  const setSettings = vi.fn();
  const { result } = renderHook(() => useWrapperPresets({ settings, setSettings }));
  return { result, setSettings };
}

beforeEach(() => {
  vi.clearAllMocks();
  getWrappers.mockReturnValue({});
});

describe("useWrapperPresets", () => {
  it("applyWrapper('None') clears the wrapper and names it None", () => {
    const { result, setSettings } = mount();
    act(() => result.current.applyWrapper("None"));
    expect(setSettings).toHaveBeenCalledWith(
      expect.objectContaining({ wrapperName: "None", wrapper: { start: "", end: "" } }),
    );
  });

  it("applyWrapper('Default') applies the live default wrapper", () => {
    const { result, setSettings } = mount();
    act(() => result.current.applyWrapper("Default"));
    expect(setSettings).toHaveBeenCalledWith(
      expect.objectContaining({ wrapperName: "Default", wrapper: { start: "DS", end: "DE" } }),
    );
  });

  it("applyWrapper(name) applies a saved preset's start/end", () => {
    getWrappers.mockReturnValue({ Cinematic: { start: "wide", end: "grain" } });
    const { result, setSettings } = mount();
    act(() => result.current.applyWrapper("Cinematic"));
    expect(setSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        wrapperName: "Cinematic",
        wrapper: { start: "wide", end: "grain" },
      }),
    );
  });

  it("save() persists the draft via saveWrapper", () => {
    const { result } = mount({ wrapperName: "None" });
    act(() => {
      result.current.newPreset();
      result.current.setName("Cinematic");
      result.current.setStart("wide shot");
      result.current.setEnd("film grain");
    });
    act(() => result.current.save());
    expect(saveWrapper).toHaveBeenCalledWith("Cinematic", { start: "wide shot", end: "film grain" });
  });

  it("save() with the Default selected edits it in place via saveDefaultWrapper", () => {
    const { result } = mount();
    act(() => result.current.loadInto("Default"));
    act(() => {
      result.current.setStart("new default start");
    });
    act(() => result.current.save());
    expect(saveDefaultWrapper).toHaveBeenCalledWith(
      expect.objectContaining({ start: "new default start" }),
    );
    expect(saveWrapper).not.toHaveBeenCalled();
  });

  it("del(name) removes the preset", () => {
    getWrappers.mockReturnValue({ Cinematic: { start: "a", end: "b" } });
    const { result } = mount();
    act(() => result.current.del("Cinematic"));
    expect(removeWrapper).toHaveBeenCalledWith("Cinematic");
  });

  it("del('Default') is a no-op (the default can't be deleted)", () => {
    const { result } = mount();
    act(() => result.current.del("Default"));
    expect(removeWrapper).not.toHaveBeenCalled();
  });

  it("revertPane('start') resets the start field to the default", () => {
    const { result } = mount();
    act(() => {
      result.current.newPreset();
      result.current.setStart("custom");
    });
    act(() => result.current.revertPane("start"));
    expect(result.current.start).toBe("DS");
  });

  it("loadInto('Default') loads the default into the editor draft", () => {
    const { result } = mount();
    act(() => result.current.loadInto("Default"));
    expect(result.current.sel).toBe("Default");
    expect(result.current.name).toBe("Default");
    expect(result.current.start).toBe("DS");
    expect(result.current.end).toBe("DE");
  });
});
