/**
 * @file Component + interaction tests for DplRefineBar — the Manage block-editor refine toolbar
 * (quick pills + the free-text Modify/Draft message box).
 */
import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "../testUtils.jsx";
import DplRefineBar from "../../frontend/components/DplRefineBar.jsx";

const noop = () => {};

describe("DplRefineBar", () => {
  it("renders the dimension groups, the pills, and the Modify/Draft message box", () => {
    render(<DplRefineBar onRefine={noop} onCreate={noop} onCustom={noop} />);
    expect(screen.getByRole("toolbar")).toBeInTheDocument();
    // Exact group-label text (regex would also match the "Add detail" / "More complex" button text).
    for (const label of ["Detail", "Complexity", "Focus", "Intensity", "Variety"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: /add detail/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /^modify$/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /draft new/i })).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("reports the picked refine action with its mode", async () => {
    const user = userEvent.setup();
    const onRefine = vi.fn();
    render(<DplRefineBar onRefine={onRefine} onCreate={noop} onCustom={noop} />);
    await user.click(screen.getByRole("button", { name: /crank/i }));
    expect(onRefine).toHaveBeenCalledTimes(1);
    expect(onRefine.mock.calls[0][0]).toMatchObject({ mode: "dpl-intensity-more" });
  });

  it("sends a typed change through onCustom in the default Modify mode", async () => {
    const user = userEvent.setup();
    const onCustom = vi.fn();
    render(<DplRefineBar onRefine={noop} onCreate={noop} onCustom={onCustom} />);
    await user.type(screen.getByRole("textbox"), "make the armor ornate");
    await user.click(screen.getByRole("button", { name: /^send$/i }));
    expect(onCustom).toHaveBeenCalledWith("make the armor ornate");
  });

  it("routes to onCreate after switching to Draft new", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    const onCustom = vi.fn();
    render(<DplRefineBar onRefine={noop} onCreate={onCreate} onCustom={onCustom} />);
    await user.click(screen.getByRole("tab", { name: /draft new/i }));
    await user.type(screen.getByRole("textbox"), "a lone fox in snow");
    await user.click(screen.getByRole("button", { name: /^draft$/i }));
    expect(onCreate).toHaveBeenCalledWith("a lone fox in snow");
    expect(onCustom).not.toHaveBeenCalled();
  });

  it("disables the submit until there is text", async () => {
    const user = userEvent.setup();
    const onCustom = vi.fn();
    render(<DplRefineBar onRefine={noop} onCreate={noop} onCustom={onCustom} />);
    expect(screen.getByRole("button", { name: /^send$/i })).toBeDisabled();
    await user.type(screen.getByRole("textbox"), "x");
    expect(screen.getByRole("button", { name: /^send$/i })).toBeEnabled();
  });

  it("disables every control while a refine is running", () => {
    render(<DplRefineBar busyMode="dpl-detail-more" onRefine={noop} onCreate={noop} onCustom={noop} />);
    expect(screen.getByRole("button", { name: /add detail/i })).toBeDisabled();
    expect(screen.getByRole("textbox")).toBeDisabled();
    expect(screen.getByText(/refining…/i)).toBeInTheDocument();
  });

  it("shows a Modifying… lead while a custom modify runs", () => {
    render(<DplRefineBar busyMode="dpl-custom" onRefine={noop} onCreate={noop} onCustom={noop} />);
    expect(screen.getByText(/modifying…/i)).toBeInTheDocument();
  });
});
