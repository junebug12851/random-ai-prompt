/**
 * @file Component test for the mobile Manage screen — mounts the REAL <ManageScreen/> and asserts the
 * two-root overlay tree (Blocks + Lists), create/open/delete, and routing into the block + line editors.
 */
import React from "react";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";

jest.mock("../../lib/theme.js", () => ({
  useTheme: () => ({
    T: new Proxy({}, { get: (_t, k) => (typeof k === "string" && k.startsWith("radius") ? 12 : "#334") }),
  }),
}));

const tree = (entries = [], folders = []) => ({ name: "", path: "", folders, entries });
jest.mock("../../lib/storage.js", () => ({
  readUserList: jest.fn(async () => "red\nblue"),
  writeUserList: jest.fn(async () => {}),
  deleteUserList: jest.fn(async () => {}),
  writeUserBlock: jest.fn(async () => {}),
  deleteUserBlock: jest.fn(async () => {}),
  readUserTree: jest.fn(async () => ({ name: "", path: "", folders: [], entries: [] })),
  deleteUserFolder: jest.fn(async () => {}),
  // Block-editor deps (mocked so <ManageBlockEditor/> mounts when a block is opened).
  readUserBlock: jest.fn(async () => ""),
  readUserBlockJs: jest.fn(async () => null),
  writeUserBlockJs: jest.fn(async () => {}),
  readUserSidecar: jest.fn(async () => ({})),
  writeUserSidecar: jest.fn(async () => {}),
  moveUserEntry: jest.fn(async () => {}),
  storageAvailable: true,
}));

// overlay.js imports the engine (metroLoader), which isn't jest-resolvable; ManageScreen only calls
// refreshOverlay() as a side-effect after edits, so mock it.
jest.mock("../../lib/overlay.js", () => ({ refreshOverlay: jest.fn(async () => ({ lists: 0, blocks: 0 })) }));
// The block editor's InsertMenu pulls in the engine (expandOnce) via the module graph — stub it.
jest.mock("../../components/InsertMenu.js", () => () => {
  const { Text } = require("react-native");
  return <Text>INSERT_MENU</Text>;
});

import * as storage from "../../lib/storage.js";
import ManageScreen from "../ManageScreen.js";

const listEntry = (key) => ({ key, label: key.slice(key.lastIndexOf("/") + 1), kind: "list", hasJs: false });
const blockEntry = (key) => ({ key, label: key.slice(key.lastIndexOf("/") + 1), kind: "generator", hasJs: false });

async function setup({ lists = ["colors", "moods"], blocks = ["fox"] } = {}) {
  storage.readUserTree.mockImplementation(async (root) =>
    root === "blocks" ? tree(blocks.map(blockEntry)) : tree(lists.map(listEntry)),
  );
  const utils = render(<ManageScreen />);
  await act(async () => {});
  return utils;
}

describe("ManageScreen (mounted)", () => {
  it("renders both roots and their overlay entries", async () => {
    const { getByText, getByPlaceholderText } = await setup();
    expect(getByText("Blocks")).toBeTruthy();
    expect(getByText("Your custom lists")).toBeTruthy();
    expect(getByPlaceholderText("new block name")).toBeTruthy();
    expect(getByPlaceholderText("new list name")).toBeTruthy();
    await waitFor(() => expect(getByText("fox")).toBeTruthy());
    expect(getByText("colors")).toBeTruthy();
    expect(getByText("moods")).toBeTruthy();
  });

  it("shows empty states when a root has nothing", async () => {
    const { getByText } = await setup({ lists: [], blocks: [] });
    expect(getByText("No custom blocks yet — add one above.")).toBeTruthy();
    expect(getByText("No custom lists yet — add one above.")).toBeTruthy();
  });

  it("creating a list writes it and opens the line editor", async () => {
    const { getByPlaceholderText, getByText, findByText } = await setup();
    fireEvent.changeText(getByPlaceholderText("new list name"), "fresh");
    fireEvent.press(getByText("Add"));
    await waitFor(() => expect(storage.writeUserList).toHaveBeenCalledWith("fresh", ""));
    expect(await findByText("‹ Lists")).toBeTruthy();
  });

  it("creating a block writes a starter .dpl and opens the block editor", async () => {
    const { getByPlaceholderText, getByText, findByText } = await setup();
    fireEvent.changeText(getByPlaceholderText("new block name"), "myfox");
    fireEvent.press(getByText("New block"));
    await waitFor(() =>
      expect(storage.writeUserBlock).toHaveBeenCalledWith("myfox", expect.stringContaining("Start")),
    );
    expect(await findByText("‹ Blocks")).toBeTruthy();
  });

  it("a nested folder/name is sanitized and kept nested", async () => {
    const { getByPlaceholderText, getByText } = await setup();
    fireEvent.changeText(getByPlaceholderText("new block name"), "scene/My Dawn!");
    fireEvent.press(getByText("New block"));
    await waitFor(() =>
      expect(storage.writeUserBlock).toHaveBeenCalledWith("scene/MyDawn", expect.any(String)),
    );
  });

  it("opening a list entry shows the windowed line editor", async () => {
    const { getByText, findByText, getByPlaceholderText } = await setup();
    await waitFor(() => expect(getByText("colors")).toBeTruthy());
    fireEvent.press(getByText("colors"));
    expect(await findByText("‹ Lists")).toBeTruthy();
    expect(getByText("Save")).toBeTruthy();
    expect(getByText("+ Line")).toBeTruthy();
    await waitFor(() => expect(getByPlaceholderText("Filter 2 lines")).toBeTruthy());
  });

  it("the list editor loads its description and switches to a Raw view", async () => {
    storage.readUserSidecar.mockResolvedValueOnce({ description: "warm colors" });
    const { getByText, findByText, getByDisplayValue } = await setup();
    await waitFor(() => expect(getByText("colors")).toBeTruthy());
    fireEvent.press(getByText("colors"));
    expect(await findByText("Raw")).toBeTruthy();
    await waitFor(() => expect(getByDisplayValue("warm colors")).toBeTruthy());
    fireEvent.press(getByText("Raw"));
    await waitFor(() => expect(getByDisplayValue("red\nblue")).toBeTruthy());
  });

  it("deleting a list entry calls the storage delete", async () => {
    const { getAllByText, getByText } = await setup({ lists: ["colors"], blocks: [] });
    await waitFor(() => expect(getByText("colors")).toBeTruthy());
    fireEvent.press(getAllByText("✕")[0]);
    await waitFor(() => expect(storage.deleteUserList).toHaveBeenCalledWith("colors"));
  });

  it("renders a folder node with its nested entry and a folder delete", async () => {
    storage.readUserTree.mockImplementation(async (root) =>
      root === "blocks"
        ? tree([], [{ name: "scene", path: "scene", folders: [], entries: [blockEntry("scene/dawn")] }])
        : tree(),
    );
    const { getByText, getAllByText } = render(<ManageScreen />);
    await act(async () => {});
    await waitFor(() => expect(getByText("scene")).toBeTruthy());
    expect(getByText("dawn")).toBeTruthy(); // nested entry (depth<1 folders start expanded)
    expect(getAllByText("Delete").length).toBeGreaterThan(0); // folder delete affordance
  });
});
