/**
 * Versioned config documents over the active {@link module:gui/storage StorageBackend}.
 *
 * Every stored document is wrapped `{ __v: <int>, ...data }`. On load, a document older than the
 * caller's target `version` is run forward through its migration steps and re-saved, so an old file
 * heals itself once and a user's settings are upgraded rather than dropped. `loadCascade` layers a
 * migrated user document over a `defaults` object (the provider-settings pattern: ship defaults,
 * store only the user's diff). Pure of any one backend — it calls through `storage`, so it works the
 * same online (localStorage) and locally (disk).
 * @module gui/storage/config
 */
import { storage } from "./index.js";
import { deepMerge, diff } from "./merge.js";

/** The wrapper key carrying a document's schema version. */
export const VERSION_KEY = "__v";

/**
 * @typedef {object} ConfigSpec
 * @property {number} [version] Target schema version (default 1).
 * @property {Record<number, (data: object) => object>} [migrate] Map of `fromVersion → step`.
 *   A step upgrades a document at `fromVersion` to `fromVersion + 1`. Steps run in order until the
 *   document reaches `version`. A bare legacy value (no `__v`) is treated as version 0.
 * @property {("replace"|"concat")} [arrays] Array-merge strategy for {@link loadCascade}.
 */

/**
 * Split a stored wrapper into `{ version, data }`. A non-object or a `null` ⇒ version 0, empty data.
 * A bare object without `__v` is legacy data at version 0.
 * @param {*} raw The raw stored value.
 * @returns {{version: number, data: object}}
 */
function unwrap(raw) {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return { version: 0, data: {} };
  }
  if (Object.prototype.hasOwnProperty.call(raw, VERSION_KEY)) {
    const { [VERSION_KEY]: v, ...data } = raw;
    return { version: Number.isInteger(v) ? v : 0, data };
  }
  return { version: 0, data: { ...raw } };
}

/**
 * Apply ordered migration steps to bring `data` from `fromVersion` up to `toVersion`.
 * Missing steps are identity (a version bump with no shape change is allowed).
 * @param {object} data The document data.
 * @param {number} fromVersion Its current version.
 * @param {number} toVersion The target version.
 * @param {Record<number, (data: object) => object>} migrate The step map.
 * @returns {object} The upgraded data.
 */
function runMigrations(data, fromVersion, toVersion, migrate) {
  let out = data;
  for (let v = fromVersion; v < toVersion; v++) {
    const step = migrate && migrate[v];
    if (typeof step === "function") out = step(out) || out;
  }
  return out;
}

/**
 * Load a namespace as upgraded data (migrating + healing the stored file if it was stale).
 * @param {string} ns The namespace key.
 * @param {ConfigSpec} [spec] Version + migrations.
 * @returns {Promise<object>} The document data at the target version (`{}` if absent).
 */
export async function loadConfig(ns, spec = {}) {
  const version = spec.version ?? 1;
  const raw = await storage.get(ns);
  const had = raw !== null && raw !== undefined;
  const { version: storedV, data } = unwrap(raw);
  const upgraded = storedV < version ? runMigrations(data, storedV, version, spec.migrate) : data;
  // Heal the on-disk doc once if it existed but was an older version (don't create files for
  // namespaces the user never touched).
  if (had && storedV < version) {
    await storage.set(ns, { [VERSION_KEY]: version, ...upgraded });
  }
  return upgraded;
}

/**
 * Persist a namespace's data, stamping the target version.
 * @param {string} ns The namespace key.
 * @param {object} data The document data (without the version wrapper).
 * @param {ConfigSpec} [spec] Version (for the stamp).
 * @returns {Promise<void>}
 */
export async function saveConfig(ns, data, spec = {}) {
  const version = spec.version ?? 1;
  await storage.set(ns, { [VERSION_KEY]: version, ...data });
}

/**
 * Load a namespace and layer it over `defaults` (defaults-then-user-override cascade). The stored
 * document is migrated first; the result is `deepMerge(defaults, userData)`.
 * @param {string} ns The namespace key (the user override).
 * @param {object} defaults The lower layer (e.g. a provider's shipped defaults).
 * @param {ConfigSpec} [spec] Version, migrations, array strategy.
 * @returns {Promise<object>} The merged config.
 */
export async function loadCascade(ns, defaults, spec = {}) {
  const userData = await loadConfig(ns, spec);
  return deepMerge(defaults || {}, userData, { arrays: spec.arrays });
}

/**
 * Save a cascade override as the **diff** vs. `defaults` (only the keys the user actually changed),
 * so override files stay small and resilient when defaults change later.
 * @param {string} ns The namespace key.
 * @param {object} defaults The lower layer the value is diffed against.
 * @param {object} value The full effective config to reduce to a patch and store.
 * @param {ConfigSpec} [spec] Version (for the stamp).
 * @returns {Promise<void>}
 */
export async function saveCascade(ns, defaults, value, spec = {}) {
  const patch = diff(defaults || {}, value || {});
  await saveConfig(ns, patch || {}, spec);
}

/**
 * Remove a namespace's stored document.
 * @param {string} ns The namespace key.
 * @returns {Promise<void>}
 */
export async function removeConfig(ns) {
  await storage.remove(ns);
}
