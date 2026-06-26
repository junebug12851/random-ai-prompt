/**
 * The browser-local (localStorage) settings store: the defaults, load/save, and the
 * `useSettings` React hook. Prompt-knob names match the engine's settings; BYOK keys
 * live here too and never leave the browser except per-request.
 * @module gui/lib/settings
 */
import { useEffect, useState } from "react";

// Settings live ONLY in this browser (localStorage). No accounts, no server
// storage. BYOK API keys are part of settings and likewise never leave the
// browser except when sent per-request to the generation proxy.
//
// The prompt-knob field names match the engine's settings (settings.js) so they
// flow straight into prompt generation; image params are read by the providers.
const STORAGE_KEY = "rap.settings.v2";

/**
 * @constant {object} The default SPA settings (prompt knobs match the engine; image
 *   params are read by the providers).
 */
export const defaultSettings = {
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
  autoAddArtists: false,
  autoAddFx: false,
  promptSalt: false,
  promptSaltStart: -1,
  noAnd: false,

  // List behaviour
  listEntriesUsedOnce: true,
  reloadListsOnPromptChange: true,

  // Generation / providers
  generateImages: false,
  provider: "local-webui",
  localWebuiUrl: "http://127.0.0.1:7860",
  keys: {}, // { [providerId]: "sk-..." } — kept in this browser only
  // Per-provider knobs, namespaced so switching providers never clobbers another's values.
  // Filled from each provider's own settings schema (gui/providers/<id>/settings.js).
  providerParams: {}, // { [providerId]: { ...params } }

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
  return s;
}

/**
 * @returns {object} The settings from localStorage merged over the defaults.
 */
export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultSettings };
    return migrate({ ...defaultSettings, ...JSON.parse(raw) });
  } catch {
    return { ...defaultSettings };
  }
}

/**
 * Persist settings to localStorage (best-effort; ignores quota / private-mode errors).
 * @param {object} settings The settings to save.
 * @returns {void}
 */
export function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore quota / private-mode write failures — settings are best-effort.
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
