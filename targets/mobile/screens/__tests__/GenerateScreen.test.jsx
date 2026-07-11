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

import * as providers from "../../lib/imageProviders.js";
import * as storage from "../../lib/storage.js";
import GenerateScreen from "../GenerateScreen.js";

// Default: the "plain" copy provider (prompts only, no images).
const COPY_PROVIDER = { id: "plain", copy: true, label: "None" };
beforeEach(() => {
  providers.getImageProvider.mockReturnValue(COPY_PROVIDER);
  storage.saveImageSrc.mockResolvedValue({});
});

async function setup() {
  const onGenerated = jest.fn(), onOpenImage = jest.fn();
  const utils = render(<GenerateScreen onGenerated={onGenerated} onOpenImage={onOpenImage} />);
  await act(async () => {});
  return { ...utils, onGenerated, onOpenImage };
}

describe("GenerateScreen (mounted)", () => {
  it("renders the composer (editor, prompts count, generate button)", async () => {
    const { getByPlaceholderText, getByText, getByLabelText } = await setup();
    // The empty box advertises the rotating random suggestion (web parity: "Try: …"); it falls back
    // to "{#random-words}" only until the first suggestion rolls.
    expect(getByPlaceholderText("Try: a live preview line")).toBeTruthy();
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

  // --- Image batches: INTERACTION tests (regression) ---------------------------------------------
  // These press things. The previous suite only asserted rendering, so two real bugs sailed through:
  //   1. App passed `onOpenImage` but GenerateScreen never destructured it → thumbs were dead.
  //   2. Generate saved images to the Gallery but never attached them to their prompt row, so nothing
  //      appeared inline on Generate; and the row stored RAW provider sources (which Single, which
  //      resolves by saved gallery uri, could never open).

  const savedItem = { name: "img-1.png", uri: "file:///doc/rap/images/img-1.png" };
  const withImageProvider = () => {
    providers.getImageProvider.mockReturnValue({
      id: "comfyui",
      local: true,
      copy: false,
      label: "ComfyUI",
      generate: jest.fn(async () => ({ images: ["data:image/png;base64,AAA"] })),
    });
    storage.saveImageSrc.mockResolvedValue(savedItem);
  };

  it("generating auto-attaches the image INLINE to its prompt row", async () => {
    withImageProvider();
    const { getByLabelText, findByLabelText } = await setup();
    fireEvent.press(getByLabelText("Generate"));
    // The thumb shows under the prompt (not only in the Gallery).
    expect(await findByLabelText("Open generated image 1")).toBeTruthy();
  });

  it("tapping a generated image opens it in Single via onOpenImage (with the SAVED gallery item)", async () => {
    withImageProvider();
    const { getByLabelText, findByLabelText, onOpenImage } = await setup();
    fireEvent.press(getByLabelText("Generate"));
    fireEvent.press(await findByLabelText("Open generated image 1"));
    // Must hand Single the saved {name, uri} — Single resolves by gallery uri, not the raw source.
    expect(onOpenImage).toHaveBeenCalledWith(savedItem);
  });

  it("the per-row 'Generate images' link also yields a tappable, openable image", async () => {
    withImageProvider();
    const { getByLabelText, getByText, findByLabelText, onOpenImage } = await setup();
    fireEvent.press(getByLabelText("Generate"));
    await findByLabelText("Open generated image 1");
    fireEvent.press(getByText("Generate images")); // per-row link
    const thumbs = await findByLabelText("Open generated image 2");
    fireEvent.press(thumbs);
    expect(onOpenImage).toHaveBeenCalledWith(savedItem);
  });
});
/**
 * Regression: the toolbar's 5th slot used to be a SECOND building-blocks button — an exact duplicate
 * of the green FAB (same icon, same `setPaletteOpen(true)` handler) — which meant the web's SHUFFLE
 * control (drop the rotating random suggestion into the box) was missing from mobile entirely.
 *
 * Nothing automated caught it: the surface-parity check greps for /suggestions/, which matched the
 * DPL *completion strip* (a different feature that happens to share the word), and a render-only test
 * sees a perfectly fine button. It was found by LOOKING at a screenshot. See working-agreements §B3.
 */
describe("GenerateScreen — random suggestion (shuffle)", () => {
  it("exposes a shuffle control that appends the rotating suggestion to the prompt", async () => {
    const { getByLabelText, getByDisplayValue } = await setup();

    const shuffle = getByLabelText("Random suggestion");
    expect(shuffle.props.accessibilityState.disabled).toBe(false);

    fireEvent.press(shuffle);

    // The engine mock's expandOnce() -> "a live preview line" is the suggestion; pressing shuffle
    // appends it to the existing prompt (comma-separated), exactly like the web's insert().
    expect(getByDisplayValue("{#random-words}, a live preview line")).toBeTruthy();
  });

  it("advertises the suggestion in the placeholder (web parity: 'Try: …')", async () => {
    const { getByPlaceholderText } = await setup();
    expect(getByPlaceholderText("Try: a live preview line")).toBeTruthy();
  });

  it("has exactly ONE building-blocks control (the FAB) — not a duplicate in the toolbar", async () => {
    const { getAllByLabelText } = await setup();
    expect(getAllByLabelText("Open the building-blocks palette")).toHaveLength(1);
  });
});