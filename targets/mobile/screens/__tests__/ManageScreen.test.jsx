/**
 * @file Component test for the mobile Manage screen — mounts the REAL <ManageScreen/> and asserts the
 * custom-lists master view (create / open / delete) and the windowed line editor detail view.
 */
import React from "react";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";

jest.mock("../../lib/theme.js", () => ({
  useTheme: () => ({
    T: new Proxy({}, { get: (_t, k) => (typeof k === "string" && k.startsWith("radius") ? 12 : "#334") }),
  }),
}));
jest.mock("../../lib/storage.js", () => ({
  listUserLists: jest.fn(async () => []),
  readUserList: jest.fn(async () => ""),
  writeUserList: jest.fn(async () => {}),
  deleteUserList: jest.fn(async () => {}),
  storageAvailable: true,
}));

import * as storage from "../../lib/storage.js";
import ManageScreen from "../ManageScreen.js";

async function setup(lists = ["colors", "moods"]) {
  storage.listUserLists.mockResolvedValue(lists);
  storage.readUserList.mockResolvedValue("red\nblue");
  const utils = render(<ManageScreen />);
  await act(async () => {});
  return utils;
}

describe("ManageScreen (mounted)", () => {
  it("renders the lists master view", async () => {
    const { getByText, getByPlaceholderText } = await setup();
    expect(getByText("Your custom lists")).toBeTruthy();
    expect(getByPlaceholderText("new list name")).toBeTruthy();
    expect(getByText("Add")).toBeTruthy();
    await waitFor(() => expect(getByText("colors")).toBeTruthy());
    expect(getByText("moods")).toBeTruthy();
  });

  it("shows the empty state with no lists", async () => {
    const { getByText } = await setup([]);
    expect(getByText("No custom lists yet — add one above.")).toBeTruthy();
  });

  it("creating a list writes it and opens the editor", async () => {
    const { getByPlaceholderText, getByText, findByText } = await setup();
    fireEvent.changeText(getByPlaceholderText("new list name"), "fresh");
    fireEvent.press(getByText("Add"));
    await waitFor(() => expect(storage.writeUserList).toHaveBeenCalledWith("fresh", ""));
    expect(await findByText("‹ Lists")).toBeTruthy();
  });

  it("opening a list shows the windowed editor", async () => {
    const { getByText, findByText, getByPlaceholderText } = await setup();
    await waitFor(() => expect(getByText("colors")).toBeTruthy());
    fireEvent.press(getByText("colors"));
    expect(await findByText("‹ Lists")).toBeTruthy();
    expect(getByText("Save")).toBeTruthy();
    expect(getByText("+ Line")).toBeTruthy();
    await waitFor(() => expect(getByPlaceholderText("Filter 2 lines")).toBeTruthy());
  });

  it("deleting a list calls the storage delete", async () => {
    const { getAllByText, getByText } = await setup();
    await waitFor(() => expect(getByText("colors")).toBeTruthy());
    fireEvent.press(getAllByText("Delete")[0]);
    await waitFor(() => expect(storage.deleteUserList).toHaveBeenCalledWith("colors"));
  });
});