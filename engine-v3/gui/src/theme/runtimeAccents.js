/**
 * Runtime application of user themes. Built-in themes ship in the static
 * `styles/foundation/accents.css`; user themes aren't in that bundle, so their
 * `[data-accent]` rules are generated here and applied at runtime.
 *
 * Delivery: a constructable `CSSStyleSheet` added to `document.adoptedStyleSheets`
 * (unlayered, so it also wins over the layered built-in `accents.css` — that's
 * how a user theme can OVERRIDE a built-in of the same id). Falls back to a
 * `<style>` element where constructable stylesheets aren't supported.
 *
 * The rules mirror the generator (scripts/gen-accents.mjs) exactly, so a user
 * theme behaves identically to a system one. Values come only from
 * `parseThemeFile` (validated hex + id), so the generated CSS is safe.
 * @module gui/theme/runtimeAccents
 */

const STRONG = "color-mix(in oklab, var(--accent), #000 12%)";

/** The two rules (dark + light) for one theme, matching the built-in format. */
function cssFor(theme) {
  return (
    `:root[data-accent="${theme.id}"] {` +
    `--accent:${theme.dark.accent};--accent-ink:${theme.dark.ink};--accent-strong:${STRONG};}` +
    `\n:root[data-theme="light"][data-accent="${theme.id}"] {` +
    `--accent:${theme.light.accent};--accent-ink:${theme.light.ink};}`
  );
}

let sheet = null; // the shared constructable sheet, created lazily.

/**
 * Apply (or refresh) the runtime stylesheet for the given user themes.
 * Idempotent — call whenever the user-theme list changes.
 * @param {object[]} themes
 */
export function applyUserThemes(themes) {
  if (typeof document === "undefined") return;
  const css = themes.map(cssFor).join("\n");

  const supportsAdopted =
    "adoptedStyleSheets" in Document.prototype && typeof CSSStyleSheet === "function";
  if (supportsAdopted) {
    try {
      if (!sheet) {
        sheet = new CSSStyleSheet();
        document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
      }
      sheet.replaceSync(css);
      return;
    } catch {
      // fall through to the <style> fallback
    }
  }

  let el = document.getElementById("rap-user-themes");
  if (!el) {
    el = document.createElement("style");
    el.id = "rap-user-themes";
    document.head.appendChild(el);
  }
  el.textContent = css;
}
