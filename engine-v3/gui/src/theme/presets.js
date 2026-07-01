/**
 * Accent presets — the single source of truth for the swatch grid, the generated
 * accent CSS (`scripts/gen-accents.mjs` → `styles/foundation/accents.css`), and
 * the contrast test (`tests/theme/accentContrast.test.js`).
 *
 * Each accent renders **bright neon on dark** and **soft pastel on light**, with a
 * per-accent `ink` (the readable text colour on an accent-filled button). Mint is
 * the shipped default and its values match `foundation/tokens.css` exactly, so it
 * needs no `[data-accent]` override — the generator skips it.
 *
 * `--accent-strong` (button hover) and `--accent-soft` (tints) are derived from
 * `--accent` in CSS, so they aren't part of the per-accent data here.
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

/** @type {Accent[]} */
export const ACCENTS = [
  {
    id: "mint",
    label: "Mint",
    swatch: "#34e2a0",
    dark: { accent: "#34e2a0", ink: "#06231a" },
    light: { accent: "#34e2a0", ink: "#04150f" },
  },
  {
    id: "teal",
    label: "Teal",
    swatch: "#3de8c8",
    dark: { accent: "#3de8c8", ink: "#04231e" },
    light: { accent: "#6fe6cf", ink: "#04231e" },
  },
  {
    id: "cyan",
    label: "Cyan",
    swatch: "#46e6ff",
    dark: { accent: "#46e6ff", ink: "#052430" },
    light: { accent: "#7fe9ff", ink: "#052430" },
  },
  {
    id: "blue",
    label: "Blue",
    swatch: "#5b9dff",
    dark: { accent: "#5b9dff", ink: "#071630" },
    light: { accent: "#8fbcff", ink: "#071630" },
  },
  {
    id: "violet",
    label: "Violet",
    swatch: "#b18bff",
    dark: { accent: "#b18bff", ink: "#1a0a2e" },
    light: { accent: "#c7b0ff", ink: "#1a0a2e" },
  },
  {
    id: "magenta",
    label: "Magenta",
    swatch: "#f27bff",
    dark: { accent: "#f27bff", ink: "#2a082b" },
    light: { accent: "#f4a8ff", ink: "#2a082b" },
  },
  {
    id: "pink",
    label: "Pink",
    swatch: "#ff77a8",
    dark: { accent: "#ff77a8", ink: "#2e0a18" },
    light: { accent: "#ffa6c2", ink: "#2e0a18" },
  },
  {
    id: "coral",
    label: "Coral",
    swatch: "#ff8a6b",
    dark: { accent: "#ff8a6b", ink: "#2e1108" },
    light: { accent: "#ffb199", ink: "#2e1108" },
  },
  {
    id: "amber",
    label: "Amber",
    swatch: "#ffcb52",
    dark: { accent: "#ffcb52", ink: "#2a1e04" },
    light: { accent: "#ffdd8a", ink: "#2a1e04" },
  },
];

/** Default accent id (matches the mint tokens in foundation/tokens.css). */
export const DEFAULT_ACCENT = "mint";

/** All valid accent ids, in picker order. */
export const ACCENT_IDS = ACCENTS.map((a) => a.id);

/** Normalize any stored/incoming accent id to a valid one. */
export function normalizeAccent(id) {
  return ACCENT_IDS.includes(id) ? id : DEFAULT_ACCENT;
}
