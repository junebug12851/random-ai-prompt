/**
 * The app's react-intl boundary. Resolves the stored locale preference (or the
 * browser's languages), loads the matching compiled catalog, keeps the document's
 * `lang`/`dir` attributes in sync, and swallows expected missing-translation
 * noise so a partially-translated locale degrades gracefully to English.
 * @module gui/i18n/I18nProvider
 */
import { useEffect, useMemo } from "react";
import { IntlProvider } from "react-intl";
import { resolveLocale, dirFor, DEFAULT_LOCALE } from "./config.js";
import { messagesFor } from "./loadMessages.js";

/**
 * Quiet, non-fatal handler for react-intl runtime errors.
 * @param {Error & {code?: string}} err The intl error.
 * @returns {void}
 */
function onIntlError(err) {
  // A locale that's missing a key simply falls back to the inline English
  // `defaultMessage` — that's by design, not worth shouting about.
  if (err && err.code === "MISSING_TRANSLATION") return;
  if (import.meta.env && import.meta.env.DEV) console.error("[i18n]", err);
}

/**
 * Wrap the app subtree in a configured `<IntlProvider>`.
 * @param {object} props
 * @param {string} [props.locale] The stored `settings.locale` preference
 *   (`"auto"`/empty follows the browser).
 * @param {import("react").ReactNode} props.children The app tree.
 * @returns {JSX.Element}
 */
export default function I18nProvider({ locale: pref, children }) {
  const locale = useMemo(() => resolveLocale(pref), [pref]);
  const messages = useMemo(() => messagesFor(locale), [locale]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = locale;
    document.documentElement.dir = dirFor(locale);
  }, [locale]);

  return (
    <IntlProvider
      locale={locale}
      defaultLocale={DEFAULT_LOCALE}
      messages={messages}
      onError={onIntlError}
    >
      {children}
    </IntlProvider>
  );
}
