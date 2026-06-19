/**
 * The modular image-generation provider registry. Each provider implements
 * `{ id, label, local, needsKey, generate({prompt, settings, key, signal}) }`; add a
 * hosted backend by dropping a module here and registering it.
 * @module web-app/lib/providers
 */
import { localWebuiProvider } from "./localWebui.js";
import { hostedProxyProvider } from "./hostedProxy.js";

// Image-generation providers are modular (the same plugin pattern the dynamic
// prompts use). Each provider implements:
//
//   id: string
//   label: string
//   local: boolean      // needs the user's local machine; hidden in online mode
//   needsKey: boolean   // requires a BYOK API key
//   generate({ prompt, settings, key, signal }) -> Promise<{ images: string[] }>
//       images: URLs (data: or blob:) the browser can display directly
//
// Add a new hosted backend by dropping a module here and registering it below.
export const providers = [localWebuiProvider, hostedProxyProvider];

// `online` is true when the app is deployed (no local machine). In that mode the
// local-only providers are filtered out. Driven by a Vite env var so one codebase
// serves both online and local builds.
export const ONLINE = import.meta.env.VITE_ONLINE === "true";

/**
 * @returns {object[]} The providers usable in the current mode (local-only providers
 *   are hidden when `ONLINE`).
 */
export function availableProviders() {
  return ONLINE ? providers.filter((p) => !p.local) : providers;
}

/**
 * @param {string} id The provider id.
 * @returns {object} The matching provider, or the first available one.
 */
export function getProvider(id) {
  return providers.find((p) => p.id === id) || availableProviders()[0];
}
