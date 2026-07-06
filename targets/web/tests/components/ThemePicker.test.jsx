/**
 * @file Component tests for the header Appearance (theme) picker: opens/closes,
 * reflects the current mode + accent, and forwards changes through useTheme.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "../testUtils.jsx";
import { ThemeProvider } from "../../frontend/theme/ThemeProvider.jsx";
import ThemePicker from "../../frontend/components/ThemePicker.jsx";

afterEach(() => {
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("data-accent");
});

function setup({ mode = "dark", accent = "mint", userThemes = [] } = {}) {
  const setMode = vi.fn();
  const setAccent = vi.fn();
  const addUserTheme = vi.fn();
  const removeUserTheme = vi.fn();
  render(
    <ThemeProvider
      mode={mode}
      setMode={setMode}
      accent={accent}
      setAccent={setAccent}
      userThemes={userThemes}
      addUserTheme={addUserTheme}
      removeUserTheme={removeUserTheme}
    >
      <ThemePicker />
    </ThemeProvider>,
  );
  return { setMode, setAccent, addUserTheme, removeUserTheme };
}

const OCEAN = {
  id: "ocean",
  label: "Ocean",
  swatch: "#2299ff",
  dark: { accent: "#2299ff", ink: "#001022" },
  light: { accent: "#88ccff", ink: "#001022" },
};

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

  it("lists user themes beside built-ins and can delete them", () => {
    const { removeUserTheme } = setup({ userThemes: [OCEAN] });
    fireEvent.click(screen.getByRole("button", { name: /appearance/i }));
    expect(screen.getByRole("radio", { name: "Mint" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Ocean" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /remove ocean/i }));
    expect(removeUserTheme).toHaveBeenCalledWith("ocean");
  });

  it("offers Import and Export controls", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /appearance/i }));
    expect(screen.getByRole("button", { name: /import theme/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^export$/i })).toBeInTheDocument();
  });
});
