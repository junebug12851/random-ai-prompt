/**
 * Pure theme data (no React Native imports) so it can be reused by the theme provider AND imported by
 * the Node parity check (scripts/mobile-parity-check.mjs), which asserts these mirror the web sources
 * (theme/themes/*.json, i18n/config.js). Keeping it framework-free is what makes parity testable.
 */

// Accent presets — must mirror targets/web/frontend/theme/themes/*.json (dark = neon tone, light =
// pastel; ink = readable text on the accent).
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
export const DEFAULT_ACCENT = "mint";

// Selectable display languages — the web ships only English + a dev pseudo-locale (i18n/config.js),
// so the mobile picker offers the real user locales: auto (device) + English.
export const LOCALES = [
  { id: "auto", label: "Auto (device)" },
  { id: "en", label: "English" },
];
export const DEFAULT_LOCALE = "auto";
