/**
 * @file Unit tests for the update-check core (src/lib/updateCheck.js): the pure semver comparison
 * (parseVersion/compareVersions/isNewer/shouldShow) and the orchestration (checkForUpdate) with the
 * network + storage mocked. version.js/online.js are mocked so APP_VERSION isn't the test-time "dev"
 * (which short-circuits the check) and ONLINE stays false.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// A tiny in-memory stand-in for the storage cache (disk locally / localStorage online in the app).
const store = new Map();
vi.mock("../../storage/cache.js", () => ({
  getCached: (ns) => (store.has(ns) ? store.get(ns) : null),
  setCached: (ns, data) => {
    store.set(ns, data);
    return Promise.resolve();
  },
  // The shared test setup (tests/setup.js) calls resetCache() between tests — provide a no-op so the
  // full-module mock doesn't drop it. It also gives each test a clean store.
  resetCache: () => store.clear(),
}));
vi.mock("../../src/lib/version.js", () => ({ APP_VERSION: "2.43.0" }));
vi.mock("../../src/lib/online.js", () => ({ ONLINE: false }));

import {
  parseVersion,
  compareVersions,
  isNewer,
  shouldShow,
  checkForUpdate,
  dismissUpdate,
} from "../../src/lib/updateCheck.js";

beforeEach(() => {
  store.clear();
  vi.restoreAllMocks();
});

describe("parseVersion", () => {
  it("strips a leading v and splits the numeric core", () => {
    expect(parseVersion("v2.43.0")).toEqual([2, 43, 0]);
    expect(parseVersion("2.43")).toEqual([2, 43, 0]);
    expect(parseVersion("2")).toEqual([2, 0, 0]);
  });
  it("drops pre-release / build metadata and tolerates junk", () => {
    expect(parseVersion("2.43.1-rc.1")).toEqual([2, 43, 1]);
    expect(parseVersion("v3.0.0+build.5")).toEqual([3, 0, 0]);
    expect(parseVersion("")).toEqual([0, 0, 0]);
    expect(parseVersion(null)).toEqual([0, 0, 0]);
    expect(parseVersion("garbage")).toEqual([0, 0, 0]);
  });
});

describe("compareVersions", () => {
  it("orders by major, then minor, then patch", () => {
    expect(compareVersions("2.43.0", "2.44.0")).toBe(-1);
    expect(compareVersions("2.44.0", "2.43.0")).toBe(1);
    expect(compareVersions("2.43.0", "2.43.0")).toBe(0);
    expect(compareVersions("3.0.0", "2.99.99")).toBe(1);
    expect(compareVersions("v2.43.1", "2.43.0")).toBe(1);
  });
});

describe("isNewer", () => {
  it("is true only for a strictly newer latest", () => {
    expect(isNewer("2.44.0", "2.43.0")).toBe(true);
    expect(isNewer("2.43.0", "2.43.0")).toBe(false);
    expect(isNewer("2.42.0", "2.43.0")).toBe(false);
  });
  it("is false for a dev build or missing inputs (never nag an unversioned build)", () => {
    expect(isNewer("2.44.0", "dev")).toBe(false);
    expect(isNewer("", "2.43.0")).toBe(false);
    expect(isNewer("2.44.0", "")).toBe(false);
  });
});

describe("shouldShow", () => {
  it("shows when nothing dismissed", () => {
    expect(shouldShow("2.44.0", "")).toBe(true);
  });
  it("hides the exact dismissed version but re-shows a newer one", () => {
    expect(shouldShow("2.44.0", "2.44.0")).toBe(false);
    expect(shouldShow("2.45.0", "2.44.0")).toBe(true);
    expect(shouldShow("2.44.0", "2.45.0")).toBe(false);
  });
});

describe("checkForUpdate", () => {
  const okResponse = (body) => ({ ok: true, json: () => Promise.resolve(body) });

  it("returns the update descriptor when the backend reports a newer release", async () => {
    const latest = { version: "2.44.0", url: "https://example/releases/v2.44.0", edition: "git" };
    global.fetch = vi.fn(() => Promise.resolve(okResponse({ latest, edition: "git" })));
    const out = await checkForUpdate();
    expect(global.fetch).toHaveBeenCalledWith("/api/update", expect.any(Object));
    expect(out).toEqual(latest);
  });

  it("returns null when already up to date", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(okResponse({ latest: { version: "2.43.0", url: "x" } })),
    );
    expect(await checkForUpdate()).toBeNull();
  });

  it("returns null (no throw) when the endpoint is absent or the network fails", async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: false }));
    expect(await checkForUpdate()).toBeNull();
    global.fetch = vi.fn(() => Promise.reject(new Error("offline")));
    expect(await checkForUpdate()).toBeNull();
  });

  it("suppresses a dismissed version, then re-shows once a newer one ships", async () => {
    const respond = (version) =>
      (global.fetch = vi.fn(() =>
        Promise.resolve(okResponse({ latest: { version, url: `x/${version}` } })),
      ));

    respond("2.44.0");
    expect((await checkForUpdate({ force: true }))?.version).toBe("2.44.0");
    dismissUpdate("2.44.0");
    respond("2.44.0");
    expect(await checkForUpdate({ force: true })).toBeNull(); // dismissed
    respond("2.45.0");
    expect((await checkForUpdate({ force: true }))?.version).toBe("2.45.0"); // newer → shows again
  });

  it("reuses the cached result within the TTL (no second fetch) but re-fetches on force", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(okResponse({ latest: { version: "2.44.0", url: "x" } })),
    );
    await checkForUpdate();
    await checkForUpdate(); // within TTL → served from the stored state
    expect(global.fetch).toHaveBeenCalledTimes(1);
    await checkForUpdate({ force: true }); // bypasses the TTL
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
