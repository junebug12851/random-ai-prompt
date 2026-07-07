/**
 * @file Component + interaction tests for DplRefineBar — the Manage block-editor refine toolbar
 * (stepper combos per dimension + a lone Cleanup pill).
 */
import { describe, it, expect, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "../testUtils.jsx";
import DplRefineBar from "../../frontend/components/DplRefineBar.jsx";

describe("DplRefineBar", () => {
  it("renders a stepper combo per dimension plus a Cleanup pill", () => {
    render(<DplRefineBar onRefine={vi.fn()} />);
    expect(screen.getByRole("toolbar")).toBeInTheDocument();
    for (const label of ["Detail", "Complexity", "Focus", "Intensity", "Variety"]) {
      const combo = screen.getByRole("group", { name: label });
      // Each combo has exactly two step buttons (− and +).
      expect(within(combo).getAllByRole("button")).toHaveLength(2);
    }
    expect(screen.getByRole("button", { name: /cleanup/i })).toBeInTheDocument();
  });

  it("fires the + step with the 'more' mode", async () => {
    const user = userEvent.setup();
    const onRefine = vi.fn();
    render(<DplRefineBar onRefine={onRefine} />);
    // The + on Intensity carries the 'Crank' aria-label.
    await user.click(screen.getByRole("button", { name: /crank/i }));
    expect(onRefine.mock.calls[0][0]).toMatchObject({ mode: "dpl-intensity-more" });
  });

  it("fires the − step with the 'less' mode", async () => {
    const user = userEvent.setup();
    const onRefine = vi.fn();
    render(<DplRefineBar onRefine={onRefine} />);
    await user.click(screen.getByRole("button", { name: /trim detail/i }));
    expect(onRefine.mock.calls[0][0]).toMatchObject({ mode: "dpl-detail-less" });
  });

  it("fires Cleanup as the tighten mode", async () => {
    const user = userEvent.setup();
    const onRefine = vi.fn();
    render(<DplRefineBar onRefine={onRefine} />);
    await user.click(screen.getByRole("button", { name: /cleanup/i }));
    expect(onRefine.mock.calls[0][0]).toMatchObject({ mode: "dpl-tighten" });
  });

  it("disables every control and shows a busy lead while a refine runs", () => {
    render(<DplRefineBar busyMode="dpl-detail-more" onRefine={vi.fn()} />);
    expect(screen.getByRole("button", { name: /add detail/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /cleanup/i })).toBeDisabled();
    expect(screen.getByText(/refining…/i)).toBeInTheDocument();
  });
});
