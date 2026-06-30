/**
 * @file
 * @brief In-app dialog service — a Promise-based replacement for the browser's blocking
 * `window.alert` / `confirm` / `prompt`. Any module (a component, a hook, or a plain lib file)
 * imports the singleton `dialog` and `await`s a request:
 *
 * ```js
 * if (await dialog.confirm({ message: "Delete this?" })) …            // → boolean
 * const name = await dialog.prompt({ message: "Name?" });             // → string | null
 * await dialog.alert({ message: "Saved." });                          // → undefined
 * ```
 *
 * The matching `<DialogHost>` (mounted once at the app root, inside the i18n boundary) subscribes to
 * this store, renders the active dialog as an accessible modal, and resolves the pending promise on
 * the user's choice. Because state lives in a tiny external store (not React context), the API is
 * callable identically from inside a component and from a non-component hook/lib — which is why it
 * can replace the native dialogs in `lib/home/useImageBatches.js` and `lib/manage/useManageTree.js`
 * as cleanly as in a `.jsx` component. See notes/systems/gui.md.
 *
 * The resolve contract mirrors the native primitives so call sites translate one-for-one:
 *   - `confirm` → `true` (accepted) / `false` (cancelled, Escape, or backdrop)
 *   - `prompt`  → the entered string (accepted) / `null` (cancelled)
 *   - `alert`   → `undefined` (any dismissal)
 */

/**
 * @typedef {object} DialogRequest
 * @property {"alert"|"confirm"|"prompt"} kind Which primitive this is.
 * @property {string} [message] The body text (already localized by the caller).
 * @property {string} [title] Optional heading.
 * @property {string} [note] Optional smaller secondary line.
 * @property {string} [confirmLabel] Override for the accept button (defaults to a localized OK).
 * @property {string} [cancelLabel] Override for the cancel button (defaults to a localized Cancel).
 * @property {boolean} [destructive] Style the accept button as a destructive (red) action.
 * @property {string} [defaultValue] `prompt` only — the input's initial value.
 * @property {string} [placeholder] `prompt` only — the input placeholder.
 */

/** @type {Array<DialogRequest & {id:number, resolve:Function}>} The FIFO queue; `queue[0]` is shown. */
let queue = [];
let seq = 0;
const listeners = new Set();

function emit() {
  for (const fn of listeners) fn();
}

/**
 * Subscribe to queue changes (for `useSyncExternalStore`).
 * @param {Function} fn Called on every change.
 * @returns {Function} Unsubscribe.
 */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** @returns {Array} The current queue (a stable reference between changes). */
export function getSnapshot() {
  return queue;
}

function enqueue(spec) {
  return new Promise((resolve) => {
    queue = [...queue, { ...spec, id: ++seq, resolve }];
    emit();
  });
}

/**
 * Resolve and dismiss a dialog by id (called by the host on a user action). Unknown ids are ignored
 * (e.g. a double-fire), so resolving is idempotent.
 * @param {number} id The dialog id.
 * @param {*} value The value to resolve the pending promise with.
 */
export function settle(id, value) {
  const found = queue.find((d) => d.id === id);
  if (!found) return;
  queue = queue.filter((d) => d.id !== id);
  emit();
  found.resolve(value);
}

const normalize = (opts) => (typeof opts === "string" ? { message: opts } : opts || {});

/** The singleton dialog API. Import as `import { dialog } from "…/lib/dialog.js"`. */
export const dialog = {
  /**
   * Show a message with a single dismiss button.
   * @param {DialogRequest|string} opts Options, or a bare message string.
   * @returns {Promise<void>} Resolves when dismissed.
   */
  alert(opts) {
    return enqueue({ kind: "alert", ...normalize(opts) });
  },
  /**
   * Ask the user to confirm or cancel.
   * @param {DialogRequest|string} opts Options, or a bare message string.
   * @returns {Promise<boolean>} `true` if accepted, `false` otherwise.
   */
  confirm(opts) {
    return enqueue({ kind: "confirm", ...normalize(opts) });
  },
  /**
   * Ask the user for a line of text.
   * @param {DialogRequest|string} opts Options, or a bare message string.
   * @returns {Promise<string|null>} The entered text, or `null` if cancelled.
   */
  prompt(opts) {
    return enqueue({ kind: "prompt", defaultValue: "", ...normalize(opts) });
  },
};
