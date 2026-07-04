/**
 * @file Component tests for the Settings gear's Seed group: the Random toggle, the seed box's
 * read-only-when-random behaviour, free-text entry when pinned, and the contextual hint.
 */
import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "../testUtils.jsx";
import Settings from "../../src/components/Settings.jsx";

const randomOn = { randomSeed: true, promptSeed: "abc123" };
const pinned = { randomSeed: false, promptSeed: "my seed 42" };

describe("Settings — Seed group", () => {
  it("Random on: toggle checked, seed box read-only and showing the seed, random hint", () => {
    render(<Settings settings={randomOn} setSettings={() => {}} />);
    const toggle = screen.getByRole("checkbox", { name: /random seed/i });
    expect(toggle).toBeChecked();
    const box = screen.getByLabelText("Seed");
    expect(box).toHaveValue("abc123");
    expect(box).toHaveAttribute("readonly");
    expect(box).toHaveClass("is-locked");
    expect(screen.getByText(/fresh random seed each roll/i)).toBeInTheDocument();
  });

  it("Random off: seed box is editable, pinned hint shown", () => {
    render(<Settings settings={pinned} setSettings={() => {}} />);
    const box = screen.getByLabelText("Seed");
    expect(box).toHaveValue("my seed 42");
    expect(box).not.toHaveAttribute("readonly");
    expect(box).not.toHaveClass("is-locked");
    expect(screen.getByText(/pinned/i)).toBeInTheDocument();
  });

  it("toggling Random off updates settings.randomSeed", async () => {
    const user = userEvent.setup();
    const setSettings = vi.fn();
    render(<Settings settings={randomOn} setSettings={setSettings} />);
    await user.click(screen.getByRole("checkbox", { name: /random seed/i }));
    expect(setSettings).toHaveBeenCalledWith(expect.objectContaining({ randomSeed: false }));
  });

  it("typing in the seed box (when pinned) updates settings.promptSeed with free text", async () => {
    const user = userEvent.setup();
    const setSettings = vi.fn();
    render(<Settings settings={{ randomSeed: false, promptSeed: "" }} setSettings={setSettings} />);
    await user.type(screen.getByLabelText("Seed"), "x");
    expect(setSettings).toHaveBeenLastCalledWith(expect.objectContaining({ promptSeed: "x" }));
  });
});
