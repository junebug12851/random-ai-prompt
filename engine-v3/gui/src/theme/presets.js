/**
 * Built-in ("system") theme registry. Each system theme is a file in
 * `./themes/*.json` — the file **is** the theme; there is no theme without a
 * theme file. This module loads them (Vite / Vitest glob) into the ordered list
 * the app + picker consume. The generator (`scripts/gen-accents.mjs`) reads the
 * same folder via `fs` to emit the static `styles/foundation/accents.css`. User
 * themes (Phase 7) merge on top of these at runtime.
 *
 * Theme-file shape:
 *   { id, label, swatch, dark: {accent, ink}, light: {accent, ink} }
 * where `dark` is the neon tone and `light` the pastel tone; `ink` is the
 * readable text colour on an accent-filled button. `--accent-strong` /
 * `--accent-soft` derive from `--accent` in CSS, so they aren't in the file.
 * @module gui/theme/presets
 */

/**
 * @typedef {object} AccentTone
 * @property {string} accent The accent fill colour.
 * @property {string} ink Readable text colour on top of `accent`.
 */
/**
 * @typedef {object} Accent
 * @property {string} id Stable id used in `data-accent` + settings.
 * @property {string} label Human label for the picker.
 * @property {string} swatch Representative colour for the picker swatch.
 * @property {AccentTone} dark Neon tone for the dark base.
 * @property {AccentTone} light Pastel tone for the light base.
 */

// Eager-load every system theme file. Glob keys are paths
// ("./themes/01-mint.json"); the NN- filename prefix defines picker order, so a
// plain key sort yields the intended order.
const modules = import.meta.glob("./themes/*.json", { eager: true, import: "default" });

/** @type {Accent[]} The built-in themes, in filename order. */
export const ACCENTS = Object.keys(modules)
  .sort()
  .map((key) => modules[key]);

/** Default accent id (the mint theme; matches the :root tokens in tokens.css). */
export const DEFAULT_ACCENT = "mint";

/** All valid built-in accent ids, in picker order. */
export const ACCENT_IDS = ACCENTS.map((a) => a.id);

/** Normalize any stored/incoming accent id to a valid built-in one. */
export function normalizeAccent(id) {
  return ACCENT_IDS.includes(id) ? id : DEFAULT_ACCENT;
}
