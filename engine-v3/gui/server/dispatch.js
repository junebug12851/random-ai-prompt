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
import geminiServer from "../providers/gemini/code/server.js";
import grokServer from "../providers/grok/code/server.js";
import bflServer from "../providers/bfl/code/server.js";
import ideogramServer from "../providers/ideogram/code/server.js";
import leonardoServer from "../providers/leonardo/code/server.js";

/**
 * Unwrap a module's adapter to the callable function. Netlify's function bundler can hand an ESM
 * `export default` back as a namespace object (`{ default: fn }`) instead of the function itself,
 * so a plain default import isn't callable in the deployed bundle (it is locally, under native
 * ESM). Accept either shape. Without this, `dispatch` throws "adapter is not a function" online.
 * @param {Function|{default: Function}} m The imported adapter.
 * @returns {Function} The callable adapter.
 */
const asFn = (m) => (typeof m === "function" ? m : m?.default);

/** @type {Record<string, (args: object) => Promise<{images: string[]}>>} */
export const serverAdapters = {
  openai: asFn(openaiServer),
  replicate: asFn(replicateServer),
  fal: asFn(falServer),
  stability: asFn(stabilityServer),
  gemini: asFn(geminiServer),
  grok: asFn(grokServer),
  bfl: asFn(bflServer),
  ideogram: asFn(ideogramServer),
  leonardo: asFn(leonardoServer),
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

import replicateUpscaleServer from "../providers/replicate/code/upscale-server.js";
import deepaiUpscaleServer from "../providers/deepai/code/upscale-server.js";
import picsartUpscaleServer from "../providers/picsart/code/upscale-server.js";
import segmindUpscaleServer from "../providers/segmind/code/upscale-server.js";
import comfyuiUpscaleServer from "../providers/comfyui/code/upscale-server.js";
import veniceUpscaleServer from "../providers/venice/code/upscale-server.js";
import clipdropUpscaleServer from "../providers/clipdrop/code/upscale-server.js";
import wavespeedUpscaleServer from "../providers/wavespeed/code/upscale-server.js";
import claidUpscaleServer from "../providers/claid/code/upscale-server.js";
import deepimageUpscaleServer from "../providers/deepimage/code/upscale-server.js";
import neuralloveUpscaleServer from "../providers/neurallove/code/upscale-server.js";
import vanceaiUpscaleServer from "../providers/vanceai/code/upscale-server.js";

/**
 * Server-side AI-upscale adapters (the proxy path) — for providers the browser can't / shouldn't call
 * directly (CORS, or upscale-only enhancer services). Browser-direct upscalers (Stability, fal,
 * Leonardo) never hit this; they run client-side.
 * @type {Record<string, (args: object) => Promise<{images: string[]}>>}
 */
export const upscaleAdapters = {
  replicate: asFn(replicateUpscaleServer),
  deepai: asFn(deepaiUpscaleServer),
  picsart: asFn(picsartUpscaleServer),
  segmind: asFn(segmindUpscaleServer),
  comfyui: asFn(comfyuiUpscaleServer),
  venice: asFn(veniceUpscaleServer),
  clipdrop: asFn(clipdropUpscaleServer),
  wavespeed: asFn(wavespeedUpscaleServer),
  claid: asFn(claidUpscaleServer),
  deepimage: asFn(deepimageUpscaleServer),
  neurallove: asFn(neuralloveUpscaleServer),
  vanceai: asFn(vanceaiUpscaleServer),
};

/**
 * Dispatch an AI-upscale request to a provider's server-side upscale adapter.
 * @param {object} req `{ providerId, image (data URI), key, params }`.
 * @returns {Promise<{images: string[]}>} Upscaled image URL(s).
 * @throws {Error} If the provider has no upscale adapter or the key/image is missing.
 */
export async function dispatchUpscale({ providerId, image, key, params }) {
  const adapter = upscaleAdapters[providerId];
  if (!adapter) throw new Error(`No upscale adapter for provider "${providerId}".`);
  if (!key) throw new Error("Missing API key.");
  if (!image) throw new Error("Missing source image.");
  return adapter({ image, key, params });
}

import openaiRewrite from "../providers/openai/code/rewrite.js";
import geminiRewrite from "../providers/gemini/code/rewrite.js";
import grokRewrite from "../providers/grok/code/rewrite.js";
import { systemFor } from "../providers/_shared/rewriteSystem.js";
import { makeChatRewrite } from "../providers/_shared/openaiCompatRewrite.js";
import { anthropicRewrite, cohereRewrite } from "../providers/_shared/bespokeRewrite.js";

/**
 * Auto-fix text rewriters. OpenAI/Gemini/Grok have bespoke browser-direct adapters; the OpenAI-
 * compatible providers (DeepSeek, Mistral, Together, Perplexity — proxied because their browser CORS
 * isn't assured) share the generic `makeChatRewrite` factory, just a base URL + default model.
 * @type {Record<string, (args: object) => Promise<{text: string}>>}
 */
export const rewriteAdapters = {
  openai: asFn(openaiRewrite),
  gemini: asFn(geminiRewrite),
  grok: asFn(grokRewrite),
  deepseek: makeChatRewrite({ baseUrl: "https://api.deepseek.com", model: "deepseek-chat", label: "DeepSeek" }),
  mistral: makeChatRewrite({ baseUrl: "https://api.mistral.ai/v1", model: "mistral-small-latest", label: "Mistral" }),
  together: makeChatRewrite({
    baseUrl: "https://api.together.xyz/v1",
    model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    label: "Together",
  }),
  perplexity: makeChatRewrite({ baseUrl: "https://api.perplexity.ai", model: "sonar", label: "Perplexity" }),
  fireworks: makeChatRewrite({
    baseUrl: "https://api.fireworks.ai/inference/v1",
    model: "accounts/fireworks/models/llama-v3p3-70b-instruct",
    label: "Fireworks",
  }),
  cerebras: makeChatRewrite({ baseUrl: "https://api.cerebras.ai/v1", model: "llama-3.3-70b", label: "Cerebras" }),
  qwen: makeChatRewrite({
    baseUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    model: "qwen-plus",
    label: "Qwen",
  }),
  moonshot: makeChatRewrite({ baseUrl: "https://api.moonshot.ai/v1", model: "moonshot-v1-8k", label: "Moonshot" }),
  ai21: makeChatRewrite({ baseUrl: "https://api.ai21.com/studio/v1", model: "jamba-large", label: "AI21" }),
  anthropic: anthropicRewrite,
  cohere: cohereRewrite,
};

/**
 * Dispatch a prompt-rewrite request to the chosen text provider.
 * @param {object} req `{ providerId, prompt, key, mode }`. `mode` = `"keyword"` for the tag-list
 *   rewrite, anything else (default) for the prose auto-fix.
 * @returns {Promise<{text: string}>}
 * @throws {Error} If the provider can't rewrite or the key is missing.
 */
export async function dispatchRewrite({ providerId, prompt, key, mode }) {
  const adapter = rewriteAdapters[providerId];
  if (!adapter) throw new Error(`"${providerId}" can't rewrite prompts.`);
  if (!key) throw new Error("Missing API key for the rewrite provider.");
  return adapter({ prompt, key, system: systemFor(mode) });
}
