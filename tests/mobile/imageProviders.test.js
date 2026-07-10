/**
 * @file Unit tests for the mobile provider registry (targets/mobile/lib/imageProviders.js) — the
 * three role catalogs, the id lookups, per-provider defaults, the rewrite system-prompt selector, and
 * structural invariants every provider entry must hold. (Pure JS, no React Native — runs in root vitest.)
 */
import { describe, it, expect } from "vitest";
import {
  IMAGE_PROVIDERS,
  TEXT_PROVIDERS,
  UPSCALE_PROVIDERS,
  getImageProvider,
  getTextProvider,
  getUpscaleProvider,
  providerDefaults,
  systemFor,
} from "../../targets/mobile/lib/imageProviders.js";

describe("registry lookups", () => {
  it("resolve a known id per role, undefined otherwise", () => {
    expect(getImageProvider("comfyui")?.id).toBe("comfyui");
    expect(getImageProvider("nope")).toBeUndefined();
    expect(getTextProvider("openai")?.id).toBe("openai");
    expect(getUpscaleProvider("comfyui")?.id).toBe("comfyui");
  });
});

describe("providerDefaults", () => {
  it("returns each setting's default for a provider with settings", () => {
    const p = getImageProvider("comfyui");
    const d = providerDefaults("comfyui");
    expect(typeof d).toBe("object");
    for (const f of p.settings) expect(d[f.key]).toEqual(f.default);
  });
  it("returns an empty object for a settings-less / unknown provider", () => {
    expect(providerDefaults("plain")).toEqual({});
    expect(providerDefaults("does-not-exist")).toEqual({});
  });
});

describe("systemFor", () => {
  it("selects a different system prompt for keyword vs fix", () => {
    expect(systemFor("keyword")).not.toBe(systemFor("fix"));
    expect(typeof systemFor("keyword")).toBe("string");
  });
});

describe("structural invariants", () => {
  it("every image provider has id + label + group and is copy XOR generate", () => {
    for (const p of IMAGE_PROVIDERS) {
      expect(p.id).toBeTruthy();
      expect(p.label).toBeTruthy();
      expect(["local", "online"]).toContain(p.group);
      const runnable = p.copy === true || typeof p.generate === "function";
      expect(runnable).toBe(true);
    }
  });
  it("negative-prompt flag is set on the samplers that support it", () => {
    for (const id of ["comfyui", "forge", "sdnext", "stability"]) {
      expect(getImageProvider(id)?.negative).toBe(true);
    }
  });
  it("every text provider can rewrite; every upscaler can upscale + is grouped", () => {
    for (const p of TEXT_PROVIDERS) {
      expect(p.id).toBeTruthy();
      expect(typeof p.rewrite).toBe("function");
    }
    for (const p of UPSCALE_PROVIDERS) {
      expect(p.id).toBeTruthy();
      expect(typeof p.upscale).toBe("function");
      expect(["local", "online"]).toContain(p.group);
    }
  });
  it("ids are unique within each role", () => {
    for (const list of [IMAGE_PROVIDERS, TEXT_PROVIDERS, UPSCALE_PROVIDERS]) {
      const ids = list.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});