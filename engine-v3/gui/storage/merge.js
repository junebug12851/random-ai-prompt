/**
 * Pure merge utilities for the config layer — the "effortless settings" core. `deepMerge`
 * layers a sparse override over a base (so a user file holds only the keys it changes);
 * `diff` is the inverse (extract just what an object changes vs. a base) so override files
 * stay small and survive default changes. Isomorphic and dependency-free; never mutates inputs.
 * @module gui/storage/merge
 */

/**
 * A plain JSON object (not an array, Date, null, or class instance). Only these are merged
 * recursively; everything else is treated as an atomic leaf the override replaces wholesale.
 * @param {*} v The value to test.
 * @returns {boolean} True for a plain `{}`-style object.
 */
export function isPlainObject(v) {
  if (v === null || typeof v !== "object" || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

/**
 * Deep-merge a sparse `override` onto `base`, returning a fresh value (inputs untouched).
 *
 * Semantics (see notes/plans/storage-and-settings.md):
 * - Plain objects merge recursively (override wins per leaf key).
 * - Arrays replace the base wholesale by default; pass `{ arrays: "concat" }` to union them.
 * - Scalars / type mismatches / explicit `null` in the override win (so `null` clears a default).
 * - `undefined` in the override means "not set" ⇒ the base value is kept.
 *
 * @param {*} base The defaults (lower layer).
 * @param {*} override The sparse patch (upper layer).
 * @param {{arrays?: ("replace"|"concat")}} [opts] Merge options.
 * @returns {*} A new merged value.
 */
export function deepMerge(base, override, opts = {}) {
  const arrays = opts.arrays === "concat" ? "concat" : "replace";

  if (override === undefined) return clone(base);

  if (Array.isArray(base) && Array.isArray(override)) {
    return arrays === "concat" ? [...base, ...override].map(clone) : override.map(clone);
  }

  if (isPlainObject(base) && isPlainObject(override)) {
    const out = {};
    for (const k of Object.keys(base)) out[k] = clone(base[k]);
    for (const k of Object.keys(override)) {
      if (override[k] === undefined) continue; // "not set" — keep the base value
      out[k] = k in base ? deepMerge(base[k], override[k], opts) : clone(override[k]);
    }
    return out;
  }

  // Scalar, array-vs-object mismatch, null, Date, etc.: the override is authoritative.
  return clone(override);
}

/**
 * The sparse diff of `value` against `base`: the minimal object that, deep-merged onto `base`,
 * reproduces `value`. Keys equal to the base are omitted; keys present in `base` but missing from
 * `value` are emitted as `null` (an explicit "clear"). Used to store only what an override changes.
 *
 * @param {*} base The defaults.
 * @param {*} value The full object to reduce to a patch.
 * @returns {*} The sparse patch (may be `{}` when nothing differs).
 */
export function diff(base, value) {
  if (!isPlainObject(base) || !isPlainObject(value)) {
    return equal(base, value) ? undefined : clone(value);
  }
  const out = {};
  for (const k of Object.keys(value)) {
    if (!(k in base)) {
      if (value[k] !== undefined) out[k] = clone(value[k]);
      continue;
    }
    const d = diff(base[k], value[k]);
    // Skip a nested patch that came back empty (`{}`) — it means that subtree didn't change.
    if (d === undefined) continue;
    if (isPlainObject(d) && Object.keys(d).length === 0) continue;
    out[k] = d;
  }
  // A key the defaults have but the value dropped ⇒ explicit null so the merge clears it.
  for (const k of Object.keys(base)) {
    if (!(k in value)) out[k] = null;
  }
  return out;
}

/**
 * Structural JSON equality (order-independent for object keys, order-sensitive for arrays).
 * @param {*} a First value.
 * @param {*} b Second value.
 * @returns {boolean} True when the two are deeply equal as JSON.
 */
export function equal(a, b) {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((x, i) => equal(x, b[i]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    return ka.length === kb.length && ka.every((k) => k in b && equal(a[k], b[k]));
  }
  return false;
}

/**
 * A structured deep clone of JSON-ish data (objects/arrays/primitives). Keeps the merge pure.
 * @param {*} v The value to clone.
 * @returns {*} A deep copy.
 */
function clone(v) {
  if (Array.isArray(v)) return v.map(clone);
  if (isPlainObject(v)) {
    const out = {};
    for (const k of Object.keys(v)) out[k] = clone(v[k]);
    return out;
  }
  return v; // primitives (and atomic non-plain objects) are passed through
}
