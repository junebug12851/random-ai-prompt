/**
 * Theme registry: the base modes and the defaults. Accents (the swatch presets)
 * are defined in `presets.js` from Phase 4; this file holds the base-mode config
 * the provider and picker share.
 * @module gui/theme/config
 */

/** The three base modes the user can pick. `system` follows the OS. */
export const THEME_MODES = ["system", "dark", "light"];

/** The resolved bases a theme can actually render as (system resolves to one). */
export const RESOLVED_MODES = ["dark", "light"];

/** Shipped default — mint accent on a System (auto dark/light) base. */
export const DEFAULT_MODE = "system";
export const DEFAULT_ACCENT = "mint";

/** Normalize any stored/incoming value to a valid mode. */
export function normalizeMode(mode) {
  return THEME_MODES.includes(mode) ? mode : DEFAULT_MODE;
}
