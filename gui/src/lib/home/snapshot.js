/**
 * @file Image-sidecar settings snapshot helper for the Home composer. Produces the clean,
 * provider-scoped settings object written next to each generated image.
 */

// App-orchestration keys that don't describe HOW an image was made — kept out of the sidecar's
// settings snapshot so the single view's details table reflects only the provider's own knobs
// (e.g. an OpenAI image shouldn't carry another provider's sampler/steps from `providerParams`).
const SNAPSHOT_DROP = new Set([
  "keys", "providerParams", "prompt", "promptCount", "locale", "includeAdult", "autoFix",
  "autoKeyword", "autoAddFx", "autoAddArtists", "rewriteProvider", "wrapper", "wrapperName",
  "wrapperParams", "useAutoSections", "provider",
]);

/**
 * A clean, provider-scoped settings snapshot for an image sidecar: scalar provider knobs only,
 * with app-orchestration keys, nested objects (like `providerParams`), and empties dropped.
 * @param {object} obj The flattened settings (`flat` + the final negative prompt).
 * @returns {object} The trimmed snapshot.
 */
export function cleanSnapshot(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SNAPSHOT_DROP.has(k)) continue;
    if (v === null || v === undefined || v === "") continue;
    if (typeof v === "object" || typeof v === "function") continue;
    out[k] = v;
  }
  return out;
}
