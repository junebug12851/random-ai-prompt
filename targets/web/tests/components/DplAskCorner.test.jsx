/**
 * @file Component + interaction tests for DplAskCorner — the corner Modify/Draft free-text control.
 */
import { describe, it, expect, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "../testUtils.jsx";
import DplAskCorner from "../../frontend/components/DplAskCorner.jsx";

const noop = () => {};

describe("DplAskCorner", () => {
  it("renders the Modify + Draft combo with no popover until opened", () => {
    render(<DplAskCorner onCreate={noop} onCustom={noop} />);
    expect(screen.getByRole("button", { name: /^modify$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^draft$/i })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the Modify popover and sends the typed change via onCustom", async () => {
    const user = userEvent.setup();
    const onCustom = vi.fn();
    render(<DplAskCorner onCreate={noop} onCustom={onCustom} />);
    await user.click(screen.getByRole("button", { name: /^modify$/i }));
    expect(screen.getByRole("dialog", { name: /modify this template/i })).toBeInTheDocument();
    await user.type(screen.getByRole("textbox"), "make the armor ornate");
    await user.click(screen.getByRole("button", { name: /^send$/i }));
    expect(onCustom).toHaveBeenCalledWith("make the armor ornate");
  });

  it("opens the Draft popover and routes to onCreate", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    const onCustom = vi.fn();
    render(<DplAskCorner onCreate={onCreate} onCustom={onCustom} />);
    await user.click(screen.getByRole("button", { name: /^draft$/i }));
    const dialog = screen.getByRole("dialog", { name: /draft a new template/i });
    await user.type(within(dialog).getByRole("textbox"), "a lone fox in snow");
    // Two "Draft" buttons exist (the segment + the submit); target the submit inside the dialog.
    await user.click(within(dialog).getByRole("button", { name: /^draft$/i }));
    expect(onCreate).toHaveBeenCalledWith("a lone fox in snow");
    expect(onCustom).not.toHaveBeenCalled();
  });

  it("keeps the submit disabled until there is text", async () => {
    const user = userEvent.setup();
    render(<DplAskCorner onCreate={noop} onCustom={noop} />);
    await user.click(screen.getByRole("button", { name: /^modify$/i }));
    expect(screen.getByRole("button", { name: /^send$/i })).toBeDisabled();
    await user.type(screen.getByRole("textbox"), "x");
    expect(screen.getByRole("button", { name: /^send$/i })).toBeEnabled();
  });

  it("disables the combo while a request runs", () => {
    render(<DplAskCorner busyMode="dpl-custom" onCreate={noop} onCustom={noop} />);
    expect(screen.getByRole("button", { name: /^modify$/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^draft$/i })).toBeDisabled();
  });
});
