/**
 * @file Component test for the mobile Generate screen. Mounts the REAL <GenerateScreen/> through the
 * jest-expo renderer (native modules + app data mocked) and asserts the composer renders and its core
 * flows wire: rolling prompts into results, opening the full prompt-settings gear, and the live preview.
 */
import React from "react";
import { render, fireEvent, act } from "@testing-library/react-native";

jest.mock("../../lib/theme.js", () => ({
  useTheme: () => ({
    T: new Proxy({}, { get: (_t, k) => (typeof k === "string" && k.startsWith("radius") ? 12 : "#334") }),
    provider: "plain",
    rewriteProvider: "none",
    providerSettings: {},
    setProviderSetting: jest.fn(),
    backendUrl: "",
  }),
}));
jest.mock("../../lib/engine.js", () => ({
  run: {
    generatePrompts: jest.fn(() => ({ seed: "7", prompts: ["hello world"] })),
    generatePrompt: jest.fn(() => "hello world"),
  },
  baseSettings: { prompt: "{#random-words}" },
  expandOnce: jest.fn(() => "a live preview line"),
  getListNames: jest.fn(() => []),
}));
jest.mock("../../lib/blockCatalog.js", () => ({ getDplCompletions: jest.fn(() => []) }));
jest.mock("../../lib/imageProviders.js", () => ({
  getImageProvider: jest.fn(() => ({ id: "plain", copy: true, label: "None" })),
  getTextProvider: jest.fn(),
  providerDefaults: jest.fn(() => ({})),
  systemFor: jest.fn(() => "sys"),
}));
jest.mock("../../lib/single.js", () => ({ sizeFromSettings: jest.fn(() => "") }));
jest.mock("../../lib/keys.js", () => ({ getKey: jest.fn(async () => "") }));
jest.mock("../../lib/storage.js", () => ({ saveImageSrc: jest.fn(async () => ({})) }));
jest.mock("../../components/InsertMenu.js", () => () => null);
jest.mock("../../components/BlockPalette.js", () => () => null);

import GenerateScreen from "../GenerateScreen.js";

async function setup() {
  const onGenerated = jest.fn(), onOpenImage = jest.fn();
  const utils = render(<GenerateScreen onGenerated={onGenerated} onOpenImage={onOpenImage} />);
  await act(async () => {});
  return { ...utils, onGenerated };
}

describe("GenerateScreen (mounted)", () => {
  it("renders the composer (editor, prompts count, generate button)", async () => {
    const { getByPlaceholderText, getByText, getByLabelText } = await setup();
    expect(getByPlaceholderText("{#random-words}")).toBeTruthy();
    expect(getByText("PROMPTS")).toBeTruthy();
    expect(getByLabelText("Generate")).toBeTruthy();
  });

  it("rolling generates prompts into the results feed", async () => {
    const { getByLabelText, findByText } = await setup();
    fireEvent.press(getByLabelText("Generate"));
    expect(await findByText("hello world")).toBeTruthy();
  });

  it("the gear opens the full prompt-settings sheet", async () => {
    const { getByLabelText, findByText, getByText } = await setup();
    fireEvent.press(getByLabelText("Prompt settings"));
    expect(await findByText("Salt & lists")).toBeTruthy();
    expect(getByText("Vocabulary")).toBeTruthy();
    expect(getByText("Emphasis")).toBeTruthy();
  });

  it("live preview renders a re-rolled example", async () => {
    const { getByLabelText, findByText } = await setup();
    fireEvent.press(getByLabelText("Toggle live preview"));
    expect(await findByText("PREVIEW · LIVE")).toBeTruthy();
  });
});