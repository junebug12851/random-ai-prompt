/**
 * @file Unit tests for gui/vite-api-helpers.js — the dev-server API helpers (a Node module, so it
 * runs in this Node-env suite rather than the jsdom SPA suite). Focus: the path-traversal-safe
 * `resolveOutputFile` (a security boundary), plus the JSON request/response helpers.
 */
import { describe, it, expect, vi } from "vitest";
import path from "node:path";
import { resolveOutputFile, OUTPUT_DIR, send, readJson } from "../../gui/vite-api-helpers.js";

describe("resolveOutputFile", () => {
  it("resolves a bare filename to a file inside the output dir", () => {
    expect(resolveOutputFile("cat.png")).toBe(path.join(OUTPUT_DIR, "cat.png"));
  });

  it("strips the /api/output/ prefix", () => {
    expect(resolveOutputFile("/api/output/cat.png")).toBe(path.join(OUTPUT_DIR, "cat.png"));
  });

  it("rejects path traversal and separators", () => {
    expect(resolveOutputFile("../secret")).toBeNull();
    expect(resolveOutputFile("a/b.png")).toBeNull();
    expect(resolveOutputFile("a\\b.png")).toBeNull();
    expect(resolveOutputFile("..")).toBeNull();
  });

  it("rejects URL-encoded traversal (decoded before the check)", () => {
    expect(resolveOutputFile("%2e%2e")).toBeNull(); // ".."
    expect(resolveOutputFile("a%2Fb")).toBeNull(); // "a/b"
  });

  it("rejects empty and non-string input", () => {
    expect(resolveOutputFile("")).toBeNull();
    expect(resolveOutputFile(null)).toBeNull();
    expect(resolveOutputFile(undefined)).toBeNull();
    expect(resolveOutputFile(42)).toBeNull();
  });
});

describe("send", () => {
  it("writes a JSON response with the status and content-type", () => {
    const res = { setHeader: vi.fn(), end: vi.fn() };
    send(res, 201, { ok: true });
    expect(res.statusCode).toBe(201);
    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "application/json");
    expect(res.end).toHaveBeenCalledWith(JSON.stringify({ ok: true }));
  });
});

function fakeReq() {
  const h = {};
  const req = {
    on: (ev, fn) => {
      h[ev] = fn;
      return req;
    },
  };
  return {
    req,
    fire: (body) => {
      if (body != null) h.data?.(body);
      h.end?.();
    },
  };
}

describe("readJson", () => {
  it("parses a JSON body", async () => {
    const { req, fire } = fakeReq();
    const p = readJson(req);
    fire('{"a":1,"b":"x"}');
    await expect(p).resolves.toEqual({ a: 1, b: "x" });
  });

  it("resolves to {} for an empty or invalid body", async () => {
    const a = fakeReq();
    const pa = readJson(a.req);
    a.fire("");
    await expect(pa).resolves.toEqual({});

    const b = fakeReq();
    const pb = readJson(b.req);
    b.fire("not json{");
    await expect(pb).resolves.toEqual({});
  });
});
