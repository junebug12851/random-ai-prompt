/**
 * @file The mobile provider adapter over the SHARED registry.
 *
 * This file used to be an 892-line hand-port of every provider, and `scripts/mobile-parity-check.mjs`
 * existed to detect it drifting from the web. It now DERIVES its provider lists from the same
 * manifests the web uses, so drift is impossible by construction. What still needs proving is that
 * the derivation is right — that the adapter picks the same providers, by the same rules the web
 * uses, and routes generate/rewrite/upscale through the shared code rather than a local copy.
 */
import {
  IMAGE_PROVIDERS,
  TEXT_PROVIDERS,
  UPSCALE_PROVIDERS,
  getImageProvider,
  getTextProvider,
  getUpscaleProvider,
  providerDefaults,
  initProviderSchemas,
  configureMobileTransport,
  systemFor,
  cleanDplOutput,
} from "../imageProviders.js";
import { providers } from "shared/index.js";
import { getTransportConfig, resetTransportConfig } from "shared/_shared/transport/config.js";

afterEach(() => resetTransportConfig());

describe("derives its provider lists from the shared manifests (the web's rules, verbatim)", () => {
  it("image providers = copy-prompt + api-tier providers with a generate adapter", () => {
    const expected = providers
      .filter((p) => p.transport === "none" || (p.tier === "api" && p.loadGenerate))
      .map((p) => p.id)
      .sort();
    expect(IMAGE_PROVIDERS.map((p) => p.id).sort()).toEqual(expected);
    expect(IMAGE_PROVIDERS.length).toBeGreaterThan(5);
  });

  it("text providers = every rewrite-capable provider", () => {
    const expected = providers.filter((p) => p.loadRewrite || p.rewrite).map((p) => p.id).sort();
    expect(TEXT_PROVIDERS.map((p) => p.id).sort()).toEqual(expected);
  });

  it("upscale providers = capabilities.upscale AND a loadUpscale adapter", () => {
    const expected = providers
      .filter((p) => p.capabilities?.upscale && p.loadUpscale)
      .map((p) => p.id)
      .sort();
    expect(UPSCALE_PROVIDERS.map((p) => p.id).sort()).toEqual(expected);
  });

  it("labels/descriptions come from the manifest — no mobile-only copy", () => {
    const comfy = getImageProvider("comfyui");
    const manifest = providers.find((p) => p.id === "comfyui");
    expect(comfy.label).toBe(manifest.label);
    expect(comfy.description).toBe(manifest.description);
  });

  it("a text provider shows its CHAT model label, not its image label (web parity)", () => {
    const openai = getTextProvider("openai");
    const manifest = providers.find((p) => p.id === "openai");
    expect(manifest.rewriteLabel).toBeTruthy();
    expect(openai.label).toBe(manifest.rewriteLabel);
    expect(openai.label).not.toBe(manifest.label);
  });

  it("marks copy-prompt providers (no API) and local ones correctly", () => {
    expect(getImageProvider("plain").copy).toBe(true);
    expect(getImageProvider("plain").generate).toBeUndefined();
    expect(getImageProvider("comfyui").copy).toBe(false);
    expect(getImageProvider("comfyui").group).toBe("local");
    expect(getImageProvider("openai").group).toBe("online");
  });

  it("an unknown id resolves to undefined in every role", () => {
    expect(getImageProvider("nope")).toBeUndefined();
    expect(getTextProvider("nope")).toBeUndefined();
    expect(getUpscaleProvider("nope")).toBeUndefined();
  });
});

describe("settings schemas (preloaded once, then read synchronously)", () => {
  beforeAll(() => initProviderSchemas());

  it("exposes each provider's real fields + defaults from its shared settings module", () => {
    const comfy = getImageProvider("comfyui");
    const keys = comfy.settings.map((f) => f.key);
    expect(keys).toContain("comfyUrl");
    expect(keys).toContain("imageSteps");
    expect(providerDefaults("comfyui").comfyUrl).toBeTruthy();
  });

  it("resolves async option sources into concrete arrays (so the UI stays sync)", () => {
    const sampler = getImageProvider("comfyui").settings.find((f) => f.key === "sampler");
    expect(sampler.type).toBe("select");
    expect(Array.isArray(sampler.options)).toBe(true);
    expect(sampler.options.length).toBeGreaterThan(0);
  });

  it("derives serverKey from the provider's own URL field (not a hand-kept map)", () => {
    expect(getImageProvider("comfyui").serverKey).toBe("comfyUrl");
    expect(getImageProvider("openai").serverKey).toBeUndefined(); // not a local server
  });

  it("providerDefaults is a copy — mutating it can't corrupt the cache", () => {
    const a = providerDefaults("comfyui");
    a.comfyUrl = "http://tampered";
    expect(providerDefaults("comfyui").comfyUrl).not.toBe("http://tampered");
  });
});

describe("transport is pointed at the phone's reality", () => {
  it("sets an absolute Backend URL, direct local calls, and a fetch timeout", () => {
    configureMobileTransport("http://192.168.1.50:4173");
    const cfg = getTransportConfig();
    expect(cfg.apiBase).toBe("http://192.168.1.50:4173");
    expect(cfg.forward).toBe(false); // RN has no CORS — never hop through /api/forward
    expect(cfg.timeoutMs).toBeGreaterThan(0); // RN's fetch has no timeout
  });

  it("an empty Backend URL is not treated as a URL", () => {
    configureMobileTransport("");
    expect(getTransportConfig().apiBase).toBe("");
  });
});

describe("rewrite dispatch mirrors the web's rule", () => {
  it("browser-direct providers call their own API (no proxy hop)", async () => {
    const fetchSpy = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: "clean" } }] }),
    });
    global.fetch = fetchSpy;

    const openai = getTextProvider("openai");
    await openai.rewrite({ prompt: "a cat", key: "sk-x", system: systemFor("fix"), mode: "fix" });

    expect(fetchSpy).toHaveBeenCalled();
    expect(fetchSpy.mock.calls[0][0]).toContain("api.openai.com"); // straight to the provider
  });

  it("non-browser-direct providers go through the rewrite proxy at the Backend URL", async () => {
    configureMobileTransport("http://192.168.1.50:4173");
    const fetchSpy = jest
      .fn()
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({ text: "clean" }) });
    global.fetch = fetchSpy;

    const proxied = TEXT_PROVIDERS.find((p) => p.proxy);
    const out = await proxied.rewrite({ prompt: "a cat", key: "k", mode: "fix" });

    expect(out.text).toBe("clean");
    expect(fetchSpy.mock.calls[0][0]).toBe("http://192.168.1.50:4173/api/rewrite");
  });
});

describe("engine-domain helpers come from the engine/shared layer, not a local copy", () => {
  it("systemFor returns the DPL primer for a dpl-* task", () => {
    expect(systemFor("dpl-create")).toContain("DPL");
  });

  it("cleanDplOutput strips a wrapping fence and quotes", () => {
    expect(cleanDplOutput('```dpl\n{a|b}\n```')).toBe("{a|b}");
    expect(cleanDplOutput('"just this"')).toBe("just this");
  });
});
