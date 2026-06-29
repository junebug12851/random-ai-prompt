/**
 * @file Component tests for the searchable token grid
 * (gui/src/components/TokenPicker.jsx).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "./testUtils.jsx";
import TokenPicker from "../src/components/TokenPicker.jsx";

describe("TokenPicker", () => {
  it("renders a chip per token and inserts on click", () => {
    const onInsert = vi.fn();
    render(<TokenPicker tokens={["{red}", "{blue}", "{green}"]} onInsert={onInsert} />);
    expect(screen.getByRole("button", { name: "{red}" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "{red}" }));
    expect(onInsert).toHaveBeenCalledWith("{red}");
  });

  it("filters tokens by the search query (case-insensitive)", () => {
    render(<TokenPicker tokens={["{red}", "{blue}", "{green}"]} onInsert={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText(/Filter 3/), { target: { value: "RE" } });
    expect(screen.getByRole("button", { name: "{red}" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "{green}" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "{blue}" })).not.toBeInTheDocument();
  });

  it("caps rendered chips at 400 and shows an overflow hint", () => {
    const tokens = Array.from({ length: 450 }, (_, i) => `t${i}`);
    render(<TokenPicker tokens={tokens} onInsert={() => {}} />);
    // 400 chips rendered; the rest are summarised.
    expect(screen.getByText(/\+50 more/)).toBeInTheDocument();
  });
});
