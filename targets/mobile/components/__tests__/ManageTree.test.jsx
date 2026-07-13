/**
 * @file Component test for the Manage overlay tree — renders folders + entries, toggles a folder, and
 * fires open / delete / folder-delete callbacks.
 */
import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

jest.mock("../../lib/theme.js", () => ({
  useTheme: () => ({
    T: new Proxy({}, { get: (_t, k) => (typeof k === "string" && k.startsWith("radius") ? 12 : "#334") }),
  }),
}));

import ManageTree from "../ManageTree.js";

const entry = (key, kind = "generator", hasJs = false) => ({
  key,
  label: key.slice(key.lastIndexOf("/") + 1),
  kind,
  hasJs,
});
const treeWith = () => ({
  name: "",
  path: "",
  entries: [entry("fox")],
  folders: [{ name: "scene", path: "scene", folders: [], entries: [entry("scene/dawn")] }],
});

describe("ManageTree", () => {
  it("shows the empty text when there is nothing", () => {
    const { getByText } = render(
      <ManageTree tree={{ name: "", path: "", folders: [], entries: [] }} emptyText="nothing here" />,
    );
    expect(getByText("nothing here")).toBeTruthy();
  });

  it("renders top-level entries + a folder with its nested entry (open at depth 0)", () => {
    const { getByText } = render(<ManageTree tree={treeWith()} />);
    expect(getByText("fox")).toBeTruthy();
    expect(getByText("scene")).toBeTruthy();
    expect(getByText("dawn")).toBeTruthy();
  });

  it("fires onOpen / onDelete / onDeleteFolder", () => {
    const onOpen = jest.fn();
    const onDelete = jest.fn();
    const onDeleteFolder = jest.fn();
    const { getByText, getAllByText } = render(
      <ManageTree tree={treeWith()} onOpen={onOpen} onDelete={onDelete} onDeleteFolder={onDeleteFolder} />,
    );
    fireEvent.press(getByText("fox"));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ key: "fox" }));
    fireEvent.press(getAllByText("✕")[0]);
    expect(onDelete).toHaveBeenCalled();
    fireEvent.press(getByText("Delete"));
    expect(onDeleteFolder).toHaveBeenCalledWith("scene");
  });

  it("collapses a folder when its header is tapped", () => {
    const { getByText, queryByText } = render(<ManageTree tree={treeWith()} />);
    expect(getByText("dawn")).toBeTruthy();
    fireEvent.press(getByText("scene"));
    expect(queryByText("dawn")).toBeNull();
  });
});
