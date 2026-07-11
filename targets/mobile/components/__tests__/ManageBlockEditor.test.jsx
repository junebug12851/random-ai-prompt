/**
 * @file Component test for the mobile Manage block editor — mounts <ManageBlockEditor/>, asserts it
 * loads the generator's DPL/sidecar, edits + saves, offers a JS sidecar, and deletes.
 */
import React from "react";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";

jest.mock("../../lib/theme.js", () => ({
  useTheme: () => ({
    T: new Proxy({}, { get: (_t, k) => (typeof k === "string" && k.startsWith("radius") ? 12 : "#334") }),
  }),
}));
// InsertMenu pulls in the engine (expandOnce) which isn't jest-resolvable; stub it to a marker.
jest.mock("../InsertMenu.js", () => () => {
  const { Text } = require("react-native");
  return <Text>INSERT_MENU</Text>;
});
jest.mock("../../lib/storage.js", () => ({
  readUserBlock: jest.fn(async () => "Start\n===\n{color}"),
  writeUserBlock: jest.fn(async () => {}),
  deleteUserBlock: jest.fn(async () => {}),
  readUserBlockJs: jest.fn(async () => null),
  writeUserBlockJs: jest.fn(async () => {}),
  readUserSidecar: jest.fn(async () => ({ description: "a fox" })),
  writeUserSidecar: jest.fn(async () => {}),
  moveUserEntry: jest.fn(async () => {}),
}));

import * as storage from "../../lib/storage.js";
import ManageBlockEditor from "../ManageBlockEditor.js";

async function setup(props = {}) {
  const onClose = jest.fn();
  const utils = render(<ManageBlockEditor blockKey="fox" onClose={onClose} {...props} />);
  await act(async () => {});
  return { onClose, ...utils };
}

describe("ManageBlockEditor", () => {
  it("loads the generator name, description, and DPL source", async () => {
    const { getByDisplayValue } = await setup();
    await waitFor(() => expect(getByDisplayValue("fox")).toBeTruthy());
    expect(getByDisplayValue("a fox")).toBeTruthy();
    expect(getByDisplayValue("Start\n===\n{color}")).toBeTruthy();
  });

  it("saves the DPL + sidecar and closes with changed=true", async () => {
    const { getByText, onClose } = await setup();
    fireEvent.press(getByText("Save"));
    await waitFor(() => expect(storage.writeUserBlock).toHaveBeenCalledWith("fox", expect.stringContaining("{color}")));
    expect(storage.writeUserSidecar).toHaveBeenCalledWith("blocks", "fox", expect.objectContaining({ description: "a fox" }));
    expect(onClose).toHaveBeenCalledWith(true);
  });

  it("creating a JS sidecar switches to the JS tab", async () => {
    const { getByText } = await setup();
    fireEvent.press(getByText("+ Create JS sidecar"));
    await waitFor(() => expect(getByText("JS sidecar")).toBeTruthy());
  });

  it("delete removes the generator and closes", async () => {
    const { getByText, onClose } = await setup();
    fireEvent.press(getByText("Delete"));
    await waitFor(() => expect(storage.deleteUserBlock).toHaveBeenCalledWith("fox"));
    expect(onClose).toHaveBeenCalledWith(true);
  });
});
