/**
 * @file Component + interaction tests for DplInsertBar — the prompt-box DPL insert toolbar.
 */
import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "../testUtils.jsx";
import DplInsertBar from "../../frontend/components/DplInsertBar.jsx";

const makeRef = () => ({ current: { insertSnippet: vi.fn() } });

describe("DplInsertBar", () => {
  it("renders a toolbar with the seven category buttons", () => {
    render(<DplInsertBar editorRef={makeRef()} settings={{}} />);
    expect(screen.getByRole("toolbar")).toBeInTheDocument();
    for (const label of [/structure/i, /chance/i, /choose/i, /repeat/i, /flow/i, /emphasis/i, /code/i]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });

  it("opens a category popover and inserts the picked snippet at the cursor", async () => {
    const user = userEvent.setup();
    const ref = makeRef();
    render(<DplInsertBar editorRef={ref} settings={{}} />);

    await user.click(screen.getByRole("button", { name: /structure/i }));
    const menu = screen.getByRole("menu");
    expect(menu).toBeInTheDocument();

    const items = screen.getAllByRole("menuitem");
    await user.click(items[0]); // "Bullet line" → "- ${1:detail}"
    expect(ref.current.insertSnippet).toHaveBeenCalledTimes(1);
    const [template, opts] = ref.current.insertSnippet.mock.calls[0];
    expect(template).toContain("-");
    expect(opts).toMatchObject({ line: true });
  });

  it("toggles a category closed and closes on Escape", async () => {
    const user = userEvent.setup();
    render(<DplInsertBar editorRef={makeRef()} settings={{}} />);
    const btn = screen.getByRole("button", { name: /emphasis/i });
    await user.click(btn);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(btn).toHaveAttribute("aria-expanded", "true");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
