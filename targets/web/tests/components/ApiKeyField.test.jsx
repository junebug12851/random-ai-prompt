/**
 * @file Component + interaction tests for ApiKeyField — the per-provider BYOK key row
 * (renders only for key-needing providers; session entry + explicit save).
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "../testUtils.jsx";
import ApiKeyField from "../../frontend/components/ApiKeyField.jsx";
import { dialog } from "../../frontend/lib/dialog.js";

afterEach(() => vi.restoreAllMocks());

describe("ApiKeyField", () => {
  const keyInput = () => screen.getByPlaceholderText(/not saved/i);

  it("renders nothing for a local provider that needs no key", () => {
    render(<ApiKeyField settings={{ provider: "comfyui", keys: {} }} setSettings={() => {}} />);
    expect(screen.queryByPlaceholderText(/not saved/i)).not.toBeInTheDocument();
  });

  it("renders nothing for the 'none' provider", () => {
    render(<ApiKeyField settings={{ keys: {} }} setSettings={() => {}} providerId="none" />);
    expect(screen.queryByPlaceholderText(/not saved/i)).not.toBeInTheDocument();
  });

  it("renders a key field + get-a-key link for a BYOK provider", () => {
    render(<ApiKeyField settings={{ provider: "openai", keys: {} }} setSettings={() => {}} />);
    expect(keyInput()).toBeInTheDocument();
    expect(screen.getByText(/get a key/i)).toBeInTheDocument();
  });

  it("enables Save once a key is typed and persists it on confirm", async () => {
    const user = userEvent.setup();
    vi.spyOn(dialog, "confirm").mockResolvedValue(true);
    const setSettings = vi.fn();
    render(<ApiKeyField settings={{ provider: "openai", keys: {} }} setSettings={setSettings} />);

    const save = screen.getByRole("button", { name: /save api key/i });
    expect(save).toBeDisabled();

    await user.type(keyInput(), "sk-test");
    expect(save).toBeEnabled();

    await user.click(save);
    await waitFor(() => expect(setSettings).toHaveBeenCalled());
    const updater = setSettings.mock.calls[0][0];
    expect(updater({ keys: {} })).toEqual({ keys: { openai: "sk-test" } });
  });

  it("does not persist when the save confirm is declined", async () => {
    const user = userEvent.setup();
    vi.spyOn(dialog, "confirm").mockResolvedValue(false);
    const setSettings = vi.fn();
    render(<ApiKeyField settings={{ provider: "openai", keys: {} }} setSettings={setSettings} />);
    await user.type(keyInput(), "sk-test");
    await user.click(screen.getByRole("button", { name: /save api key/i }));
    await Promise.resolve();
    expect(setSettings).not.toHaveBeenCalled();
  });
});
