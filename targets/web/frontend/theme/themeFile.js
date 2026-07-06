/**
 * Theme-file parse / validate / serialize. A theme file is the same shape as a
 * built-in system theme (see gui/src/theme/themes/*.json):
 *
 *   { id, label, swatch, dark: {accent, ink}, light: {accent, ink} }
 *
 * optionally wrapped as { format:"rap-theme", version:1, theme:{...} }.
 *
 * Import is strict + allow-listed: only the known fields are read, ids are
 * constrained, and every colour must be a plain hex string. Nothing else is
 * carried through — a theme file can never inject arbitrary CSS (the runtime
 * applier builds the stylesheet from these validated primitives only).
 * @module gui/theme/themeFile
 */

export const THEME_FILE_FORMAT = "rap-theme";
export const THEME_FILE_VERSION = 1;

const HEX = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const ID = /^[a-z0-9][a-z0-9-]{0,31}$/;

function normHex(v) {
  return typeof v === "string" && HEX.test(v.trim()) ? v.trim().toLowerCase() : null;
}
function normTone(t) {
  if (!t || typeof t !== "object") return null;
  const accent = normHex(t.accent);
  const ink = normHex(t.ink);
  return accent && ink ? { accent, ink } : null;
}

/**
 * Parse + validate a theme file (a JSON string or an already-parsed object).
 * @param {string|object} input
 * @returns {{ok: true, theme: object} | {ok: false, error: string}}
 */
export function parseThemeFile(input) {
  let raw = input;
  if (typeof input === "string") {
    try {
      raw = JSON.parse(input);
    } catch {
      return { ok: false, error: "That file isn't valid JSON." };
    }
  }
  if (!raw || typeof raw !== "object") return { ok: false, error: "Empty or malformed theme file." };

  // Accept a wrapped file ({format, version, theme}) or a bare theme object.
  const t = raw.theme && typeof raw.theme === "object" ? raw.theme : raw;

  const id = typeof t.id === "string" ? t.id.trim().toLowerCase() : "";
  if (!ID.test(id)) return { ok: false, error: "Theme id must be a-z, 0-9 and dashes (max 32)." };

  const dark = normTone(t.dark);
  const light = normTone(t.light);
  if (!dark || !light) {
    return { ok: false, error: "Each of dark/light needs a hex accent and ink colour." };
  }

  const label = typeof t.label === "string" && t.label.trim() ? t.label.trim().slice(0, 40) : id;
  const swatch = normHex(t.swatch) || dark.accent;

  return { ok: true, theme: { id, label, swatch, dark, light } };
}

/**
 * Serialize a theme to a downloadable, versioned theme file (pretty JSON).
 * @param {object} theme
 * @returns {string}
 */
export function serializeTheme(theme) {
  return `${JSON.stringify(
    { format: THEME_FILE_FORMAT, version: THEME_FILE_VERSION, theme },
    null,
    2,
  )}\n`;
}
