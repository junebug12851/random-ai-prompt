/**
 * @file Unit tests for the storage cache (gui/storage/cache.js) against the real backend (which, in
 * jsdom with no dev-server, falls through to the localStorage browser backend). Covers legacy-key
 * migration on hydrate, per-provider namespace discovery, and synchronous write-through. The shared
 * setup clears localStorage and resets the cache before each test.
 */
import { describe, it, expect } from "vitest";
import { hydrate, isHydrated, getCached, setCached, removeCached, cachedKeys } from "../../storage/cache.js";

// The browser backend keys its blobs under this prefix (see gui/storage/browser.js).
const P = "rap.store.";

describe("hydrate", () => {
  it("migrates legacy localStorage settings into the cache", async () => {
    localStorage.setItem("rap.settings.v2", JSON.stringify({ promptCount: 7 }));
    await hydrate();
    expect(isHydrated()).toBe(true);
    expect(getCached("settings")).toEqual({ promptCount: 7 });
    // and the backend now holds the version-stamped doc
    expect(JSON.parse(localStorage.getItem(P + "settings"))).toEqual({ __v: 2, promptCount: 7 });
  });

  it("migrates legacy wrappers + presets", async () => {
    localStorage.setItem("rap.wrappers.v1", JSON.stringify({ mine: { start: "a", end: "b" } }));
    localStorage.setItem("rap.customPresets.v1", JSON.stringify({ anime: { cfg: 7 } }));
    await hydrate();
    expect(getCached("wrappers")).toEqual({ mine: { start: "a", end: "b" } });
    expect(getCached("presets")).toEqual({ anime: { cfg: 7 } });
  });

  it("discovers per-provider override namespaces already in the backend", async () => {
    localStorage.setItem(P + "providers/openai", JSON.stringify({ __v: 1, size: "512x512" }));
    await hydrate();
    expect(cachedKeys()).toContain("providers/openai");
    expect(getCached("providers/openai")).toEqual({ size: "512x512" });
  });

  it("does not clobber a backend value with a legacy key", async () => {
    localStorage.setItem(P + "settings", JSON.stringify({ __v: 2, promptCount: 3 }));
    localStorage.setItem("rap.settings.v2", JSON.stringify({ promptCount: 99 }));
    await hydrate();
    expect(getCached("settings")).toEqual({ promptCount: 3 }); // backend wins; legacy ignored
  });
});

describe("write-through", () => {
  it("sets and reads synchronously and persists to the backend", async () => {
    await hydrate();
    const p = setCached("providers/comfyui", { steps: 40 });
    expect(getCached("providers/comfyui")).toEqual({ steps: 40 }); // synchronous read
    await p; // background persistence
    expect(JSON.parse(localStorage.getItem(P + "providers/comfyui"))).toEqual({ __v: 1, steps: 40 });
  });

  it("removes a namespace from cache and backend", async () => {
    await hydrate();
    await setCached("wrappers", { x: 1 });
    await removeCached("wrappers");
    expect(getCached("wrappers")).toBeNull();
    expect(localStorage.getItem(P + "wrappers")).toBeNull();
  });
});
