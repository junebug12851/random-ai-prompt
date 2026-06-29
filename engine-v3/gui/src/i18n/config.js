/**
 * Locale registry + resolution for the SPA's react-intl setup.
 *
 * The project ships **English** as the only fully-authored locale (the app is
 * dense with domain jargon — DPL, prompt "salt", wrappers, expansions, dynamic-
 * prompt tokens — that machine translation handles poorly, so we don't ship
 * low-quality languages). The whole pipeline is in place, though: adding a real
 * language is a one-file job (drop a compiled catalog in `compiled/<locale>.json`
 * and register it here). `en-XA` is a generated **pseudo-locale** — accented,
 * padded English — kept available so anyone can flip to it and instantly see any
 * string that was missed (still plain English = not internationalized yet).
 * @module gui/i18n/config
 */

/** The source locale: messages are authored in English (inline `defaultMessage`). */
export const DEFAULT_LOCALE = "en";

/**
 * Registry of selectable locales: code → display metadata.
 * `label` is the endonym (shown in the switcher as-is, untranslated on purpose);
 * `dir` drives the document text direction. Add a real language here once a
 * `compiled/<code>.json` catalog exists for it.
 * @constant {Object<string, {label: string, dir: ("ltr"|"rtl")}>}
 */
export const LOCALES = {
  en: { label: "English", dir: "ltr" },
  "en-XA": { label: "Pseudo (i18n test)", dir: "ltr" },
};

/** @constant {string[]} All registered locale codes. */
export const SUPPORTED_LOCALES = Object.keys(LOCALES);

/**
 * The special "follow the browser" sentinel stored in settings when the user has
 * not pinned a language. Resolves through {@link resolveLocale}.
 * @constant {string}
 */
export const AUTO_LOCALE = "auto";

/**
 * @param {string} locale A locale code.
 * @returns {boolean} Whether it is a registered, selectable locale.
 */
export function isSupported(locale) {
  return SUPPORTED_LOCALES.includes(locale);
}

/**
 * @param {string} locale A locale code.
 * @returns {("ltr"|"rtl")} The text direction for the locale (defaults to ltr).
 */
export function dirFor(locale) {
  return LOCALES[locale]?.dir ?? "ltr";
}

/**
 * Resolve a stored preference (a locale code, `""`/`"auto"`, or junk) plus the
 * browser's languages into a concrete supported locale.
 * @param {string} [pref] The stored `settings.locale` preference.
 * @returns {string} A code guaranteed to be in {@link SUPPORTED_LOCALES}.
 */
export function resolveLocale(pref) {
  if (pref && pref !== AUTO_LOCALE && isSupported(pref)) return pref;
  if (!pref || pref === AUTO_LOCALE) {
    const navs =
      typeof navigator !== "undefined"
        ? navigator.languages && navigator.languages.length
          ? navigator.languages
          : [navigator.language]
        : [];
    for (const n of navs) {
      if (!n) continue;
      if (isSupported(n)) return n;
      const base = n.split("-")[0];
      if (isSupported(base)) return base;
    }
  }
  return DEFAULT_LOCALE;
}
