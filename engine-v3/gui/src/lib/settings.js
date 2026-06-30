/**
 * The browser-local (localStorage) settings store: the defaults, load/save, and the
 * `useSettings` React hook. Prompt-knob names match the engine's settings; BYOK keys
 * live here too and never leave the browser except per-request.
 * @module gui/lib/settings
 */
import { useEffect, useState } from "react";
import { getCached, setCached, cachedKeys } from "../../storage/cache.js";

// Settings persist through the storage layer (see gui/storage/): a real file in the one
// user-settings folder when running locally, and localStorage ONLY in the online build. No
// accounts, no server storage. BYOK API keys are part of settings and likewise never leave the
// machine except when sent per-request to the generation proxy.
//
// The prompt-knob field names match the engine's settings (settings.js) so they flow straight into
// prompt generation; image params are read by the providers. Per-provider params don't live inside
// this blob on disk — they're fanned out to one override file per provider (`providers/<id>`),
// mirroring each provider's own `<id>.json` defaults — and reassembled into `providerParams` here.
const SETTINGS_NS = "settings";
const PROVIDER_PREFIX = "providers/";

/**
 * @constant {object} The default SPA settings (prompt knobs match the engine; image
 *   params are read by the providers).
 */
export const defaultSettings = {
  // UI language. "auto" follows the browser; otherwise a supported locale code
  // (see gui/src/i18n/config.js). Persisted here like any other preference.
  locale: "auto",

  // Prompt
  prompt: "{#random-words}",
  promptCount: 1,
  mode: "StableDiffusion", // StableDiffusion | NovelAI | Midjourney

  // Content rating. The whole app defaults to SFW; NSFW (adult) content is gated
  // by the engine on this flag (see core/listStore.js, core/stages/*). The header
  // toggle flips it, and turning it ON requires an explicit confirmation.
  includeAdult: false,

  // Keyword counts
  keywordCount: 5,
  keywordMaxCount: 7,

  // Keyword/artist source lists ("false" = fully random from the dictionaries)
  keywordsFilename: "keyword",
  artistFilename: "artist",

  // Emphasis
  keywordEmphasis: true,
  emphasisChance: 0.25,
  emphasisLevelChance: 0.25,
  emphasisMaxLevels: 3,
  deEmphasisChance: 0.25,

  // Editing (add/swap/remove keywords mid-generation)
  keywordEditing: true,
  keywordEditingMin: 2,
  keywordEditingMax: 4,

  // Alternating (hybrid keywords)
  keywordAlternating: true,
  keywordAlternatingMaxLevels: 2,

  // Artists / auto-append — off by default; artists & fx are expressed in the prompt (DPL)
  // rather than auto-injected by counts. The keys remain so the engine has values to read.
  includeArtist: false,
  minArtist: 0,
  maxArtist: 2,
  // Frame artists as "by <artist>" and styles as "in the style of <style>" in the generated prompt.
  naturalArtistStyle: true,
  autoAddArtists: false,
  autoAddFx: false,
  promptSalt: false,
  promptSaltStart: -1,
  noAnd: false,

  // List behaviour
  listEntriesUsedOnce: true,
  reloadListsOnPromptChange: true,

  // Generation / providers. Default to Plain text: it needs no machine, key, or network — it just
  // copies a plain-text prompt — so it's the one provider that works for everyone out of the box
  // (local SD engines or BYOK APIs are opt-in from the header Providers menu).
  generateImages: false,
  provider: "plain",
  localWebuiUrl: "http://127.0.0.1:7860",
  keys: {}, // { [providerId]: "sk-..." } — kept in this browser only
  // Per-provider knobs, namespaced so switching providers never clobbers another's values.
  // Filled from each provider's own settings schema (gui/providers/<id>/settings.js).
  providerParams: {}, // { [providerId]: { ...params } }

  // Auto-fix: a text provider (OpenAI/Gemini/Grok) that rewrites the prompt before image gen.
  // "none" = off (and the prompt-box toggles are hidden). `autoFix` is the prose clean-up toggle;
  // `autoKeyword` is the keyword/tag-list toggle. They're independent and chain (fix → keyword).
  rewriteProvider: "none",
  autoFix: false,
  autoKeyword: false,

  // Image params
  sampler: "Euler",
  imageSteps: 32,
  imageWidth: 512,
  imageHeight: 512,
  cfg: 11,
  seed: -1,
  restoreFaces: false,
  negativePrompt: "",
};

// The anime ("d-keyword"/"d-artist") word lists are Danbooru tag dumps that mix
// SFW and explicit adult tags with no clean separation. The Style toggle that
// selected them was removed pending a proper SFW/adult split (see
// notes/plans/removed-pending-readd.md). This migration pulls any browser that
// was left on those lists back to the safe defaults so no one is stranded on
// adult content with no UI to switch off.
function migrate(settings) {
  const s = { ...settings };
  if (s.keywordsFilename === "d-keyword" || s.keywordsFilename === "d/keyword")
    s.keywordsFilename = "keyword";
  if (s.artistFilename === "d-artist" || s.artistFilename === "d/artist")
    s.artistFilename = "artist";
  // The generic "Local Stable Diffusion WebUI" entry was retired; Forge is the same sdapi.
  if (s.provider === "local-webui") s.provider = "forge";
  return s;
}

/**
 * The settings from the storage cache merged over the defaults, with `providerParams` reassembled
 * from the per-provider override namespaces. Requires the cache to be hydrated first (the app gates
 * its first render on {@link module:gui/storage/cache.hydrate}); before that it returns the defaults.
 * @returns {object} The effective settings.
 */
export function loadSettings() {
  const base = getCached(SETTINGS_NS);
  const merged = migrate({ ...defaultSettings, ...(base || {}) });
  // Reassemble providerParams from each `providers/<id>` override file.
  const providerParams = {};
  for (const ns of cachedKeys()) {
    if (!ns.startsWith(PROVIDER_PREFIX)) continue;
    const params = getCached(ns);
    if (params && Object.keys(params).length) providerParams[ns.slice(PROVIDER_PREFIX.length)] = params;
  }
  merged.providerParams = providerParams;
  return merged;
}

/**
 * Persist settings through the storage layer: the main blob (minus `providerParams`) to the
 * `settings` namespace, and each provider's params to its own `providers/<id>` override file. In
 * local mode these are real files in the user-settings folder; online they're localStorage keys.
 * @param {object} settings The settings to save.
 * @returns {void}
 */
export function saveSettings(settings) {
  const { providerParams = {}, ...rest } = settings;
  setCached(SETTINGS_NS, rest);
  for (const [id, params] of Object.entries(providerParams)) {
    setCached(`${PROVIDER_PREFIX}${id}`, params || {});
  }
}

/**
 * React hook: settings state that auto-persists to localStorage on every change.
 * @returns {Array} `[settings, setSettings]` — the state and its setter.
 */
// React hook: settings state that auto-persists to localStorage on change.
export function useSettings() {
  const [settings, setSettings] = useState(loadSettings);
  useEffect(() => saveSettings(settings), [settings]);
  return [settings, setSettings];
}
