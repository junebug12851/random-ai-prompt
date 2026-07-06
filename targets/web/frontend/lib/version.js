/**
 * The app's version string, for display (footer + links menu).
 *
 * The value is baked in at build time by Vite's `define` (`__APP_VERSION__`, read from the
 * repo-root `package.json` in `gui/vite.config.js`), so it stays in lock-step with the canonical
 * `VERSION` file without a runtime fetch. The `typeof` guard keeps it from throwing under Vitest
 * (jsdom) and any other context where the define isn't applied — there it reads "dev".
 * @module gui/lib/version
 */
/* global __APP_VERSION__ */
export const APP_VERSION = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";
