/**
 * Server-side provider dispatch — shared by BOTH proxy entry points (the Netlify function
 * online, the Vite dev-middleware locally). Maps a `providerId` to that provider's
 * `code/server.js` adapter and runs it with the per-request key + params. Only hosted
 * (`transport: "hosted-proxy"`) providers have a server adapter; local-direct providers
 * never hit this path (the browser calls them itself).
 *
 * The map is explicit (not a glob) because this runs in a plain Node function bundle, not
 * the Vite browser pipeline. Add a hosted provider → import its server adapter here.
 * @module gui/server/dispatch
 */
import openaiServer from "../providers/openai/code/server.js";
import replicateServer from "../providers/replicate/code/server.js";
import falServer from "../providers/fal/code/server.js";
import stabilityServer from "../providers/stability/code/server.js";

/** @type {Record<string, (args: object) => Promise<{images: string[]}>>} */
export const serverAdapters = {
  openai: openaiServer,
  replicate: replicateServer,
  fal: falServer,
  stability: stabilityServer,
};

/**
 * Dispatch a generation request to the right provider's server adapter.
 * @param {object} req
 * @param {string} req.providerId The provider id.
 * @param {string} req.prompt The expanded prompt.
 * @param {string} req.key The BYOK API key (per-request, never stored/logged).
 * @param {object} [req.params] Provider params.
 * @returns {Promise<{images: string[]}>}
 * @throws {Error} If the provider is unknown or the key is missing.
 */
export async function dispatch({ providerId, prompt, key, params }) {
  const adapter = serverAdapters[providerId];
  if (!adapter) throw new Error(`No server adapter for provider "${providerId}".`);
  if (!key) throw new Error("Missing API key.");
  return adapter({ prompt, key, params });
}
