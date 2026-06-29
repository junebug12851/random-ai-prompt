/**
 * @file Component + interaction tests for ProviderPicker — grouped dropdown, selection,
 * key badge, and the online-locked option behaviour.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "../testUtils.jsx";
import ProviderPicker from "../../src/components/ProviderPicker.jsx";

afterEach(() => vi.restoreAllMocks());

const groups = [
  {
    title: "Local",
    items: [
      { id: "comfyui", label: "ComfyUI", description: "Local node graph" },
      { id: "openai", label: "OpenAI", needsKey: true, description: "Hosted, BYOK" },
      { id: "locked", label: "Locked One", locked: true },
    ],
  },
];

describe("ProviderPicker", () => {
  it("shows the current selection's label on the trigger", () => {
    render(<ProviderPicker label="Image" value="comfyui" groups={groups} onPick={() => {}} />);
    expect(screen.getByText("ComfyUI")).toBeInTheDocument();
  });

  it("opens the list and picks an option", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<ProviderPicker label="Image" value="comfyui" groups={groups} onPick={onPick} />);
    await user.click(screen.getByRole("button")); // the trigger is the only button until the list opens
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await user.click(screen.getByText("OpenAI"));
    expect(onPick).toHaveBeenCalledWith("openai");
  });

  it("marks BYOK options with a key badge", async () => {
    const user = userEvent.setup();
    render(<ProviderPicker label="Image" value="comfyui" groups={groups} onPick={() => {}} />);
    await user.click(screen.getByRole("button")); // the trigger is the only button until the list opens
    expect(screen.getByText(/^key$/i)).toBeInTheDocument();
  });

  it("a locked option opens the full version instead of selecting", async () => {
    const user = userEvent.setup();
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const onPick = vi.fn();
    render(<ProviderPicker label="Image" value="comfyui" groups={groups} onPick={onPick} />);
    await user.click(screen.getByRole("button")); // the trigger is the only button until the list opens
    await user.click(screen.getByText("Locked One"));
    expect(open).toHaveBeenCalled();
    expect(onPick).not.toHaveBeenCalled();
  });
});
