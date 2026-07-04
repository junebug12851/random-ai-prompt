/**
 * Shared provider setting: **batch chunk size** (per-provider request concurrency).
 *
 * This is the first entry in the shared-settings system (see `./index.js`): a setting declared ONCE
 * and injected into every applicable provider's schema, rather than copied into 40 provider folders.
 * When a run fires many requests at once (1000 prompts each auto-generating an image batch, a bulk
 * upscale, mass prompt-rewrites), this is how many actually go in flight to *this* provider at a
 * time; the rest queue with their placeholder already showing and stream in as slots free up.
 *
 * It's per-provider because the right number differs wildly: a local engine (ComfyUI / Forge) can
 * take many in parallel, while a hosted API is rate-limited and the browser itself caps concurrent
 * requests to one host (~6). It applies independently to image, text (rewrite), and upscale
 * providers, so switching a provider carries its own sensible limit instead of thrashing an API.
 *
 * A provider may override the metadata default by declaring `concurrencyDefault` in its `config.js`
 * (or its own `concurrency` field/default in `settings.js`, which the injector leaves untouched).
 * @module gui/providers/_shared/settings/concurrency
 */

/** The field key + settable range. */
export const CONCURRENCY_KEY = "concurrency";
export const CONCURRENCY_MIN = 1;
export const CONCURRENCY_MAX = 64;

/**
 * Clamp a value to the settable concurrency range (integer, >= 1).
 * @param {number} n The candidate.
 * @returns {number}
 */
export function clampConcurrency(n) {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v)) return CONCURRENCY_MIN;
  return Math.max(CONCURRENCY_MIN, Math.min(CONCURRENCY_MAX, v));
}

/**
 * The default in-flight concurrency for a provider, derived from its transport/locality (overridable
 * via `config.concurrencyDefault` / `capabilities.concurrency`). Conservative for hosted APIs (rate
 * limits + the browser's ~6-per-host cap), generous for local engines.
 * @param {object} provider The provider manifest.
 * @returns {number} 1..CONCURRENCY_MAX.
 */
export function defaultConcurrencyFor(provider) {
  const explicit = Number(provider?.concurrencyDefault ?? provider?.capabilities?.concurrency);
  if (Number.isFinite(explicit) && explicit >= 1) return clampConcurrency(explicit);
  if (provider?.transport === "none") return 1; // no network (Plain text) — irrelevant, keep tiny
  if (provider?.local) return 6; // a local engine (ComfyUI/Forge/SDNext) can take several at once
  if (provider?.transport === "submit-poll") return 4; // async job queue — enqueue a few, poll
  return 3; // hosted API (browser-direct / hosted-proxy) — gentle on rate limits + the per-host cap
}

/**
 * The effective concurrency for a provider given its (namespaced) params — the user's saved value if
 * set, else the metadata default.
 * @param {object} provider The provider manifest.
 * @param {object} [params] The provider's params (`settings.providerParams[id]`, or flattened
 *   settings that fold those in).
 * @returns {number}
 */
export function effectiveConcurrency(provider, params) {
  const raw = params?.[CONCURRENCY_KEY];
  if (raw === undefined || raw === null || raw === "") return defaultConcurrencyFor(provider);
  return clampConcurrency(raw);
}

/**
 * The shared-setting descriptor consumed by the injector (see `./index.js`). Each shared setting
 * exports one of these as its default export.
 * @type {import("./index.js").SharedSetting}
 */
export default {
  key: CONCURRENCY_KEY,
  /**
   * Applies to any provider that fires requests worth limiting (generate / rewrite / upscale). Pure
   * copy-only tiers (Plain text / syntax formatters) don't, so they get no chunk size.
   * @param {object} provider The provider manifest.
   * @returns {boolean}
   */
  applies: (provider) =>
    !!(
      provider &&
      (provider.tier === "api" || provider.loadRewrite || provider.rewrite || provider.loadUpscale)
    ),
  /**
   * @param {object} provider The provider manifest.
   * @returns {number} The metadata-derived default for this provider.
   */
  defaultFor: (provider) => defaultConcurrencyFor(provider),
  /**
   * @returns {object} The schema field descriptor (rendered in the provider gear like any knob).
   */
  field: () => ({
    key: CONCURRENCY_KEY,
    label: "Batch chunk size",
    type: "number",
    min: CONCURRENCY_MIN,
    max: CONCURRENCY_MAX,
    info:
      "How many requests to this provider run at once when a big run fires many (e.g. 1000 prompts). " +
      "Every item shows a placeholder immediately; this many are in flight and the rest stream in as " +
      "slots free up. Raise it for a fast local engine; lower it for a rate-limited API or to stay " +
      "under the browser's per-host request cap.",
  }),
};
