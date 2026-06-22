/**
 * @file Contract/API tests for the image-generation providers
 * (web-app/src/lib/providers/*). The local WebUI provider is the SD `txt2img`
 * contract: these lock the request shape it sends and the response shape it expects,
 * with `fetch` mocked so no real WebUI is needed.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { availableProviders, getProvider } from "../src/lib/providers/index.js";
import { localWebuiProvider } from "../src/lib/providers/localWebui.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("provider registry", () => {
  it("includes the local WebUI provider in local mode", () => {
    const ids = availableProviders().map((p) => p.id);
    expect(ids).toContain("local-webui");
  });

  it("getProvider returns the matching provider, or a sensible default", () => {
    expect(getProvider("local-webui").id).toBe("local-webui");
    expect(getProvider("does-not-exist")).toBeTruthy();
  });
});

describe("local WebUI provider — txt2img contract", () => {
  it("POSTs the expected request body and maps base64 images to data URLs", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ images: ["AAAA", "BBBB"] }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await localWebuiProvider.generate({
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

    // Endpoint (trailing slash trimmed).
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("http://127.0.0.1:7860/sdapi/v1/txt2img");
    expect(opts.method).toBe("POST");

    // Request body contract.
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

    // Response contract.
    expect(result.images).toEqual([
      "data:image/png;base64,AAAA",
      "data:image/png;base64,BBBB",
    ]);
  });

  it("throws a descriptive error on a non-OK response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500 })));
    await expect(
      localWebuiProvider.generate({ prompt: "x", settings: {} }),
    ).rejects.toThrow(/WebUI returned 500/);
  });

  it("defaults to 127.0.0.1:7860 when no URL is set", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ images: [] }) }));
    vi.stubGlobal("fetch", fetchMock);
    await localWebuiProvider.generate({ prompt: "x", settings: {} });
    expect(fetchMock.mock.calls[0][0]).toBe("http://127.0.0.1:7860/sdapi/v1/txt2img");
  });
});
