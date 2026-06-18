import { useEffect, useState } from "react";

// Settings live ONLY in this browser (localStorage). No accounts, no server
// storage. BYOK API keys are part of settings and likewise never leave the
// browser except when sent per-request to the generation proxy.
//
// The prompt-knob field names match the engine's settings (settings.js) so they
// flow straight into prompt generation; image params are read by the providers.
const STORAGE_KEY = "rap.settings.v2";

export const defaultSettings = {
  // Prompt
  prompt: "#random",
  promptCount: 1,
  mode: "StableDiffusion", // StableDiffusion | NovelAI | Midjourney

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

  // Artists
  includeArtist: true,
  minArtist: 0,
  maxArtist: 2,

  // Auto-append + salt
  autoAddArtists: true,
  autoAddFx: true,
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

export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultSettings };
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    return { ...defaultSettings };
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore quota / private-mode write failures — settings are best-effort.
  }
}

// React hook: settings state that auto-persists to localStorage on change.
export function useSettings() {
  const [settings, setSettings] = useState(loadSettings);
  useEffect(() => saveSettings(settings), [settings]);
  return [settings, setSettings];
}
