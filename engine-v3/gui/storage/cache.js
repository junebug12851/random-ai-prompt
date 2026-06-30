/**
 * The synchronous front for the async storage layer. The app's stores (settings, presets,
 * wrappers, per-provider params) want synchronous reads/writes, but the backend is async (disk
 * via HTTP locally, localStorage online). So we **hydrate once** at boot — loading every relevant
 * namespace (migrating any legacy `localStorage` keys forward) into an in-memory cache — and then
 * serve reads from the cache and persist writes through to the backend in the background.
 *
 * This is what lets local mode keep **zero** browser storage: the stores no longer touch
 * `localStorage` themselves; they go through here, and the backend writes to the one user-settings
 * folder on disk (online, the backend is localStorage — the only place it's used).
 * @module gui/storage/cache
 */
import { storage } from "./index.js";
import { loadConfig, saveConfig, removeConfig } from "./config.js";

/** @type {Map<string, object>} ns → its loaded data (version-unwrapped). */
const cache = new Map();
let hydrated = false;
let hydrating = null;
// When we last wrote to the backend. The file-watch settings reload uses this to ignore change
// events caused by our OWN writes (so it never re-reads — and never risks clobbering — what the app
// just saved). External edits aren't preceded by our write, so they still come through.
let lastWriteAt = 0;

/** Current schema version per namespace (settings keeps the old `v2` line). */
const VERSIONS = { settings: 2 };
const versionOf = (ns) => VERSIONS[ns] ?? 1;

// Legacy direct-`localStorage` keys to fold into the new namespaces the first time we hydrate, so a
// returning user keeps their settings/presets/wrappers. Seeded only when the namespace is empty.
const LEGACY = [
  { ns: "settings", key: "rap.settings.v2" },
  { ns: "presets", key: "rap.customPresets.v1" },
  { ns: "wrappers", key: "rap.wrappers.v1" },
  { ns: "wrapper-default", key: "rap.wrapper.default.v1" },
];

/** The namespaces always loaded into the cache (provider namespaces are discovered dynamically). */
const CORE_NAMESPACES = ["settings", "presets", "wrappers", "wrapper-default"];

/**
 * @param {string} key A raw localStorage key.
 * @returns {*} The parsed value, or null.
 */
function readLegacy(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Load every relevant namespace into the in-memory cache (idempotent; concurrent callers share one
 * in-flight promise). Migrates legacy localStorage keys into the backend first.
 * @returns {Promise<void>}
 */
export function hydrate() {
  if (hydrated) return Promise.resolve();
  if (hydrating) return hydrating;
  hydrating = (async () => {
    // 1. Seed the backend from legacy localStorage where it has nothing yet.
    for (const { ns, key } of LEGACY) {
      const existing = await storage.get(ns);
      if (existing === null || existing === undefined) {
        const legacy = readLegacy(key);
        if (legacy !== null) await saveConfig(ns, legacy, { version: versionOf(ns) });
      }
    }
    // 2. Pull the core namespaces + any per-provider override files into the cache.
    const keys = await storage.keys();
    const nsList = new Set(CORE_NAMESPACES);
    for (const k of keys) if (k.startsWith("providers/")) nsList.add(k);
    await Promise.all(
      [...nsList].map(async (ns) => {
        cache.set(ns, await loadConfig(ns, { version: versionOf(ns) }));
      }),
    );
    hydrated = true;
    hydrating = null;
  })();
  return hydrating;
}

/** @returns {boolean} Whether the cache has finished its initial load. */
export function isHydrated() {
  return hydrated;
}

/**
 * Synchronous read of a namespace's cached data.
 * @param {string} ns The namespace.
 * @returns {object|null} The cached data, or null if not loaded.
 */
export function getCached(ns) {
  return cache.has(ns) ? cache.get(ns) : null;
}

/**
 * Synchronous write: update the cache now, persist to the backend in the background. Returns the
 * persistence promise so callers that care (e.g. tests, or a "clear all") can await it; the app's
 * stores fire-and-forget.
 * @param {string} ns The namespace.
 * @param {object} data The data to store (the version wrapper is added on persist).
 * @returns {Promise<void>} The background persistence promise.
 */
export function setCached(ns, data) {
  cache.set(ns, data);
  lastWriteAt = Date.now();
  return saveConfig(ns, data, { version: versionOf(ns) }).catch(() => {});
}

/**
 * Milliseconds since the last cache write (settings/provider params). The file-watch reload uses
 * this to skip change events triggered by the app's own saves.
 * @returns {number} Elapsed ms since the last {@link setCached}/{@link removeCached}.
 */
export function msSinceLastWrite() {
  return Date.now() - lastWriteAt;
}

/**
 * Re-pull the core + per-provider namespaces from the backend into the cache (no legacy seeding).
 * Used by the local-mode file-watch to reflect an EXTERNAL edit to the user-settings folder. Reads
 * are best-effort per namespace, so a transient/partial read can't blank the others.
 * @returns {Promise<void>}
 */
export async function rehydrate() {
  if (!hydrated) return hydrate();
  const keys = await storage.keys();
  const nsList = new Set(CORE_NAMESPACES);
  for (const k of keys) if (k.startsWith("providers/")) nsList.add(k);
  await Promise.all(
    [...nsList].map(async (ns) => {
      const data = await loadConfig(ns, { version: versionOf(ns) });
      if (data !== null && data !== undefined) cache.set(ns, data);
    }),
  );
}

/**
 * Synchronous delete: drop from the cache and the backend.
 * @param {string} ns The namespace.
 * @returns {Promise<void>} The background removal promise.
 */
export function removeCached(ns) {
  cache.delete(ns);
  lastWriteAt = Date.now();
  return removeConfig(ns).catch(() => {});
}

/** @returns {string[]} Every namespace currently in the cache. */
export function cachedKeys() {
  return [...cache.keys()];
}

/**
 * Reset the in-memory cache (test helper / hard "clear all" support). Does not touch the backend.
 * @returns {void}
 */
export function resetCache() {
  cache.clear();
  hydrated = false;
  hydrating = null;
}
