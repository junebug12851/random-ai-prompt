/**
 * The web target's view of the shared provider registry (`targets/shared/`).
 *
 * The registry itself is **runtime-agnostic** — it's shared verbatim with the CLI and the mobile
 * target, so it can't read `import.meta.env`. The *online build* gating is web-only, so it lives
 * here: this module binds the shared registry's `providersFor(online)` to this build's
 * {@link ONLINE} flag and re-exports the familiar zero-arg API the SPA has always used.
 * @module gui/lib/providers
 */
import {
  providers,
  providersFor,
  findProvider,
  rewriteProviders as sharedRewriteProviders,
  upscaleProviders as sharedUpscaleProviders,
  DIALECTS,
  engineModeFor,
} from "../../../../shared/index.js";
import { ONLINE } from "../online.js";

/**
 * The providers usable in this build. The online build is a static site with no backend, so
 * local-direct and hosted-proxy providers are excluded (the UI shows them disabled).
 * @returns {object[]} The available providers.
 */
export function availableProviders() {
  return providersFor(ONLINE);
}

/**
 * Resolve a provider by id — against the full pool, so a provider that's unavailable in this build
 * still resolves and can be rendered disabled — falling back to the first available one.
 * @param {string} id The provider id.
 * @returns {object|undefined} The matching provider, or the first available one.
 */
export function getProvider(id) {
  return findProvider(id, availableProviders());
}

/** @returns {object[]} Providers that can rewrite a prompt (auto-fix / keyword-translate). */
export function rewriteProviders() {
  return sharedRewriteProviders();
}

/** @returns {object[]} Providers that can upscale an image. */
export function upscaleProviders() {
  return sharedUpscaleProviders();
}

export { providers, ONLINE, DIALECTS, engineModeFor };
