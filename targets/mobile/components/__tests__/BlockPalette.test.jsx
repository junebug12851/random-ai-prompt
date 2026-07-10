/**
 * @file Component test for the BlockPalette bottom-sheet — search + Blocks/Lists groups + chip cloud
 * that inserts {#name}/{name} tokens. The block catalog + folders are mocked to a small fixture so the
 * test drives the palette's own filter/select logic (catalog parity is covered separately).
 */
import React from "react";
import { render, fireEvent, act } from "@testing-library/react-native";

jest.mock("../../lib/theme.js", () => ({
  useTheme: () => ({ T: new Proxy({}, { get: (_t, k) => (typeof k === "string" && k.startsWith("radius") ? 12 : "#334") }) }),
}));
jest.mock("../../lib/blockCatalog.js", () => ({
  getBlocks: jest.fn(() => [
    { title: "Blocks", hint: "generators", items: [{ token: "{#fox}", label: "fox" }, { token: "{#cat}", label: "cat" }] },
    { title: "Lists", hint: "word lists", items: [{ token: "{colors}", label: "colors" }] },
  ]),
}));
jest.mock("../../lib/blockCategories.js", () => ({ foldersOf: jest.fn(() => []) }));

import BlockPalette from "../BlockPalette.js";

async function setup() {
  const onInsert = jest.fn(), onClose = jest.fn();
  const utils = render(<BlockPalette visible onClose={onClose} onInsert={onInsert} />);
  await act(async () => {});
  return { ...utils, onInsert, onClose };
}

describe("BlockPalette (mounted)", () => {
  it("renders the sheet, search, groups, and chips; inserts a token", async () => {
    const { getByText, getByPlaceholderText, onInsert } = await setup();
    expect(getByText("Building blocks")).toBeTruthy();
    expect(getByPlaceholderText("Search blocks…")).toBeTruthy();
    expect(getByText("Blocks")).toBeTruthy();
    expect(getByText("Lists")).toBeTruthy();
    expect(getByText("fox")).toBeTruthy();
    fireEvent.press(getByText("fox"));
    expect(onInsert).toHaveBeenCalledWith("{#fox}");
  });

  it("search filters the chip cloud", async () => {
    const { getByPlaceholderText, getByText, queryByText, findByText } = await setup();
    fireEvent.changeText(getByPlaceholderText("Search blocks…"), "cat");
    expect(await findByText("cat")).toBeTruthy();
    expect(queryByText("fox")).toBeNull();
  });

  it("shows a no-match state", async () => {
    const { getByPlaceholderText, findByText } = await setup();
    fireEvent.changeText(getByPlaceholderText("Search blocks…"), "zzzznope");
    expect(await findByText(/No building blocks match/)).toBeTruthy();
  });
});