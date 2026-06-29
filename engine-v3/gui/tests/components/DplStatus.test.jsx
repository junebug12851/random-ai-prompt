/**
 * @file Component tests for DplStatus — the live DPL validity badge (✓ / ✕ / warn).
 */
import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { render } from "../testUtils.jsx";
import DplStatus from "../../src/components/DplStatus.jsx";

describe("DplStatus", () => {
  it("shows a check for clean DPL", () => {
    render(<DplStatus value="a fox, {color} fur" />);
    const el = screen.getByRole("status");
    expect(el).toHaveTextContent("✓");
    expect(el).toHaveAttribute("aria-label", expect.stringMatching(/valid dpl/i));
  });

  it("shows an ✕ and an error count for invalid DPL", () => {
    render(<DplStatus value="a {color cat" />);
    const el = screen.getByRole("status");
    expect(el).toHaveTextContent("✕");
    expect(el).toHaveAttribute("aria-label", expect.stringMatching(/1 dpl error/i));
  });

  it("stays valid but flags a warning for an unbalanced bracket", () => {
    render(<DplStatus value="a (cat" />);
    const el = screen.getByRole("status");
    expect(el).toHaveTextContent("✓");
    expect(el).toHaveAttribute("aria-label", expect.stringMatching(/warning/i));
  });
});
