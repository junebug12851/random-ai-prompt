/**
 * @file Component test for the header ⋯ OverflowMenu — the three-role provider picker + provider
 * settings + appearance + language + links. Mounts the REAL component over the REAL provider registry
 * (only useTheme is mocked) and drills into each sub-menu.
 */
import React from "react";
import { render, fireEvent, act } from "@testing-library/react-native";

const mockSet = {
  provider: jest.fn(), rewrite: jest.fn(), upscale: jest.fn(),
  mode: jest.fn(), accent: jest.fn(), locale: jest.fn(),
};

jest.mock("../../lib/theme.js", () => ({
  useTheme: () => ({
    T: new Proxy({}, { get: (_t, k) => (typeof k === "string" && k.startsWith("radius") ? 12 : "#334") }),
    mode: "system", setMode: mockSet.mode,
    accent: "mint", setAccent: mockSet.accent, accents: [{ id: "mint", swatch: "#34e2a0" }, { id: "blue", swatch: "#3b82f6" }],
    locale: "en", setLocale: mockSet.locale, locales: [{ id: "en", label: "English" }],
    provider: "comfyui", setProvider: mockSet.provider,
    rewriteProvider: "none", setRewriteProvider: mockSet.rewrite,
    upscaleProvider: "none", setUpscaleProvider: mockSet.upscale,
    backendUrl: "", setBackendUrl: jest.fn(),
    providerSettings: {}, setProviderSetting: jest.fn(),
  }),
}));

import OverflowMenu from "../OverflowMenu.js";

async function setup() {
  const onClose = jest.fn();
  const utils = render(<OverflowMenu visible onClose={onClose} top={62} />);
  await act(async () => {});
  return { ...utils, onClose };
}

describe("OverflowMenu (mounted)", () => {
  it("root lists the three roles + settings/appearance/language + version + legal", async () => {
    const { getByText } = await setup();
    ["Image", "Text", "Upscale", "Provider settings", "Appearance", "Language"].forEach((t) =>
      expect(getByText(t)).toBeTruthy());
    expect(getByText("v2.52.0")).toBeTruthy();
    expect(getByText("Privacy Policy")).toBeTruthy();
  });

  it("Image drills into a grouped Local/Online picker and selects", async () => {
    const { getByText, findByText } = await setup();
    fireEvent.press(getByText("Image"));
    expect(await findByText("‹ Image provider")).toBeTruthy();
    expect(getByText("Local")).toBeTruthy();
    expect(getByText("Online")).toBeTruthy();
    // The label comes from the SHARED provider manifest now (same string the web shows), not a
    // mobile-only copy that suffixed "(local server)" — the picker already groups Local/Online.
    fireEvent.press(getByText("ComfyUI"));
    expect(mockSet.provider).toHaveBeenCalledWith("comfyui");
  });

  it("Text role shows Off + rewrite providers", async () => {
    const { getByText, findByText } = await setup();
    fireEvent.press(getByText("Text"));
    expect(await findByText("‹ Text (prompt & keyword rewrite)")).toBeTruthy();
    expect(getByText("Off")).toBeTruthy();
  });

  it("Upscale role shows Off + upscalers", async () => {
    const { getByText, findByText } = await setup();
    fireEvent.press(getByText("Upscale"));
    expect(await findByText("‹ Upscaler / Enhancer")).toBeTruthy();
    expect(getByText("Off")).toBeTruthy();
  });

  it("Appearance shows mode + accent controls", async () => {
    const { getByText, findByText } = await setup();
    fireEvent.press(getByText("Appearance"));
    expect(await findByText("Mode")).toBeTruthy();
    ["System", "Dark", "Light", "Accent"].forEach((t) => expect(getByText(t)).toBeTruthy());
    fireEvent.press(getByText("Dark"));
    expect(mockSet.mode).toHaveBeenCalledWith("dark");
  });

  it("Language lists locales", async () => {
    const { getByText, findByText } = await setup();
    fireEvent.press(getByText("Language"));
    await findByText("‹ Language");
    expect(getByText("English")).toBeTruthy();
  });
});