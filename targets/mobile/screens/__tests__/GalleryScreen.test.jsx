/**
 * @file Component test for the mobile Gallery screen — mounts the REAL <GalleryScreen/> with a seeded
 * image feed and asserts the header (title/count/search/select/refresh), the compact composer, the
 * search filter, multi-select mode, and the empty state.
 */
import React from "react";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";

jest.mock("../../lib/theme.js", () => ({
  useTheme: () => ({
    T: new Proxy({}, { get: (_t, k) => (typeof k === "string" && k.startsWith("radius") ? 12 : "#334") }),
    provider: "plain",
    providerSettings: {},
    backendUrl: "",
  }),
}));
jest.mock("../../lib/engine.js", () => ({
  run: { generatePrompts: jest.fn(() => ({ seed: "1", prompts: ["p"] })) },
  baseSettings: {},
}));
jest.mock("../../lib/imageProviders.js", () => ({
  getImageProvider: jest.fn(() => ({ id: "plain", copy: true, label: "None" })),
  providerDefaults: jest.fn(() => ({})),
}));
jest.mock("../../lib/single.js", () => ({ sizeFromSettings: jest.fn(() => "") }));
jest.mock("../../lib/keys.js", () => ({ getKey: jest.fn(async () => "") }));
jest.mock("../../lib/storage.js", () => ({
  listImages: jest.fn(async () => []),
  deleteImages: jest.fn(async () => {}),
  saveImageSrc: jest.fn(async () => ({})),
}));

import * as storage from "../../lib/storage.js";
import GalleryScreen from "../GalleryScreen.js";

const IMAGES = [
  { name: "a.png", uri: "file:///a.png", prompt: "a fox in a forest", provider: "comfyui" },
  { name: "b.png", uri: "file:///b.png", prompt: "a cat on a wall", provider: "comfyui" },
];

async function setup(feed = IMAGES) {
  storage.listImages.mockResolvedValue(feed);
  const onOpen = jest.fn();
  const utils = render(<GalleryScreen onOpen={onOpen} refreshKey={0} />);
  await act(async () => {});
  return { ...utils, onOpen };
}

describe("GalleryScreen (mounted)", () => {
  it("renders the header, count, search, select, refresh, and composer", async () => {
    const { getByText, getByPlaceholderText, getByLabelText } = await setup();
    expect(getByText("Photo gallery")).toBeTruthy();
    await waitFor(() => expect(getByText("2 images")).toBeTruthy());
    expect(getByPlaceholderText("Search prompts, provider…")).toBeTruthy();
    expect(getByText("Select")).toBeTruthy();
    expect(getByText("Refresh")).toBeTruthy();
    expect(getByPlaceholderText("{#random-words} — prompt to generate here")).toBeTruthy();
    expect(getByLabelText("Generate here")).toBeTruthy();
  });

  it("search filters the feed (count reflects matches)", async () => {
    const { getByPlaceholderText, findByText } = await setup();
    fireEvent.changeText(getByPlaceholderText("Search prompts, provider…"), "fox");
    expect(await findByText(/1 match/)).toBeTruthy();
  });

  it("Select enters multi-select mode", async () => {
    const { getByText, findByText } = await setup();
    fireEvent.press(getByText("Select"));
    expect(await findByText("None selected")).toBeTruthy();
    expect(getByText("Select all")).toBeTruthy();
    expect(getByText("Done")).toBeTruthy();
  });

  it("shows the empty state with no images", async () => {
    const { getByText } = await setup([]);
    expect(getByText("No images yet")).toBeTruthy();
  });
});