/**
 * Theme data for the mobile app.
 *
 * The **accent presets are no longer copied here** — they come from the shared layer
 * (`targets/shared/theme/themes/*.json`, via the generated static index), which is the same source the
 * web reads. All nine used to be transcribed into this file by hand, because the web discovered them
 * with a Vite `import.meta.glob` that Metro cannot execute; a drift check (`checkAccents`) then policed
 * the copy. Same root cause as the provider registry, same fix, and the check is gone with the copy.
 * See `notes/plans/de-duplication.md`.
 *
 * Framework-free (no React Native imports) so the theme provider and the Node-side checks can both
 * load it.
 */
export { ACCENTS } from "shared/theme/presets.generated.js";

export const DEFAULT_ACCENT = "mint";

// Selectable display languages — the web ships only English + a dev pseudo-locale (i18n/config.js),
// so the mobile picker offers the real user locales: auto (device) + English.
export const LOCALES = [
  { id: "auto", label: "Auto (device)" },
  { id: "en", label: "English" },
];
export const DEFAULT_LOCALE = "auto";