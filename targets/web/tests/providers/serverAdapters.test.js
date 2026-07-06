/**
 * @file Contract tests for the hosted providers' server-side adapters (the real API
 * request shapers that run in the proxy). Each is MSW-backed against its actual upstream
 * URL, asserting request shape + response mapping + error handling.
 */
import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../msw/server.js";
import openaiServer from "../../shared/openai/code/server.js";
import replicateServer from "../../shared/replicate/code/server.js";
import stabilityServer from "../../shared/stability/code/server.js";
import falServer from "../../shared/fal/code/server.js";
import geminiServer from "../../shared/gemini/code/server.js";

describe("openai server adapter", () => {
  it("sends model/prompt/size/n with a Bearer key and maps b64 + url images", async () => {
    let body;
    let auth;
    server.use(
      http.post("https://api.openai.com/v1/images/generations", async ({ request }) => {
        body = await request.json();
        auth = request.headers.get("authorization");
        return HttpResponse.json({ data: [{ b64_json: "AAAA" }, { url: "https://x/y.png" }] });
      }),
    );
    const out = await openaiServer({ prompt: "a fox", key: "sk", params: { model: "gpt-image-1", size: "512x512", n: 2 } });
    expect(body).toEqual({ model: "gpt-image-1", prompt: "a fox", size: "512x512", n: 2 });
    expect(auth).toBe("Bearer sk");
    expect(out.images).toEqual(["data:image/png;base64,AAAA", "https://x/y.png"]);
  });

  it("throws the OpenAI error message on a non-OK response", async () => {
    server.use(
      http.post("https://api.openai.com/v1/images/generations", () =>
        HttpResponse.json({ error: { message: "bad key" } }, { status: 401 }),
      ),
    );
    await expect(openaiServer({ prompt: "x", key: "bad" })).rejects.toThrow(/bad key/);
  });
});

describe("replicate server adapter", () => {
  it("creates a prediction with Prefer:wait and normalizes a string output to an array", async () => {
    let headers;
    server.use(
      http.post("https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions", ({ request }) => {
        headers = { auth: request.headers.get("authorization"), prefer: request.headers.get("prefer") };
        return HttpResponse.json({ output: "https://r/img.png" });
      }),
    );
    const out = await replicateServer({ prompt: "p", key: "r8", params: {} });
    expect(out.images).toEqual(["https://r/img.png"]);
    expect(headers).toEqual({ auth: "Bearer r8", prefer: "wait" });
  });

  it("throws when the model returns no image url", async () => {
    server.use(
      http.post("https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions", () =>
        HttpResponse.json({ output: [] }),
      ),
    );
    await expect(replicateServer({ prompt: "p", key: "r8", params: {} })).rejects.toThrow(/no image url/i);
  });
});

describe("stability server adapter", () => {
  it("maps a base64 image to a data URL", async () => {
    server.use(
      http.post("https://api.stability.ai/v2beta/stable-image/generate/core", () =>
        HttpResponse.json({ image: "BBBB" }),
      ),
    );
    const out = await stabilityServer({ prompt: "p", key: "st", params: {} });
    expect(out.images).toEqual(["data:image/png;base64,BBBB"]);
  });

  it("routes to the chosen endpoint (sd3) and throws on error", async () => {
    server.use(
      http.post("https://api.stability.ai/v2beta/stable-image/generate/sd3", () =>
        HttpResponse.json({ errors: ["content moderated"] }, { status: 403 }),
      ),
    );
    await expect(stabilityServer({ prompt: "p", key: "st", params: { model: "sd3" } })).rejects.toThrow(
      /content moderated/,
    );
  });
});

describe("fal server adapter", () => {
  it("uses the Key auth scheme and maps {url} images", async () => {
    let auth;
    server.use(
      http.post("https://fal.run/fal-ai/flux/schnell", ({ request }) => {
        auth = request.headers.get("authorization");
        return HttpResponse.json({ images: [{ url: "https://fal/img.png" }] });
      }),
    );
    const out = await falServer({ prompt: "p", key: "fk", params: {} });
    expect(out.images).toEqual(["https://fal/img.png"]);
    expect(auth).toBe("Key fk");
  });
});

describe("gemini server adapter", () => {
  it("extracts the inline base64 image into a data URL", async () => {
    server.use(
      http.post("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent", () =>
        HttpResponse.json({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: "CCCC" } }] } }] }),
      ),
    );
    const out = await geminiServer({ prompt: "p", key: "gk", params: {} });
    expect(out.images).toEqual(["data:image/png;base64,CCCC"]);
  });

  it("throws when no image part is returned", async () => {
    server.use(
      http.post("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent", () =>
        HttpResponse.json({ candidates: [{ content: { parts: [{ text: "nope" }] } }] }),
      ),
    );
    await expect(geminiServer({ prompt: "p", key: "gk", params: {} })).rejects.toThrow(/no image/i);
  });
});
