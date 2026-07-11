/**
 * @file Unit tests for provider-capability gating (lib/capabilities.js) — the ONE source of truth for
 * whether a control is usable. Regression: SingleScreen used to offer the ENTIRE UPSCALE_PROVIDERS
 * registry as tappable even with Upscale set to "none"; the web only offers what can actually run.
 */
jest.mock("../imageProviders.js", () => ({
  getImageProvider: jest.fn(),
  getTextProvider: jest.fn(),
  getUpscaleProvider: jest.fn(),
}));

import { getImageProvider, getTextProvider, getUpscaleProvider } from "../imageProviders.js";
import { canGenerateImages, canRewrite, canUpscale, upscalersFor } from "../capabilities.js";

beforeEach(() => jest.clearAllMocks());

describe("canGenerateImages", () => {
  it("false for a copy/plain provider (prompts only) and for an unknown id", () => {
    getImageProvider.mockReturnValue({ id: "plain", copy: true });
    expect(canGenerateImages("plain")).toBe(false);
    getImageProvider.mockReturnValue(undefined);
    expect(canGenerateImages("nope")).toBe(false);
  });
  it("true only when the provider can actually render", () => {
    getImageProvider.mockReturnValue({ id: "comfyui", copy: false, generate: () => {} });
    expect(canGenerateImages("comfyui")).toBe(true);
  });
});

describe("canRewrite", () => {
  it("false when off/unset", () => {
    expect(canRewrite("none")).toBe(false);
    expect(canRewrite("")).toBe(false);
    expect(canRewrite(undefined)).toBe(false);
  });
  it("true when a real text provider is picked", () => {
    getTextProvider.mockReturnValue({ id: "openai" });
    expect(canRewrite("openai")).toBe(true);
  });
});

describe("canUpscale / upscalersFor", () => {
  it("locked (no upscalers) when Upscale is off", () => {
    expect(canUpscale("none")).toBe(false);
    expect(upscalersFor("none")).toEqual([]);
    expect(upscalersFor(undefined)).toEqual([]);
  });
  it("offers ONLY the picked upscaler — never the whole registry", () => {
    getUpscaleProvider.mockReturnValue({ id: "esrgan", label: "Real-ESRGAN (local)" });
    expect(canUpscale("esrgan")).toBe(true);
    expect(upscalersFor("esrgan")).toEqual([{ id: "esrgan", label: "Real-ESRGAN (local)" }]);
  });
});
