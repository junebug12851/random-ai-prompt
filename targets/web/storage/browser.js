/**
 * Browser storage backend — the **online / stripped** persistence tier: namespaced JSON
 * blobs in `localStorage`. Used when the app is deployed (no disk) and as the universal
 * fallback. BYOK keys persisted here never leave the browser except per-request.
 * @module gui/storage/browser
 */

const PREFIX = "rap.store.";

/**
 * @param {string} ns Namespace key.
 * @returns {string} The prefixed localStorage key.
 */
const k = (ns) => PREFIX + ns;

/** @type {import("./index.js").StorageBackend} */
export const browserStorage = {
  id: "browser",

  async get(ns) {
    try {
      return JSON.parse(localStorage.getItem(k(ns)) || "null");
    } catch {
      return null;
    }
  },

  async set(ns, obj) {
    try {
      localStorage.setItem(k(ns), JSON.stringify(obj));
    } catch {
      // best-effort (quota / private mode)
    }
  },

  async remove(ns) {
    try {
      localStorage.removeItem(k(ns));
    } catch {
      // best-effort
    }
  },

  async keys() {
    const out = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(PREFIX)) out.push(key.slice(PREFIX.length));
      }
    } catch {
      // best-effort
    }
    return out;
  },
};
