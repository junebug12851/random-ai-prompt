// The browser prompt engine — the real one.
//
// This wires the SPA to the shared, framework-agnostic engine in repo-root core/
// using the Vite import.meta.glob browser loader (which bundles every dynamic
// prompt + the lists/ and expansions/ text data at build time). The exact same
// engine runs in Node via the node loader. See notes/plans/web-migration.md.
import { createEngine } from "../../../core/engine.js";
import { browserLoader } from "../../../core/browserLoader.js";
import promptFiles from "../../../src/promptFilesAndSuggestions.js";

// The #random / #simple-random prompts use the loader-injected suggestion
// builder (a shared singleton). Point it at the browser loader before any
// generation runs.
promptFiles.configure(browserLoader);

const engine = createEngine(browserLoader);

export function generatePrompt(settings) {
  return engine.generate(settings);
}

export function generatePrompts(settings) {
  return engine.generateMany(settings);
}

// Expand a specific prompt string through the full pipeline (used for the
// Builder's live preview). Overrides the prompt but keeps all other settings.
export function expandPrompt(prompt, settings) {
  return engine.generate({ ...settings, prompt });
}
