/**
 * @file Component tests for the header Appearance (theme) picker: opens/closes,
 * reflects the current mode + accent, and forwards changes through useTheme.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "../testUtils.jsx";
import { ThemeProvider } from "../../src/theme/ThemeProvider.jsx";
import ThemePicker from "../../src/components/ThemePicker.jsx";

afterEach(() => {
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("data-accent");
});

function setup({ mode = "dark", accent = "mint" } = {}) {
  const setMode = vi.fn();
  const setAccent = vi.fn();
  render(
    <ThemeProvider mode={mode} setMode={setMode} accent={accent} setAccent={setAccent}>
      <ThemePicker />
    </ThemeProvider>,
  );
  return { setMode, setAccent };
}

describe("ThemePicker", () => {
  it("stays closed until the trigger is clicked", () => {
    setup();
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /appearance/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("reflects the current mode + accent and forwards changes", () => {
    const { setMode, setAccent } = setup({ mode: "dark", accent: "mint" });
    fireEvent.click(screen.getByRole("button", { name: /appearance/i }));

    expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: "Light" }));
    expect(setMode).toHaveBeenCalledWith("light");

    expect(screen.getByRole("radio", { name: "Mint" })).toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: "Violet" }));
    expect(setAccent).toHaveBeenCalledWith("violet");
  });

  it("closes on Escape", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /appearance/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
