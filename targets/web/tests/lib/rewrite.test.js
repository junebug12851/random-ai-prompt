/**
 * @file Unit tests for gui/src/lib/rewrite.js — the auto-fix rewrite client. The
 * provider registry is mocked so we can exercise both transports; the proxy path
 * is backed by MSW.
 */
import { describe, it, expect, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../msw/server.js";

// Mock the registry: a browser-direct provider (calls its own adapter) and a proxy provider.
vi.mock("../../frontend/lib/providers/index.js", () => ({
  getProvider: (id) =>
    ({
      direct: {
        transport: "browser-direct",
        loadRewrite: async () => async ({ prompt }) => ({ text: `DIRECT:${prompt}` }),
      },
      proxy: { transport: "hosted-proxy" },
    })[id],
}));

const { rewritePrompt } = await import("../../frontend/lib/rewrite.js");

describe("rewritePrompt — browser-direct", () => {
  it("calls the provider's own adapter (no proxy)", async () => {
    const out = await rewritePrompt({ providerId: "direct", prompt: "a fox", key: "k", mode: "fix" });
    expect(out).toBe("DIRECT:a fox");
  });
});

describe("rewritePrompt — proxy fallback", () => {
  it("posts to /api/rewrite and returns the text", async () => {
    server.use(http.post("/api/rewrite", () => HttpResponse.json({ text: "clean prompt" })));
    expect(await rewritePrompt({ providerId: "proxy", prompt: "x", key: "k" })).toBe("clean prompt");
  });

  it("throws with the server error message on a non-OK response", async () => {
    server.use(http.post("/api/rewrite", () => HttpResponse.json({ error: "boom" }, { status: 500 })));
    await expect(rewritePrompt({ providerId: "proxy", prompt: "x", key: "k" })).rejects.toThrow(
      /boom/,
    );
  });
});
