/**
 * @file Component test for the mobile Manage block editor — mounts <ManageBlockEditor/>, asserts it
 * loads the generator's DPL/sidecar, edits + saves, offers a JS sidecar, and deletes.
 */
import React from "react";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";

jest.mock("../../lib/theme.js", () => ({
  useTheme: () => ({
    T: new Proxy({}, { get: (_t, k) => (typeof k === "string" && k.startsWith("radius") ? 12 : "#334") }),
    rewriteProvider: "openai",
    providerSettings: {},
    backendUrl: "",
  }),
}));
const mockRewrite = jest.fn(async () => ({ text: "Start\n===\n{color}\n- refined" }));
jest.mock("../../lib/imageProviders.js", () => ({
  getTextProvider: jest.fn(() => ({ label: "OpenAI", rewrite: mockRewrite })),
  systemFor: jest.fn((m) => `SYS:${m}`),
  cleanDplOutput: jest.fn((s) => (s || "").trim()),
}));
jest.mock("../../lib/keys.js", () => ({ getKey: jest.fn(async () => "sk-test") }));
// Readiness hook: default = ready. Locked-state tests override it.
jest.mock("../../lib/useProviderReady.js", () => ({
  useTextReady: jest.fn(() => ({ picked: true, keyed: true, ready: true, reason: "" })),
}));
import { useTextReady } from "../../lib/useProviderReady.js";
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

beforeEach(() => {
  mockRewrite.mockClear();
  // Default: Text provider picked + keyed → AI controls unlocked.
  useTextReady.mockReturnValue({ picked: true, keyed: true, ready: true, reason: "" });
});

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

  it("Refine (+ on a dimension) calls the provider with the DPL mode and replaces the source", async () => {
    const { getAllByText, getByDisplayValue, findByText } = await setup();
    await findByText("REFINE");
    fireEvent.press(getAllByText("+")[0]); // Detail +
    await waitFor(() =>
      expect(mockRewrite).toHaveBeenCalledWith(expect.objectContaining({ mode: "dpl-detail-more" })),
    );
    await waitFor(() => expect(getByDisplayValue("Start\n===\n{color}\n- refined")).toBeTruthy());
  });

  it("Draft opens an input and runs dpl-create with the typed description", async () => {
    const { getByText, getByPlaceholderText, findByText } = await setup();
    await findByText("REFINE");
    fireEvent.press(getByText("Draft"));
    fireEvent.changeText(getByPlaceholderText("Describe the block to draft…"), "a neon fox");
    fireEvent.press(getByText("Send"));
    await waitFor(() =>
      expect(mockRewrite).toHaveBeenCalledWith(expect.objectContaining({ mode: "dpl-create", prompt: "a neon fox" })),
    );
  });

  // --- LOCKED states (web parity: lock the control, never error on press) -----------------------
  it("locks Refine/Cleanup/Modify/Draft when no Text provider is picked — and pressing does NOTHING", async () => {
    useTextReady.mockReturnValue({
      picked: false,
      keyed: false,
      ready: false,
      reason: "Pick a Text provider in the ⋯ menu to unlock.",
    });
    const { getAllByText, getByText, getByLabelText, findByText, queryByText } = await setup();
    await findByText("REFINE 🔒");
    // The lock reason is shown instead of an error-on-press.
    expect(getByText("Pick a Text provider in the ⋯ menu to unlock.")).toBeTruthy();

    // The controls are ACTUALLY DISABLED (the locked UI state), not merely no-ops.
    for (const label of ["Cleanup (locked)", "Modify (locked)", "Draft (locked)", "Detail more (locked)"]) {
      expect(getByLabelText(label).props.accessibilityState.disabled).toBe(true);
    }

    // Pressing a locked control must NOT call the provider.
    fireEvent.press(getAllByText("+")[0]);
    fireEvent.press(getByText("Cleanup"));
    fireEvent.press(getByText("Draft"));
    await act(async () => {});
    expect(mockRewrite).not.toHaveBeenCalled();
    // …and there is NO "pick a provider" ERROR message anywhere (web parity: lock, don't error).
    expect(queryByText(/Pick a Text provider in the ⋯ menu\.$/)).toBeNull();
  });

  it("locks the AI controls when the provider is picked but NOT keyed", async () => {
    useTextReady.mockReturnValue({
      picked: true,
      keyed: false,
      ready: false,
      reason: "Add your API key in the ⋯ menu to unlock.",
    });
    const { getByText, getAllByText, getByLabelText, findByText } = await setup();
    await findByText("REFINE 🔒");
    expect(getByText("Add your API key in the ⋯ menu to unlock.")).toBeTruthy();
    expect(getByLabelText("Cleanup (locked)").props.accessibilityState.disabled).toBe(true);
    fireEvent.press(getAllByText("+")[0]);
    await act(async () => {});
    expect(mockRewrite).not.toHaveBeenCalled();
  });

  it("delete removes the generator and closes", async () => {
    const { getByText, onClose } = await setup();
    fireEvent.press(getByText("Delete"));
    await waitFor(() => expect(storage.deleteUserBlock).toHaveBeenCalledWith("fox"));
    expect(onClose).toHaveBeenCalledWith(true);
  });
});
