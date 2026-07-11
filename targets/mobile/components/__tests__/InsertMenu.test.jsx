/**
 * @file Component test for the DPL InsertMenu — the "Insert ▾" bottom sheet that drills categories →
 * constructs and inserts a materialized snippet. Real DPL_INSERTS data; only theme + engine mocked.
 */
import React from "react";
import { render, fireEvent, act } from "@testing-library/react-native";

jest.mock("../../lib/theme.js", () => ({
  useTheme: () => ({ T: new Proxy({}, { get: (_t, k) => (typeof k === "string" && k.startsWith("radius") ? 12 : "#334") }) }),
}));
jest.mock("../../lib/engine.js", () => ({ expandOnce: jest.fn(() => "an example") }));

import { DPL_INSERTS } from "../../lib/dplInserts.js";
import InsertMenu from "../InsertMenu.js";

describe("InsertMenu (mounted)", () => {
  it("opens, drills into a category, and inserts a construct", async () => {
    const onInsert = jest.fn();
    const { getByText, findByText } = render(<InsertMenu onInsert={onInsert} />);
    await act(async () => {});
    expect(getByText("Insert")).toBeTruthy();
    fireEvent.press(getByText("Insert"));
    expect(await findByText("Insert DPL syntax")).toBeTruthy();
    const cat = DPL_INSERTS[0];
    expect(getByText(cat.label)).toBeTruthy();
    fireEvent.press(getByText(cat.label));
    const item = cat.items[0];
    expect(await findByText(item.label)).toBeTruthy();
    fireEvent.press(getByText(item.label));
    expect(onInsert).toHaveBeenCalled();
  });
});