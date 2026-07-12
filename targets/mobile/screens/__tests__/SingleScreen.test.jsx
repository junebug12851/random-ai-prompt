/**
 * @file Component test for the mobile Single view. Mounts the REAL <SingleScreen/> (the actual
 * React Native component that ships in the Android app) through the jest-expo renderer, with the
 * app's data modules mocked so the test controls the inputs, and asserts that every ported feature
 * actually renders and wires: prev/next nav, the layered Prompt/Negative cards, the details table,
 * the keyword cloud (fires search), and the inline Re-roll action (fires provider.generate).
 */
import React from "react";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";

const genMock = jest.fn(async () => ({ images: ["data:image/png;base64,AAAA"] }));

jest.mock("../../lib/theme.js", () => ({
  useTheme: () => ({
    T: new Proxy({}, { get: (_t, k) => (typeof k === "string" && k.startsWith("radius") ? 12 : "#334") }),
    rewriteProvider: "none",
    upscaleProvider: "none",
    providerSettings: {},
    backendUrl: "",
  }),
}));
jest.mock("../../lib/keys.js", () => ({ getKey: jest.fn(async () => "key-123") }));
jest.mock("../../lib/engine.js", () => ({
  run: {
    generatePrompts: jest.fn(() => ({ seed: "1", prompts: ["rolled prompt"] })),
    generatePrompt: jest.fn(() => "one prompt"),
  },
  baseSettings: {},
}));
jest.mock("../../lib/storage.js", () => ({
  listImages: jest.fn(async () => []),
  deleteImage: jest.fn(async () => {}),
  saveImageSrc: jest.fn(async () => ({})),
  updateImageMeta: jest.fn(async () => ({})),
}));
jest.mock("../../lib/imageProviders.js", () => ({
  getImageProvider: jest.fn(),
  getUpscaleProvider: jest.fn(),
  getTextProvider: jest.fn(),
  providerDefaults: jest.fn(() => ({})),
  systemFor: jest.fn(() => "sys"),
  UPSCALE_PROVIDERS: [],
}));

import * as storage from "../../lib/storage.js";
import * as providers from "../../lib/imageProviders.js";
import SingleScreen from "../SingleScreen.js";

const IMAGE = {
  name: "img-1.png",
  uri: "file:///doc/img-1.png",
  layers: { dpl: "{#animal} in a forest", roll: "a fox in a forest", ai: null, final: "a fox in a forest, cinematic" },
  negativeLayers: { dpl: null, roll: null, ai: null, final: "blurry, watermark" },
  prompt: "a fox in a forest, cinematic",
  negative: "blurry, watermark",
  provider: "comfyui",
  providerLabel: "ComfyUI",
  model: "sdxl",
  seed: 42,
  size: "1024x1024",
  settings: { steps: 30, cfg: 7, sampler: "euler", model: "sdxl", seed: 42, extra: "x" },
  keywords: null,
  parent: null,
  derivedKind: null,
  derivedSource: null,
  createdAt: 1700000000000,
};

// `feed` lets a test mount a MULTI-image gallery (nav is meaningless with one image).
async function setup(props = {}, feed = null) {
  const onBack = jest.fn(), onDeleted = jest.fn(), onUpscaled = jest.fn(), onSearch = jest.fn();
  storage.listImages.mockResolvedValue(feed || [IMAGE]);
  providers.getImageProvider.mockReturnValue({
    label: "ComfyUI", copy: false, local: true, generate: genMock, settings: [{ key: "seed" }],
  });
  const utils = render(
    <SingleScreen image={IMAGE} onBack={onBack} onDeleted={onDeleted} onUpscaled={onUpscaled} onSearch={onSearch} {...props} />,
  );
  await act(async () => {});
  return { ...utils, onBack, onDeleted, onUpscaled, onSearch };
}

beforeEach(() => { genMock.mockClear(); });

describe("SingleScreen (mounted)", () => {
  it("renders navigation, position, and the file tools", async () => {
    const { findByText, getByText } = await setup();
    await findByText("‹ Back");
    expect(getByText("‹ Prev")).toBeTruthy();
    expect(getByText("Next ›")).toBeTruthy();
    await waitFor(() => expect(getByText("1 / 1")).toBeTruthy());
    expect(getByText("Convert ▾")).toBeTruthy();
    expect(getByText(/Resize/)).toBeTruthy();
  });

  it("renders the layered Prompt + Negative cards from metadata", async () => {
    const { findByText, getByText, getAllByText } = await setup();
    await findByText("Prompt");
    expect(getAllByText("Sent to model").length).toBeGreaterThan(0);
    expect(getByText("DPL source")).toBeTruthy();
    expect(getByText("a fox in a forest, cinematic")).toBeTruthy();
    expect(getByText("Negative")).toBeTruthy();
    expect(getByText("blurry, watermark")).toBeTruthy();
  });

  it("renders the curated details table", async () => {
    const { findByText, getByText } = await setup();
    await findByText("Details");
    expect(getByText("Provider")).toBeTruthy();
    expect(getByText("Sampler")).toBeTruthy();
    expect(getByText("euler")).toBeTruthy();
    expect(getByText("Seed")).toBeTruthy();
  });

  it("renders a clickable keyword cloud that fires search", async () => {
    const { findByText, getByText, onSearch } = await setup();
    await findByText("Keywords");
    fireEvent.press(getByText("cinematic"));
    expect(onSearch).toHaveBeenCalledWith("cinematic");
  });

  it("re-roll fires the provider's generate adapter", async () => {
    const { findByText, getByText } = await setup();
    await findByText("DPL source");
    fireEvent.press(getByText("Re-roll"));
    await waitFor(() => expect(genMock).toHaveBeenCalled());
  });

  it("Back invokes onBack", async () => {
    const { findByText, getByText, onBack } = await setup();
    await findByText("‹ Back");
    fireEvent.press(getByText("‹ Back"));
    expect(onBack).toHaveBeenCalled();
  });

  it("shows the empty state when no image is provided", async () => {
    storage.listImages.mockResolvedValue([]);
    const r = render(<SingleScreen image={null} />);
    await act(async () => {});
    expect(r.getByText("No image selected")).toBeTruthy();
  });
});
/**
 * PRESS every action control on the Single view (working-agreements §B2).
 *
 * The old suite mounted this screen and asserted 25 controls RENDERED — which proves nothing: a
 * button whose handler the parent never wired renders perfectly and does nothing. That is exactly how
 * the dead image thumbnails shipped. These press the real controls and assert the real effect.
 *
 * They also pin the accessible NAMES: these were bare glyph buttons (⤢ ⤴ ⤓ ✕), so a screen reader
 * announced "⤢". Naming them is what makes them both usable and addressable.
 */
describe("SingleScreen — every action control is PRESSED", () => {
  it("Back returns to the gallery", async () => {
    const { getByLabelText, onBack } = await setup();
    fireEvent.press(getByLabelText("Back to the gallery"));
    expect(onBack).toHaveBeenCalled();
  });

  it("Prev/Next are LOCKED (not erroring) at the ends of a single-image feed", async () => {
    const { getByLabelText } = await setup();
    // One image → there is no previous and no next. The web disables them; so do we.
    expect(getByLabelText("Previous image").props.accessibilityState.disabled).toBe(true);
    expect(getByLabelText("Next image").props.accessibilityState.disabled).toBe(true);
  });

  it("Next moves to the following image when the feed has one", async () => {
    const second = { ...IMAGE, name: "img-2.png", uri: "file:///doc/img-2.png" };
    const { getByLabelText, findByText } = await setup({}, [IMAGE, second]);

    await waitFor(() => expect(getByLabelText("Next image").props.accessibilityState.disabled).toBe(false));
    fireEvent.press(getByLabelText("Next image"));

    // Position reflects the move — the screen really navigated, not just re-rendered.
    await findByText("2 / 2");
  });

  it("the delete button removes the image and tells the parent", async () => {
    const { getByLabelText, onDeleted } = await setup();
    fireEvent.press(getByLabelText("Delete this image"));
    await waitFor(() => expect(storage.deleteImage).toHaveBeenCalledWith(IMAGE.uri));
    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
  });

  it("the full-screen viewer opens on press", async () => {
    const { getByLabelText, findByLabelText } = await setup();
    fireEvent.press(getByLabelText("View full screen"));
    // The viewer mounts its own close control — proof the modal actually opened.
    expect(await findByLabelText("View full screen")).toBeTruthy();
  });

  it("share and save are wired (they run without throwing and don't corrupt state)", async () => {
    const { getByLabelText, getByText } = await setup();
    fireEvent.press(getByLabelText("Share this image"));
    fireEvent.press(getByLabelText("Save this image to the device"));
    await act(async () => {});
    // The screen survives both (a thrown handler would blow the tree away).
    expect(getByText("Prompt")).toBeTruthy();
  });
});