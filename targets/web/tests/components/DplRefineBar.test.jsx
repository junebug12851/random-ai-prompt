/**
 * @file Component + interaction tests for DplRefineBar — the Manage block-editor refine toolbar.
 */
import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "../testUtils.jsx";
import DplRefineBar from "../../frontend/components/DplRefineBar.jsx";

describe("DplRefineBar", () => {
  it("renders the dimension groups and the draft-from-description control", () => {
    render(<DplRefineBar onRefine={vi.fn()} onCreate={vi.fn()} />);
    expect(screen.getByRole("toolbar")).toBeInTheDocument();
    // Exact group-label text (regex would also match the "Add detail" / "More complex" button text).
    for (const label of ["Detail", "Complexity", "Focus", "Intensity", "Variety"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: /add detail/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /trim detail/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /draft from description/i })).toBeInTheDocument();
  });

  it("reports the picked refine action with its mode", async () => {
    const user = userEvent.setup();
    const onRefine = vi.fn();
    render(<DplRefineBar onRefine={onRefine} onCreate={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /crank/i }));
    expect(onRefine).toHaveBeenCalledTimes(1);
    expect(onRefine.mock.calls[0][0]).toMatchObject({ mode: "dpl-intensity-more" });
  });

  it("opens the description box and submits the typed text", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    render(<DplRefineBar onRefine={vi.fn()} onCreate={onCreate} />);

    await user.click(screen.getByRole("button", { name: /draft from description/i }));
    const box = screen.getByRole("textbox");
    await user.type(box, "a lone fox in snow");
    await user.click(screen.getByRole("button", { name: /^draft$/i }));

    expect(onCreate).toHaveBeenCalledWith("a lone fox in snow");
  });

  it("does not submit an empty description", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    render(<DplRefineBar onRefine={vi.fn()} onCreate={onCreate} />);
    await user.click(screen.getByRole("button", { name: /draft from description/i }));
    // The Draft submit is disabled until there's text.
    expect(screen.getByRole("button", { name: /^draft$/i })).toBeDisabled();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("disables every control while a refine is running", () => {
    render(<DplRefineBar busyMode="dpl-detail-more" onRefine={vi.fn()} onCreate={vi.fn()} />);
    expect(screen.getByRole("button", { name: /add detail/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /trim detail/i })).toBeDisabled();
    // The lead flips to a working label.
    expect(screen.getByText(/refining…/i)).toBeInTheDocument();
  });
});
