/**
 * @file Component test for the app shell (App.js) — the phone header: brand mark, the enclosed
 * pill tab switch (Generate / Gallery / Single / Manage), and the ⋯ overflow. Screens + overflow
 * menu are mocked to markers so the test focuses on the shell composition + wiring.
 */
import React from "react";
import { render, fireEvent, act } from "@testing-library/react-native";

jest.mock("../lib/theme.js", () => ({
  ThemeProvider: ({ children }) => children,
  useTheme: () => ({
    T: new Proxy({}, { get: (_t, k) => (typeof k === "string" && k.startsWith("radius") ? 12 : "#334") }),
    resolved: "dark",
  }),
}));
// Capture the props App hands each screen, so a silently-dropped callback (e.g. onOpenImage) fails here.
const mockScreenProps = {};
jest.mock("../screens/GenerateScreen.js", () => (props) => {
  const { Text } = require("react-native");
  mockScreenProps.generate = props;
  return <Text>GEN_PANE</Text>;
});
jest.mock("../screens/GalleryScreen.js", () => () => { const { Text } = require("react-native"); return <Text>GAL_PANE</Text>; });
jest.mock("../screens/SingleScreen.js", () => () => { const { Text } = require("react-native"); return <Text>SINGLE_PANE</Text>; });
jest.mock("../screens/ManageScreen.js", () => () => { const { Text } = require("react-native"); return <Text>MANAGE_PANE</Text>; });
jest.mock("../components/OverflowMenu.js", () => ({ visible }) => {
  const { Text } = require("react-native");
  return visible ? <Text>OVERFLOW_OPEN</Text> : null;
});
// overlay.js pulls in the engine (metroLoader) which isn't jest-resolvable; the shell only calls
// refreshOverlay() as a startup side-effect, so mock it away.
jest.mock("../lib/overlay.js", () => ({ refreshOverlay: jest.fn(async () => ({ lists: 0, blocks: 0 })) }));

import App from "../App.js";

async function setup() {
  const utils = render(<App />);
  await act(async () => {});
  return utils;
}

describe("App shell (mounted)", () => {
  it("renders the four tab labels and the active pane", async () => {
    const { getByText } = await setup();
    ["Generate", "Gallery", "Single", "Manage"].forEach((t) => expect(getByText(t)).toBeTruthy());
    expect(getByText("GEN_PANE")).toBeTruthy();
  });

  it("the ⋯ overflow opens the menu", async () => {
    const { getByLabelText, findByText } = await setup();
    fireEvent.press(getByLabelText("More options"));
    expect(await findByText("OVERFLOW_OPEN")).toBeTruthy();
  });

  it("switching tabs does not crash", async () => {
    const { getByText } = await setup();
    fireEvent.press(getByText("Gallery"));
    fireEvent.press(getByText("Manage"));
    expect(getByText("Generate")).toBeTruthy();
  });

  // Regression: App passed `onOpenImage` to GenerateScreen but the screen never destructured it, so
  // generated thumbs were dead. Guard BOTH ends — here that App still hands the callback down.
  it("hands GenerateScreen the callbacks it needs (onOpenImage / onGenerated)", async () => {
    await setup();
    expect(typeof mockScreenProps.generate.onOpenImage).toBe("function");
    expect(typeof mockScreenProps.generate.onGenerated).toBe("function");
  });
});