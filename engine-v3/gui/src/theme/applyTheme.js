/**
 * The pure side-effect layer for theming: resolve a mode to a concrete base and
 * write it to `<html data-theme>`. Kept dependency-free (no React) so it can run
 * from the provider, from tests, and — in spirit — mirrors the inline boot
 * script in index.html.
 * @module gui/theme/applyTheme
 */
import { normalizeMode } from "./config.js";

/** True when the OS currently prefers a light color scheme. */
export function prefersLight() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: light)").matches
  );
}

/**
 * Resolve a mode (`system` | `dark` | `light`) to a concrete base
 * (`dark` | `light`). `system` follows the OS via `prefersLight()`.
 */
export function resolveMode(mode) {
  const m = normalizeMode(mode);
  if (m === "dark" || m === "light") return m;
  return prefersLight() ? "light" : "dark";
}

/**
 * Apply the theme to `<html>` by setting `data-theme` to the resolved base.
 * Returns the resolved base so callers can track it. No-op without a document.
 */
export function applyTheme(mode) {
  const resolved = resolveMode(mode);
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", resolved);
  }
  return resolved;
}

/**
 * Apply the accent to `<html data-accent>`. The id is trusted (the caller — the
 * ThemeProvider — validates against built-in ∪ user-theme ids first, since user
 * themes are valid too). Returns the applied id. No-op without a document.
 */
export function applyAccent(accent) {
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-accent", accent);
  }
  return accent;
}
