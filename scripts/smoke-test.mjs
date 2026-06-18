// Import smoke test — the project's headless verification (no server, no network).
//
// Loads the whole ES-module graph the same way `server.js` boots it, which forces every
// dynamic prompt to load via `require(ESM)` (the createRequire path — see
// notes/reference/esm-patterns.md), then expands one full prompt suggestion. If the module
// graph or any dynamic prompt is broken, this fails fast with a non-zero exit.
//
// Run:  npm run smoke   (or: node scripts/smoke-test.mjs)

import common from "../src/common.js";
import promptFiles from "../src/promptFilesAndSuggestions.js";

const { settings } = common;

promptFiles.init(settings);
promptFiles.loadAll();

const prompt = promptFiles.promptSuggestion(true);

if (typeof prompt !== "string" || prompt.trim().length === 0) {
  console.error("smoke-test FAILED: promptSuggestion() returned an empty result");
  process.exit(1);
}

console.log("smoke-test OK — ES module graph + all dynamic prompts loaded; expanded prompt:");
console.log("  " + prompt);
