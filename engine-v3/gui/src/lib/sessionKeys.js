/**
 * In-memory BYOK key store. Keys typed into a provider box live here ONLY for the current
 * page session — never persisted — unless the user explicitly clicks Save (which copies the
 * key into the saved settings). Cleared on reload. Generation reads the session key first,
 * then the saved one.
 * @module gui/lib/sessionKeys
 */

const session = {};

/**
 * @param {string} id Provider id.
 * @returns {string} The in-memory session key (or "").
 */
export function getSessionKey(id) {
  return session[id] || "";
}

/**
 * @param {string} id Provider id.
 * @param {string} value The key value.
 * @returns {void}
 */
export function setSessionKey(id, value) {
  session[id] = value;
}

/**
 * The effective key for generation: the session key if present, else the saved one.
 * @param {string} id Provider id.
 * @param {object} settings The settings (with `keys`).
 * @returns {string} The key to use.
 */
export function effectiveKey(id, settings) {
  return session[id] || settings?.keys?.[id] || "";
}
