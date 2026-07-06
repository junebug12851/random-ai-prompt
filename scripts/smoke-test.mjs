/**
 * @file
 * @brief The import smoke test (`npm run smoke`) — the project's headless verification gate.
 */
// Import smoke test — the project's headless verification (no server, no network).
//
// Boots the active core path the way the SPA's Node-side loader does: configure
// `promptFilesAndSuggestions` with the fs `nodeLoader` (the createRequire path that
// forces every dynamic prompt to load via require(ESM) — see
// notes/reference/esm-patterns.md), load the catalog, then expand one full prompt
// suggestion. If the module graph or any dynamic prompt is broken, this fails fast
// with a non-zero exit.
//
// Run:  npm run smoke   (or: node scripts/smoke-test.mjs)

import promptFiles from "../engine/promptFilesAndSuggestions.js";
import { nodeLoader } from "../engine/core/nodeLoader.js";
import baseSettings from "../engine/settings.js";

// The suggestion builder reads the catalog from the filesystem on the Node side.
promptFiles.configure(nodeLoader);

// Minimal settings accessor — promptFiles only reads settings().settings during
// suggestion gating/cleanup (e.g. includeAdult). The engine defaults suffice here.
promptFiles.init(() => ({ settings: baseSettings, imageSettings: {}, upscaleSettings: {} }));

promptFiles.loadAll();

const prompt = promptFiles.promptSuggestion(true);

if (typeof prompt !== "string" || prompt.trim().length === 0) {
  console.error("smoke-test FAILED: promptSuggestion() returned an empty result");
  process.exit(1);
}

console.log("smoke-test OK — ES module graph + all dynamic prompts loaded; expanded prompt:");
console.log("  " + prompt);
