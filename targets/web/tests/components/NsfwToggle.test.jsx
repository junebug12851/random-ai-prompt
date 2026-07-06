/**
 * @file Component + interaction tests for NsfwToggle — the confirm-on-enable gate,
 * immediate disable, and the online-locked behaviour.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "../testUtils.jsx";
import NsfwToggle from "../../frontend/components/NsfwToggle.jsx";

afterEach(() => vi.restoreAllMocks());

describe("NsfwToggle", () => {
  it("renders an off switch when adult is disabled", () => {
    render(<NsfwToggle settings={{ includeAdult: false }} setSettings={() => {}} />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  });

  it("asks for confirmation before enabling, then sets includeAdult on confirm", async () => {
    const user = userEvent.setup();
    const setSettings = vi.fn();
    render(<NsfwToggle settings={{ includeAdult: false }} setSettings={setSettings} />);

    await user.click(screen.getByRole("switch"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(setSettings).not.toHaveBeenCalled(); // not yet — only on confirm

    await user.click(screen.getByRole("button", { name: /enable nsfw/i }));
    const updater = setSettings.mock.calls[0][0];
    expect(updater({ includeAdult: false })).toEqual({ includeAdult: true });
  });

  it("cancel closes the dialog without enabling", async () => {
    const user = userEvent.setup();
    const setSettings = vi.fn();
    render(<NsfwToggle settings={{ includeAdult: false }} setSettings={setSettings} />);
    await user.click(screen.getByRole("switch"));
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(setSettings).not.toHaveBeenCalled();
  });

  it("disables immediately (no dialog) when already on", async () => {
    const user = userEvent.setup();
    const setSettings = vi.fn();
    render(<NsfwToggle settings={{ includeAdult: true }} setSettings={setSettings} />);
    await user.click(screen.getByRole("switch"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(setSettings.mock.calls[0][0]({ includeAdult: true })).toEqual({ includeAdult: false });
  });

  it("Escape cancels the confirm dialog", async () => {
    const user = userEvent.setup();
    render(<NsfwToggle settings={{ includeAdult: false }} setSettings={vi.fn()} />);
    await user.click(screen.getByRole("switch"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("when locked: is aria-disabled and clicking opens the full version (no settings change)", async () => {
    const user = userEvent.setup();
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const setSettings = vi.fn();
    render(<NsfwToggle settings={{ includeAdult: false }} setSettings={setSettings} locked />);
    const sw = screen.getByRole("switch");
    expect(sw).toHaveAttribute("aria-disabled", "true");
    await user.click(sw);
    expect(open).toHaveBeenCalled();
    expect(setSettings).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
