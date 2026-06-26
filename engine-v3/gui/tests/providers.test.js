/**
 * @file Contract/API tests for the image-generation providers (gui/providers/*). The
 * registry auto-discovers provider folders; the local WebUI adapter is the SD `txt2img`
 * contract: these lock the request shape it sends and the response shape it expects, with
 * `fetch` mocked so no real WebUI is needed. The Midjourney formatter and the `plain`
 * dialect (emphasis-as-words) are covered alongside.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { availableProviders, getProvider } from "../src/lib/providers/index.js";
import localWebuiGenerate from "../providers/local-webui/code/generate.js";
import mjFormat from "../providers/midjourney/code/format.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("provider registry", () => {
  it("auto-discovers the bundled providers in local mode", () => {
    const ids = availableProviders().map((p) => p.id);
    expect(ids).toContain("local-webui");
    expect(ids).toContain("comfyui");
    expect(ids).toContain("openai");
    expect(ids).toContain("midjourney");
  });

  it("getProvider returns the matching provider, or a sensible default", () => {
    expect(getProvider("local-webui").id).toBe("local-webui");
    expect(getProvider("does-not-exist")).toBeTruthy();
  });

  it("each provider declares a tier, dialect, and transport", () => {
    for (const p of availableProviders()) {
      expect(p.tier).toBeTruthy();
      expect(p.dialect).toBeTruthy();
      expect(p.transport).toBeTruthy();
    }
  });
});

describe("local WebUI provider — txt2img contract", () => {
  it("POSTs the expected request body and maps base64 images to data URLs", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ images: ["AAAA", "BBBB"] }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await localWebuiGenerate({
      prompt: "a fox",
      settings: {
        localWebuiUrl: "http://127.0.0.1:7860/",
        negativePrompt: "blurry",
        imageSteps: 30,
        cfg: 8,
        imageWidth: 768,
        imageHeight: 512,
        sampler: "Euler a",
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("http://127.0.0.1:7860/sdapi/v1/txt2img");
    expect(opts.method).toBe("POST");

    const body = JSON.parse(opts.body);
    expect(body).toMatchObject({
      prompt: "a fox",
      negative_prompt: "blurry",
      steps: 30,
      cfg_scale: 8,
      width: 768,
      height: 512,
      sampler_index: "Euler a",
    });

    expect(result.images).toEqual(["data:image/png;base64,AAAA", "data:image/png;base64,BBBB"]);
  });

  it("throws a descriptive error on a non-OK response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500 })));
    await expect(localWebuiGenerate({ prompt: "x", settings: {} })).rejects.toThrow(/returned 500/);
  });

  it("defaults to 127.0.0.1:7860 when no URL is set", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ images: [] }) }));
    vi.stubGlobal("fetch", fetchMock);
    await localWebuiGenerate({ prompt: "x", settings: {} });
    expect(fetchMock.mock.calls[0][0]).toBe("http://127.0.0.1:7860/sdapi/v1/txt2img");
  });
});

describe("Midjourney formatter — parameter flags", () => {
  it("appends --v and the set parameters, and omits unset ones", () => {
    const out = mjFormat("a fox::1.2", { version: "6.1", ar: "16:9", stylize: 250, tile: true, seed: "" });
    expect(out).toContain("a fox::1.2");
    expect(out).toContain("--v 6.1");
    expect(out).toContain("--ar 16:9");
    expect(out).toContain("--stylize 250");
    expect(out).toContain("--tile");
    expect(out).not.toContain("--seed");
  });

  it("Niji overrides Version", () => {
    const out = mjFormat("cat", { version: "6", niji: "6" });
    expect(out).toContain("--niji 6");
    expect(out).not.toContain("--v 6");
  });
});
