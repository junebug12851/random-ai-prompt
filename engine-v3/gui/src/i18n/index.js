/**
 * Public surface of the i18n module.
 * @module gui/i18n
 */
export { default as I18nProvider } from "./I18nProvider.jsx";
export {
  DEFAULT_LOCALE,
  AUTO_LOCALE,
  LOCALES,
  SUPPORTED_LOCALES,
  isSupported,
  dirFor,
  resolveLocale,
} from "./config.js";
