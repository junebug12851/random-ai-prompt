/**
 * User themes — imported theme files that override a built-in (same id) or add a
 * new theme. Persisted through the storage layer under the `themes` namespace (a
 * file in the user-settings folder locally; localStorage only online), keyed by
 * id like the presets store. Mirrors gui/lib/customStore.js.
 * @module gui/theme/userThemeStore
 */
import { useCallback, useState } from "react";
import { getCached, setCached } from "../../storage/cache.js";

const THEMES_NS = "themes";

/** @returns {object} The stored user themes, keyed by id (or `{}`). */
function read() {
  return getCached(THEMES_NS) || {};
}
function write(obj) {
  setCached(THEMES_NS, obj);
}

/** @returns {object[]} The user themes as an array (insertion order). */
export function getUserThemes() {
  return Object.values(read());
}

/** Save (add or overwrite by id) a user theme. @param {object} theme */
export function saveUserTheme(theme) {
  write({ ...read(), [theme.id]: theme });
}

/** Remove a user theme by id. @param {string} id */
export function removeUserTheme(id) {
  const o = { ...read() };
  delete o[id];
  write(o);
}

/**
 * React hook: the user-theme list plus add/remove actions that persist and
 * re-read so the list stays in sync.
 * @returns {[object[], (t: object) => void, (id: string) => void]}
 */
export function useUserThemes() {
  const [themes, setThemes] = useState(() => getUserThemes());
  const add = useCallback((theme) => {
    saveUserTheme(theme);
    setThemes(getUserThemes());
  }, []);
  const remove = useCallback((id) => {
    removeUserTheme(id);
    setThemes(getUserThemes());
  }, []);
  return [themes, add, remove];
}
