/**
 * @file Contract tests for the injectable transport (`targets/shared/_shared/transport/config.js`).
 *
 * The transport is the ONE platform-specific part of the provider layer, and forking it is what used
 * to force a native target to hand-port the entire provider registry. These tests pin both sides of
 * the contract:
 *
 *   1. **The browser default is unchanged** — a relative `/api/generate`, `local-direct` tunnelled
 *      through `/api/forward`, and no fetch timeout. (If this breaks, the web regressed.)
 *   2. **A native config rewires it correctly** — an absolute Backend URL for our own routes, and a
 *      DIRECT call to the user's local server (no `/api/forward`, since RN has no CORS).
 *
 * @see targets/shared/_shared/transport/config.js
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  configureTransport,
  resetTransportConfig,
  apiUrl,
} from "../../../shared/_shared/transport/config.js";
import { callProxy, callUpscaleProxy } from "../../../shared/_shared/transport/hostedProxy.js";
import { postJson, getJson } from "../../../shared/_shared/transport/localDirect.js";

/** A fetch stub that records the URL + init it was called with. */
function stubFetch(body = {}, ok = true) {
  const fn = vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

beforeEach(() => resetTransportConfig());
afterEach(() => {
  vi.unstubAllGlobals();
  resetTransportConfig();
});

describe("transport config — browser defaults (the web must be unchanged)", () => {
  it("resolves our own routes as same-origin relative URLs", () => {
    expect(apiUrl("/api/generate")).toBe("/api/generate");
    expect(apiUrl("/api/forward")).toBe("/api/forward");
  });

  it("hosted-proxy generate posts to the relative /api/generate", async () => {
    const fetchSpy = stubFetch({ images: ["data:image/png;base64,x"] });
    const out = await callProxy({ providerId: "openai", prompt: "cat", key: "k", params: {} });

    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(fetchSpy.mock.calls[0][0]).toBe("/api/generate");
    expect(JSON.parse(fetchSpy.mock.calls[0][1].body)).toMatchObject({
      providerId: "openai",
      prompt: "cat",
      key: "k",
    });
    expect(out.images).toHaveLength(1);
  });

  it("hosted-proxy upscale posts to the relative /api/upscale", async () => {
    const fetchSpy = stubFetch({ images: ["data:image/png;base64,y"] });
    await callUpscaleProxy({ providerId: "claid", image: "/api/output/a.png", key: "k" });
    expect(fetchSpy.mock.calls[0][0]).toBe("/api/upscale");
  });

  it("local-direct tunnels through /api/forward (the browser can't call a CORS-less local server)", async () => {
    const fetchSpy = stubFetch({ prompt_id: "1" });
    await postJson("http://127.0.0.1:8188/prompt", { a: 1 });

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("/api/forward");
    expect(init.method).toBe("POST"); // the forward envelope is always a POST…
    expect(JSON.parse(init.body)).toEqual({
      url: "http://127.0.0.1:8188/prompt", // …carrying the real target inside
      method: "POST",
      body: { a: 1 },
    });
  });

  it("surfaces the upstream error message from a local server (ComfyUI nests it)", async () => {
    stubFetch({ error: { message: "bad node" }, node_errors: {} }, false);
    await expect(getJson("http://127.0.0.1:8188/history")).rejects.toThrow("bad node");
  });
});

describe("transport config — native target (mobile)", () => {
  it("resolves our own routes against the configured Backend URL", () => {
    configureTransport({ apiBase: "http://192.168.1.50:4173/" });
    expect(apiUrl("/api/generate")).toBe("http://192.168.1.50:4173/api/generate"); // trailing / trimmed
  });

  it("hosted-proxy posts to the absolute backend, not a relative path", async () => {
    configureTransport({ apiBase: "http://192.168.1.50:4173" });
    const fetchSpy = stubFetch({ images: [] });
    await callProxy({ providerId: "openai", prompt: "cat", key: "k", params: {} });
    expect(fetchSpy.mock.calls[0][0]).toBe("http://192.168.1.50:4173/api/generate");
  });

  it("local-direct calls the user's server DIRECTLY (no /api/forward, no backend needed)", async () => {
    configureTransport({ forward: false });
    const fetchSpy = stubFetch({ prompt_id: "1" });
    await postJson("http://192.168.1.9:8188/prompt", { a: 1 });

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("http://192.168.1.9:8188/prompt"); // the real server, not our proxy
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ a: 1 }); // the payload itself, no forward envelope
  });

  it("a direct GET stays a GET (the forward envelope would have made it a POST)", async () => {
    configureTransport({ forward: false });
    const fetchSpy = stubFetch({ ok: true });
    await getJson("http://192.168.1.9:8188/history");

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("http://192.168.1.9:8188/history");
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
  });

  it("an unreachable LAN server gives an actionable message, not 'Network request failed'", async () => {
    configureTransport({ forward: false });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Network request failed")),
    );
    await expect(postJson("http://192.168.1.9:8188/prompt", {})).rejects.toThrow(
      /Can't reach http:\/\/192\.168\.1\.9:8188\/prompt.*Wi-Fi/s,
    );
  });

  it("applies a fetch timeout when configured (RN's fetch has none)", async () => {
    configureTransport({ forward: false, timeoutMs: 10 });
    // A fetch that never settles — only an abort can end it.
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url, init) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => reject(new Error("aborted")));
          }),
      ),
    );
    await expect(postJson("http://192.168.1.9:8188/prompt", {})).rejects.toThrow(/Can't reach/);
  });
});
