/**
 * The pluggable **storage subsystem** — settings/presets persistence chosen by run mode,
 * parallel to the image-provider registry. Online (deployed) uses the stripped browser
 * (`localStorage`) backend; local (`npm run web`) uses a real `.json` config file via the
 * dev-server `/api/storage` endpoint (falling back to the browser backend if unreachable).
 *
 * Providers (and the app) read/write through this layer and never care where the data
 * lives. Namespaces are arbitrary JSON-blob keys, e.g. `settings`, `presets:<providerId>`.
 * @module gui/storage
 */
import { browserStorage } from "./browser.js";
import { localFileStorage } from "./localFile.js";

/**
 * @typedef {object} StorageBackend
 * @property {string} id Backend id.
 * @property {(ns: string) => Promise<*>} get Read a namespace's value (or null).
 * @property {(ns: string, obj: *) => Promise<void>} set Write a namespace's value.
 * @property {(ns: string) => Promise<void>} remove Delete a namespace.
 * @property {() => Promise<string[]>} keys List known namespaces.
 */

const ONLINE = import.meta.env.VITE_ONLINE === "true";

/** @type {StorageBackend} The active backend for this run mode. */
export const storage = ONLINE ? browserStorage : localFileStorage;

export { browserStorage, localFileStorage };

/**
 * A per-provider preset store, layered on the active backend. Each provider "owns" its
 * presets — they live under the `presets:<providerId>` namespace as `{ [name]: paramsPatch }`.
 * @param {string} providerId The provider id.
 * @returns {{ list: Function, get: Function, save: Function, remove: Function }}
 */
export function presetStore(providerId) {
  const ns = `presets:${providerId}`;
  return {
    /** @returns {Promise<object>} All presets `{ name: paramsPatch }`. */
    async list() {
      return (await storage.get(ns)) || {};
    },
    /**
     * @param {string} name Preset name.
     * @returns {Promise<object|null>} The preset's params patch, or null.
     */
    async get(name) {
      const all = (await storage.get(ns)) || {};
      return all[name] ?? null;
    },
    /**
     * @param {string} name Preset name.
     * @param {object} patch The params patch to store.
     * @returns {Promise<void>}
     */
    async save(name, patch) {
      const all = (await storage.get(ns)) || {};
      all[name] = patch;
      await storage.set(ns, all);
    },
    /**
     * @param {string} name Preset name.
     * @returns {Promise<void>}
     */
    async remove(name) {
      const all = (await storage.get(ns)) || {};
      delete all[name];
      await storage.set(ns, all);
    },
  };
}
