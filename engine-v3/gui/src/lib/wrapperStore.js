/**
 * "Wrapper" presets: a named pair of DPL snippets — a START and an END — that frame the prompt
 * (the v3 root layer = open + middle + close). Persisted through the storage layer (a file in the
 * user-settings folder locally; localStorage only online): the preset library under the `wrappers`
 * namespace, the editable built-in Default under `wrapper-default`. See notes/plans/v3-layers.md.
 * @module gui/lib/wrapperStore
 */
import { getCached, setCached, removeCached } from "../../storage/cache.js";

const KEY = "wrappers";
const DEFAULT_KEY = "wrapper-default";

// The hard-coded SEED for the built-in "Default" wrapper. Kept deliberately clean — NO quality-booster
// spam (no "masterpiece, best quality, highly detailed, …"): the START is empty, and the END only adds
// random art-style variety ({#fx} = art movement / technique / image-effect, {#artists} = a random
// artist run) plus an optional god-rays bullet ({#rays}, ~50%), written in DPL so the probabilities
// apply. This is the immutable fallback; the live Default (below) is a copy of this the user can edit,
// re-created from this seed whenever it is reset/deleted. See notes/plans/v3-layers.md.
export const DEFAULT_WRAPPER_SEED = {
  start: "",
  end: "{#fx}, {#artists}\n- {#rays}",
};

// Back-compat alias: existing callers import DEFAULT_WRAPPER. It now reflects the *seed*; use
// getDefaultWrapper() to read the live (possibly user-edited) Default.
export const DEFAULT_WRAPPER = DEFAULT_WRAPPER_SEED;

/**
 * The live "Default" wrapper: the user-editable copy of the seed. It behaves like a preset you
 * can't delete — if its backing entry is missing (never edited, or reset), it is the seed.
 * @returns {{start: string, end: string}} The live default.
 */
export function getDefaultWrapper() {
  const o = getCached(DEFAULT_KEY);
  if (o && (o.start !== undefined || o.end !== undefined)) {
    return { start: o.start || "", end: o.end || "" };
  }
  return { ...DEFAULT_WRAPPER_SEED };
}

/**
 * Persist edits to the live Default wrapper (kept local; never overwritten unless reset).
 * @param {{start: string, end: string}} value The edited start/end.
 * @returns {void}
 */
export function saveDefaultWrapper(value) {
  setCached(DEFAULT_KEY, { start: value.start || "", end: value.end || "" });
}

/**
 * Reset the Default wrapper back to the hard-coded seed (drops the local edit).
 * @returns {void}
 */
export function resetDefaultWrapper() {
  removeCached(DEFAULT_KEY);
}

/** @returns {object} The wrapper presets (`{ name: { start, end } }`), a shallow copy. */
function read() {
  return { ...(getCached(KEY) || {}) };
}
/** @param {object} obj The presets to persist. @returns {void} */
function write(obj) {
  setCached(KEY, obj);
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
