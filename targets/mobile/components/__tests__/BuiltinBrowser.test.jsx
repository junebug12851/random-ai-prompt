/**
 * @file Component test for the built-in catalog browser — searches the (virtual-mocked) engine catalog
 * and fires onOverride with the entry's source. The engine module isn't jest-resolvable, so it's mocked.
 */
import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

jest.mock("../../lib/theme.js", () => ({
  useTheme: () => ({
    T: new Proxy({}, { get: (_t, k) => (typeof k === "string" && k.startsWith("radius") ? 12 : "#334") }),
  }),
}));
jest.mock(
  "engine/core/metroLoader.js",
  () => ({
    metroLoader: {
      blockNames: () => ["fox", "scene/castle"],
      listNames: () => ["colors", "artists"],
      readBlockSource: (k) => `SRC:${k}`,
      readListLines: (k) => (k === "colors" ? ["red", "blue"] : ["x"]),
    },
  }),
  { virtual: true },
);

import BuiltinBrowser from "../BuiltinBrowser.js";

describe("BuiltinBrowser", () => {
  it("shows nothing until a search, then the matching entries", () => {
    const { getByPlaceholderText, queryByText, getByText } = render(<BuiltinBrowser onOverride={jest.fn()} />);
    expect(queryByText("fox")).toBeNull(); // gated until searched
    fireEvent.changeText(getByPlaceholderText(/Search the built-in catalog/), "co");
    expect(getByText("colors")).toBeTruthy(); // list match
    expect(queryByText("fox")).toBeNull(); // "co" doesn't match this block
  });

  it("Override on a block fires onOverride with its source", () => {
    const onOverride = jest.fn();
    const { getByPlaceholderText, getAllByText } = render(<BuiltinBrowser onOverride={onOverride} />);
    fireEvent.changeText(getByPlaceholderText(/Search the built-in catalog/), "fox");
    fireEvent.press(getAllByText("Override")[0]);
    expect(onOverride).toHaveBeenCalledWith("block", "fox", "SRC:fox");
  });

  it("Override on a list copies its joined lines", () => {
    const onOverride = jest.fn();
    const { getByPlaceholderText, getAllByText } = render(<BuiltinBrowser onOverride={onOverride} />);
    fireEvent.changeText(getByPlaceholderText(/Search the built-in catalog/), "colors");
    fireEvent.press(getAllByText("Override")[0]);
    expect(onOverride).toHaveBeenCalledWith("list", "colors", "red\nblue");
  });
});
