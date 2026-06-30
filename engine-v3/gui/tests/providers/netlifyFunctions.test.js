/**
 * @file Tests for the server-side dispatch hub (`server/dispatch.js`) — the shared routing +
 * error mapping used by the local Vite dev middleware (`/api/generate`, `/api/rewrite`). The
 * former Netlify serverless proxy that also wrapped this hub was retired, so only the hub is
 * covered here.
 */
import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../msw/server.js";
import { dispatch, dispatchRewrite } from "../../server/dispatch.js";

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
