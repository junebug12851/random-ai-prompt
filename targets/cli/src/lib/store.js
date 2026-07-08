/**
 * @file
 * @brief Persisted key/value store for the CLI, reusing the web backend's per-namespace file store
 * (`user/settings/<ns>.json`) so the CLI and the desktop/web app share one on-disk settings home.
 * BYOK keys and the CLI's own config live here. No new storage mechanism — the same atomic-write,
 * path-safe helpers the local backend uses.
 */
import { readNs, writeNs, removeNs, listNs } from "../../../web/backend/vite-api-helpers.js";

/**
 * Read a namespace's stored value (or null).
 * @param {string} ns The namespace (e.g. "settings", "cli", "providers/openai").
 * @returns {*} The value, or null.
 */
export const read = (ns) => readNs(ns);

/**
 * Write a namespace's value (atomic; creates subfolders).
 * @param {string} ns The namespace.
 * @param {*} value The JSON value.
 * @returns {boolean} True on success.
 */
export const write = (ns, value) => writeNs(ns, value);

/**
 * Delete a namespace.
 * @param {string} ns The namespace.
 * @returns {void}
 */
export const remove = (ns) => removeNs(ns);

/**
 * List every stored namespace.
 * @returns {string[]} The namespaces.
 */
export const keys = () => listNs();
