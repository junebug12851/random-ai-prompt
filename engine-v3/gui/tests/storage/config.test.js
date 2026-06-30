/**
 * @file Unit tests for the versioned config layer (gui/storage/config.js). The storage backend
 * is mocked with an in-memory map so the tests are fast and backend-independent — they exercise
 * the version wrapper, forward migrations (with self-healing re-save), the defaults→override
 * cascade, and diff-only saves.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// In-memory backend standing in for gui/storage/index.js's `storage`.
const mem = new Map();
vi.mock("../../storage/index.js", () => ({
  storage: {
    async get(ns) {
      return mem.has(ns) ? JSON.parse(JSON.stringify(mem.get(ns))) : null;
    },
    async set(ns, obj) {
      mem.set(ns, JSON.parse(JSON.stringify(obj)));
    },
    async remove(ns) {
      mem.delete(ns);
    },
    async keys() {
      return [...mem.keys()];
    },
  },
}));

const { loadConfig, saveConfig, loadCascade, saveCascade, removeConfig, VERSION_KEY } = await import(
  "../../storage/config.js"
);

beforeEach(() => mem.clear());

describe("loadConfig / saveConfig", () => {
  it("returns {} for an absent namespace", async () => {
    expect(await loadConfig("nope")).toEqual({});
  });

  it("stamps the version on save and strips it on load", async () => {
    await saveConfig("settings", { a: 1 }, { version: 3 });
    expect(mem.get("settings")).toEqual({ [VERSION_KEY]: 3, a: 1 });
    expect(await loadConfig("settings", { version: 3 })).toEqual({ a: 1 });
  });

  it("treats a bare legacy value (no __v) as version 0 and migrates it forward", async () => {
    mem.set("settings", { count: 5 }); // legacy, unwrapped
    const migrate = { 0: (d) => ({ ...d, migrated: true }) };
    const data = await loadConfig("settings", { version: 1, migrate });
    expect(data).toEqual({ count: 5, migrated: true });
    // self-heal: the stored doc is re-saved at the new version
    expect(mem.get("settings")).toEqual({ [VERSION_KEY]: 1, count: 5, migrated: true });
  });

  it("runs ordered migration steps across multiple versions", async () => {
    mem.set("x", { [VERSION_KEY]: 1, n: 1 });
    const migrate = {
      1: (d) => ({ ...d, n: d.n + 1 }), // 1 -> 2
      2: (d) => ({ ...d, n: d.n * 10 }), // 2 -> 3
    };
    expect(await loadConfig("x", { version: 3, migrate })).toEqual({ n: 20 });
  });

  it("does not create a file for a namespace that was never stored", async () => {
    await loadConfig("ghost", { version: 2 });
    expect(mem.has("ghost")).toBe(false);
  });
});

describe("loadCascade / saveCascade", () => {
  const defaults = { model: "a", size: "1024", nested: { steps: 20, sampler: "Euler" } };

  it("returns the defaults when there is no override", async () => {
    expect(await loadCascade("providers/x", defaults)).toEqual(defaults);
  });

  it("layers a sparse override over the defaults", async () => {
    await saveConfig("providers/x", { size: "512", nested: { steps: 40 } }, { version: 1 });
    expect(await loadCascade("providers/x", defaults)).toEqual({
      model: "a",
      size: "512",
      nested: { steps: 40, sampler: "Euler" },
    });
  });

  it("saves only the diff vs. defaults", async () => {
    const full = { model: "a", size: "512", nested: { steps: 20, sampler: "Euler" } };
    await saveCascade("providers/x", defaults, full, { version: 1 });
    // only `size` differs from defaults
    expect(mem.get("providers/x")).toEqual({ [VERSION_KEY]: 1, size: "512" });
    // and it round-trips back to the full value
    expect(await loadCascade("providers/x", defaults)).toEqual(full);
  });
});

describe("removeConfig", () => {
  it("deletes a stored namespace", async () => {
    await saveConfig("gone", { a: 1 });
    await removeConfig("gone");
    expect(mem.has("gone")).toBe(false);
  });
});
