import { useEffect, useState } from "react";

// Settings live ONLY in this browser (localStorage). No accounts, no server
// storage. BYOK API keys are part of settings and likewise never leave the
// browser except when sent per-request to the generation proxy.
const STORAGE_KEY = "rap.settings.v1";

export const defaultSettings = {
  // Prompt
  prompt: "#random",
  keywordCount: 5,
  keywordMaxCount: 7,
  promptCount: 1,

  // Generation
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
