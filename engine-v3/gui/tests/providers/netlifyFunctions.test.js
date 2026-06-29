/**
 * @file Tests for the stateless proxy: the server-side dispatch hub plus the Netlify
 * function handlers (generate + rewrite) — validation, routing, and error mapping.
 */
import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../msw/server.js";
import { dispatch, dispatchRewrite } from "../../server/dispatch.js";
import { handler as generateHandler } from "../../netlify/functions/generate.js";
import { handler as rewriteHandler } from "../../netlify/functions/rewrite.js";

const post = (obj) => ({ httpMethod: "POST", body: JSON.stringify(obj) });

describe("dispatch", () => {
  it("routes to the provider's server adapter", async () => {
    server.use(
      http.post("https://api.openai.com/v1/images/generations", () =>
        HttpResponse.json({ data: [{ b64_json: "AAAA" }] }),
      ),
    );
    const out = await dispatch({ providerId: "openai", prompt: "p", key: "sk", params: {} });
    expect(out.images).toEqual(["data:image/png;base64,AAAA"]);
  });

  it("throws for an unknown provider or missing key", async () => {
    await expect(dispatch({ providerId: "nope", prompt: "p", key: "k" })).rejects.toThrow(/no server adapter/i);
    await expect(dispatch({ providerId: "openai", prompt: "p", key: "" })).rejects.toThrow(/missing api key/i);
  });
});

describe("dispatchRewrite", () => {
  it("routes to the provider's rewrite adapter", async () => {
    server.use(
      http.post("https://api.openai.com/v1/chat/completions", () =>
        HttpResponse.json({ choices: [{ message: { content: "fixed" } }] }),
      ),
    );
    expect((await dispatchRewrite({ providerId: "openai", prompt: "p", key: "sk" })).text).toBe("fixed");
  });

  it("throws for a non-rewrite provider", async () => {
    await expect(dispatchRewrite({ providerId: "replicate", prompt: "p", key: "k" })).rejects.toThrow(
      /can't rewrite/i,
    );
  });
});

describe("generate Netlify handler", () => {
  it("rejects non-POST with 405", async () => {
    expect((await generateHandler({ httpMethod: "GET" })).statusCode).toBe(405);
  });
  it("rejects invalid JSON / missing fields with 400", async () => {
    expect((await generateHandler({ httpMethod: "POST", body: "{" })).statusCode).toBe(400);
    expect((await generateHandler(post({ key: "k" }))).statusCode).toBe(400); // missing prompt
    expect((await generateHandler(post({ prompt: "p" }))).statusCode).toBe(400); // missing key
  });
  it("returns 200 with images on success", async () => {
    server.use(
      http.post("https://api.openai.com/v1/images/generations", () =>
        HttpResponse.json({ data: [{ url: "https://x/y.png" }] }),
      ),
    );
    const res = await generateHandler(post({ providerId: "openai", prompt: "p", key: "sk", params: {} }));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).images).toEqual(["https://x/y.png"]);
  });
  it("maps an upstream failure to 502", async () => {
    server.use(
      http.post("https://api.openai.com/v1/images/generations", () =>
        HttpResponse.json({ error: { message: "bad" } }, { status: 401 }),
      ),
    );
    const res = await generateHandler(post({ providerId: "openai", prompt: "p", key: "sk" }));
    expect(res.statusCode).toBe(502);
  });
});

describe("rewrite Netlify handler", () => {
  it("returns 200 with text on success", async () => {
    server.use(
      http.post("https://api.openai.com/v1/chat/completions", () =>
        HttpResponse.json({ choices: [{ message: { content: "clean" } }] }),
      ),
    );
    const res = await rewriteHandler(post({ providerId: "openai", prompt: "p", key: "sk" }));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).text).toBe("clean");
  });
  it("missing prompt is a 400; an unknown provider is a 502", async () => {
    expect((await rewriteHandler(post({ key: "k" }))).statusCode).toBe(400);
    const res = await rewriteHandler(post({ providerId: "nope", prompt: "p", key: "k" }));
    expect(res.statusCode).toBe(502);
  });
});
