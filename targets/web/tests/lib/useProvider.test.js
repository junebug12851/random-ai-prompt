/**
 * @file Unit tests for gui/src/lib/useProvider.js — the pure helpers (providerMode,
 * flattenForProvider) and the lazy settings hook against the real registry.
 */
import { describe, it, expect } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { providerMode, flattenForProvider, useProviderSettings } from "../../frontend/lib/useProvider.js";

describe("providerMode", () => {
  it("maps a provider's dialect to the engine mode", () => {
    expect(providerMode("midjourney")).toBe("Midjourney");
    expect(providerMode("comfyui")).toBe("StableDiffusion");
  });
  it("returns a valid engine mode for an unknown provider (getProvider yields a default)", () => {
    // getProvider returns a sensible default provider for an unknown id, so the mode is
    // that default's dialect — always one of the known engine modes, never empty.
    expect(["StableDiffusion", "NovelAI", "Midjourney", "Plain"]).toContain(
      providerMode("does-not-exist"),
    );
  });
});

describe("flattenForProvider", () => {
  it("merges schema defaults under namespaced params and sets the dialect mode", () => {
    const settings = {
      provider: "midjourney",
      providerParams: { midjourney: { version: "6.1" } },
    };
    const flat = flattenForProvider(settings, { version: "5", stylize: 100 });
    expect(flat.version).toBe("6.1"); // saved param wins over schema default
    expect(flat.stylize).toBe(100); // schema default fills the gap
    expect(flat.mode).toBe("Midjourney");
  });
  it("tolerates missing providerParams", () => {
    expect(flattenForProvider({ provider: "comfyui" }).mode).toBe("StableDiffusion");
  });
});

describe("useProviderSettings", () => {
  it("becomes ready with a null schema for a provider with no settings module", () => {
    const { result } = renderHook(() => useProviderSettings("plain"));
    return waitFor(() => {
      expect(result.current.ready).toBe(true);
      expect(result.current.schema).toBeNull();
    });
  });
});
