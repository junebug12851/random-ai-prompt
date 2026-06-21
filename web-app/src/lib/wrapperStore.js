/**
 * Browser-local "wrapper" presets: a named pair of DPL snippets — a START and an END —
 * that frame the prompt (the v3 root layer = open + middle + close). Stored in localStorage
 * only, the no-server equivalent of a saved wrapper. See notes/plans/v3-layers.md.
 * @module web-app/lib/wrapperStore
 */

const KEY = "rap.wrappers.v1";

/** @returns {object} The wrapper presets (`{ name: { start, end } }`). */
function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}
/** @param {object} obj The presets to persist. @returns {void} */
function write(obj) {
  try {
    localStorage.setItem(KEY, JSON.stringify(obj));
  } catch {
    // best-effort
  }
}

/** @returns {object} All wrapper presets (`{ name: { start, end } }`). */
export function getWrappers() {
  return read();
}
/**
 * Save (or overwrite) a wrapper preset.
 * @param {string} name The preset name.
 * @param {{start: string, end: string}} value The start/end snippets.
 * @returns {void}
 */
export function saveWrapper(name, value) {
  const o = read();
  o[name] = { start: value.start || "", end: value.end || "" };
  write(o);
}
/**
 * Rename a wrapper preset (no-op if `from` is missing or `to` is blank).
 * @param {string} from The current name.
 * @param {string} to The new name.
 * @returns {void}
 */
export function renameWrapper(from, to) {
  const o = read();
  if (!(from in o) || !to || from === to) return;
  o[to] = o[from];
  delete o[from];
  write(o);
}
/** @param {string} name The preset to remove. @returns {void} */
export function removeWrapper(name) {
  const o = read();
  delete o[name];
  write(o);
}
