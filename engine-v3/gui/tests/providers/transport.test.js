/**
 * @file Contract tests for the shared provider transports: the hosted-proxy client,
 * the local-direct forwarder, and the generic submit→poll loop.
 */
import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../msw/server.js";
import { callProxy } from "../../providers/_shared/transport/hostedProxy.js";
import { postJson, getJson, normalizeBase } from "../../providers/_shared/transport/localDirect.js";
import { submitPoll } from "../../providers/_shared/transport/submitPoll.js";

describe("hostedProxy.callProxy", () => {
  it("posts the job to /api/generate and returns images", async () => {
    let body;
    server.use(
      http.post("/api/generate", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ images: ["data:image/png;base64,AAAA"] });
      }),
    );
    const out = await callProxy({ providerId: "replicate", prompt: "a fox", key: "k", params: { n: 1 } });
    expect(out.images).toEqual(["data:image/png;base64,AAAA"]);
    expect(body).toMatchObject({ providerId: "replicate", prompt: "a fox", key: "k", params: { n: 1 } });
  });

  it("defaults images to [] when the proxy omits them", async () => {
    server.use(http.post("/api/generate", () => HttpResponse.json({})));
    expect(await callProxy({ providerId: "x", prompt: "p", key: "k", params: {} })).toEqual({ images: [] });
  });

  it("throws the proxy error message on a non-OK response", async () => {
    server.use(http.post("/api/generate", () => HttpResponse.json({ error: "no key" }, { status: 400 })));
    await expect(callProxy({ providerId: "x", prompt: "p", key: "", params: {} })).rejects.toThrow(/no key/);
  });
});

describe("localDirect", () => {
  it("normalizeBase trims trailing slashes and uses the fallback", () => {
    expect(normalizeBase("http://h:1/", "fb")).toBe("http://h:1");
    expect(normalizeBase("", "http://fallback")).toBe("http://fallback");
  });

  it("postJson/getJson forward through /api/forward and return the parsed body", async () => {
    let fwd;
    server.use(
      http.post("/api/forward", async ({ request }) => {
        fwd = await request.json();
        return HttpResponse.json({ ok: 1 });
      }),
    );
    expect(await postJson("http://127.0.0.1:8188/prompt", { a: 1 })).toEqual({ ok: 1 });
    expect(fwd).toEqual({ url: "http://127.0.0.1:8188/prompt", method: "POST", body: { a: 1 } });
    expect(await getJson("http://127.0.0.1:8188/x")).toEqual({ ok: 1 });
  });

  it("surfaces a readable error from an object error + node_errors", async () => {
    server.use(
      http.post("/api/forward", () =>
        HttpResponse.json(
          { error: { message: "bad graph" }, node_errors: { 3: { errors: [{ details: "missing model" }] } } },
          { status: 400 },
        ),
      ),
    );
    await expect(getJson("http://x/prompt")).rejects.toThrow(/bad graph — missing model/);
  });
});

describe("submitPoll", () => {
  it("returns images once the status is done", async () => {
    const out = await submitPoll({
      submit: async () => ({ id: "j1" }),
      poll: async () => ({ status: "done", urls: ["u"] }),
      isDone: (s) => s.status === "done",
      getImages: (s) => s.urls,
      intervalMs: 1,
    });
    expect(out.images).toEqual(["u"]);
  });

  it("throws when the job fails", async () => {
    await expect(
      submitPoll({
        submit: async () => ({}),
        poll: async () => ({ status: "failed" }),
        isDone: () => false,
        isFailed: (s) => s.status === "failed",
        getImages: () => [],
      }),
    ).rejects.toThrow(/failed upstream/);
  });

  it("throws on timeout", async () => {
    await expect(
      submitPoll({
        submit: async () => ({}),
        poll: async () => ({ status: "pending" }),
        isDone: () => false,
        getImages: () => [],
        intervalMs: 1,
        timeoutMs: 0,
      }),
    ).rejects.toThrow(/timed out/);
  });
});
