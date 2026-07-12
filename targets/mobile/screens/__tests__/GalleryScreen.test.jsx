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
/**
 * PRESS every Gallery control (working-agreements §B2). The old suite pressed exactly one thing
 * ("Select") and asserted the rest merely rendered — which cannot catch a dead control.
 *
 * The multi-select → select-all → delete flow is the destructive one, so it gets pressed end to end
 * and asserted on the STORAGE call: a "Delete" button that removes rows from the UI but never touches
 * the disk would pass any render test and lose the user nothing... until they reopen the app and find
 * everything still there.
 */
describe("GalleryScreen — every control is PRESSED", () => {
  it("tapping a cell opens THAT image (identified by its prompt, not an index)", async () => {
    const { findByLabelText, onOpen } = await setup();

    // The cell is named after the prompt that made it — that's the image's identity, and it's what a
    // screen-reader user (and this test) has to go on.
    fireEvent.press(await findByLabelText("Open image: a fox in a forest"));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ uri: "file:///a.png" }));
  });

  it("Refresh re-reads the gallery from storage", async () => {
    const { findByText, getByText } = await setup();
    await findByText(/2 images?/i);
    storage.listImages.mockClear();

    fireEvent.press(getByText("Refresh"));
    await waitFor(() => expect(storage.listImages).toHaveBeenCalled());
  });

  it("Select → All → Delete actually deletes the selected images from STORAGE", async () => {
    const { findByText, getByText } = await setup();
    await findByText(/2 images?/i);

    fireEvent.press(getByText("Select"));
    fireEvent.press(getByText("Select all"));
    fireEvent.press(getByText(/^Delete/)); // "Delete 2"

    await waitFor(() =>
      expect(storage.deleteImages).toHaveBeenCalledWith(
        expect.arrayContaining(["file:///a.png", "file:///b.png"]),
      ),
    );
  });

  it("Clear un-selects, and Done leaves multi-select mode", async () => {
    const { findByText, getByText, queryByText } = await setup();
    await findByText(/2 images?/i);

    fireEvent.press(getByText("Select"));
    fireEvent.press(getByText("Select all"));
    fireEvent.press(getByText("Clear"));
    // Nothing selected → the destructive button carries no count.
    expect(getByText(/^Delete/)).toBeTruthy();

    fireEvent.press(getByText("Done"));
    await waitFor(() => expect(queryByText("Done")).toBeNull()); // back to the normal header
    expect(getByText("Select")).toBeTruthy();
  });

  it("an empty gallery shows its empty state and never crashes", async () => {
    const { findByText } = await setup([]);
    expect(await findByText("No images yet")).toBeTruthy();
  });

  it("a selected cell ANNOUNCES that it is selected (multi-select must work without sight)", async () => {
    const { findByLabelText, getByText } = await setup();
    fireEvent.press(getByText("Select"));

    const cell = await findByLabelText("Select image: a fox in a forest");
    expect(cell.props.accessibilityState.selected).toBe(false);

    fireEvent.press(cell);
    const now = await findByLabelText("Deselect image: a fox in a forest");
    expect(now.props.accessibilityState.selected).toBe(true);
  });
});