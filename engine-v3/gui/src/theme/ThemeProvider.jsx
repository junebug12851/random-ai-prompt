/**
 * Theme context: applies the user's chosen base mode to `<html data-theme>` and
 * keeps it live. Mirrors the i18n provider — the App owns the persisted value
 * (`settings.themeMode`) and passes it in with a setter. Consumers (the
 * ThemePicker) read `{ mode, resolvedMode, setMode }` via `useTheme()`.
 *
 * `system` mode follows the OS: a `matchMedia` listener re-applies the theme
 * when the OS scheme flips, so no reload is needed.
 * @module gui/theme/ThemeProvider
 */
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { applyTheme, resolveMode } from "./applyTheme.js";
import { DEFAULT_MODE, normalizeMode } from "./config.js";

const ThemeContext = createContext(null);

/**
 * @param {object} props
 * @param {string} props.mode Persisted mode (`system` | `dark` | `light`).
 * @param {(mode: string) => void} [props.setMode] Persist a new mode.
 * @param {React.ReactNode} props.children
 */
export function ThemeProvider({ mode = DEFAULT_MODE, setMode, children }) {
  const safeMode = normalizeMode(mode);
  const [resolvedMode, setResolvedMode] = useState(() => resolveMode(safeMode));

  // Apply whenever the chosen mode changes (also on first mount — the inline
  // boot script set a first guess, this reconciles it with the saved choice).
  useEffect(() => {
    setResolvedMode(applyTheme(safeMode));
  }, [safeMode]);

  // While following the OS, re-apply when the OS scheme flips.
  useEffect(() => {
    if (safeMode !== "system") return undefined;
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => setResolvedMode(applyTheme("system"));
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [safeMode]);

  const changeMode = useCallback(
    (next) => {
      if (setMode) setMode(normalizeMode(next));
    },
    [setMode],
  );

  const value = { mode: safeMode, resolvedMode, setMode: changeMode };
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Read the current theme + setter. Must be used inside a ThemeProvider. */
export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
