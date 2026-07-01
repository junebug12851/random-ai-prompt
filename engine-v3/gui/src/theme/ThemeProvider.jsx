/**
 * Theme context: applies the chosen base mode + accent to `<html>` and keeps
 * them live. Mirrors the i18n provider — the App owns the persisted values
 * (`settings.themeMode` / `settings.accent`) and the user-theme list, and passes
 * them in. Consumers (the ThemePicker) read the merged theme registry + actions
 * via `useTheme()`.
 *
 * `system` mode follows the OS (a `matchMedia` listener re-applies live). User
 * themes are merged over the built-ins (override by id / add new) and applied at
 * runtime via an adopted stylesheet (see runtimeAccents.js), so a user theme
 * behaves exactly like a built-in one.
 * @module gui/theme/ThemeProvider
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { applyAccent, applyTheme, resolveMode } from "./applyTheme.js";
import { applyUserThemes } from "./runtimeAccents.js";
import { DEFAULT_MODE, normalizeMode } from "./config.js";
import { ACCENTS, DEFAULT_ACCENT, normalizeAccent } from "./presets.js";

const ThemeContext = createContext(null);

/**
 * @param {object} props
 * @param {string} props.mode Persisted base mode (`system` | `dark` | `light`).
 * @param {(mode: string) => void} [props.setMode] Persist a new mode.
 * @param {string} props.accent Persisted accent id (built-in or user theme).
 * @param {(accent: string) => void} [props.setAccent] Persist a new accent.
 * @param {object[]} [props.userThemes] Imported user themes.
 * @param {(theme: object) => void} [props.addUserTheme] Add/overwrite a user theme.
 * @param {(id: string) => void} [props.removeUserTheme] Remove a user theme by id.
 * @param {React.ReactNode} props.children
 */
export function ThemeProvider({
  mode = DEFAULT_MODE,
  setMode,
  accent = DEFAULT_ACCENT,
  setAccent,
  userThemes = [],
  addUserTheme,
  removeUserTheme,
  children,
}) {
  const safeMode = normalizeMode(mode);

  // The full theme registry: built-ins, with user themes overriding by id (in
  // place) and new user themes appended. Plus the set of user ids (deletable).
  const userThemeIds = useMemo(() => userThemes.map((t) => t.id), [userThemes]);
  const themes = useMemo(() => {
    const byId = new Map(ACCENTS.map((t) => [t.id, t]));
    for (const t of userThemes) byId.set(t.id, t);
    return [...byId.values()];
  }, [userThemes]);

  const safeAccent = normalizeAccent(accent, userThemeIds);
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

  // Push the user themes into the runtime stylesheet BEFORE the accent is applied
  // (so selecting a just-imported theme finds its rules already present).
  useEffect(() => {
    applyUserThemes(userThemes);
  }, [userThemes]);

  // Apply the accent whenever it (or the valid-id set) changes.
  useEffect(() => {
    applyAccent(safeAccent);
  }, [safeAccent]);

  const changeMode = useCallback(
    (next) => {
      if (setMode) setMode(normalizeMode(next));
    },
    [setMode],
  );

  const changeAccent = useCallback(
    (next) => {
      if (setAccent) setAccent(normalizeAccent(next, userThemeIds));
    },
    [setAccent, userThemeIds],
  );

  const value = {
    mode: safeMode,
    resolvedMode,
    setMode: changeMode,
    accent: safeAccent,
    setAccent: changeAccent,
    themes,
    userThemeIds,
    addUserTheme,
    removeUserTheme,
  };
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Read the current theme registry + setters. Must be used inside a ThemeProvider. */
export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
