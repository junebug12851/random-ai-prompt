#!/usr/bin/env node
/**
 * @file
 * @brief `prompt` CLI entry point. Registers the JSON-attribute ESM hook (so the shared provider
 * adapters' bare `.json` imports load under Node), then hands off to src/main.js. Kept tiny so the
 * shebang file rarely changes.
 */
import { register } from "node:module";

// Inject `type: json` for `.json` imports before any provider code is dynamically imported. Must run
// before the first provider `loadSettings()` / `loadFormat()` call. See src/lib/jsonLoader.mjs.
register("../src/lib/jsonLoader.mjs", import.meta.url);

const { run } = await import("../src/main.js");

run(process.argv).catch((err) => {
  // Last-resort guard: main() handles expected errors and sets the exit code itself; this only
  // catches truly unexpected throws so the process still exits non-zero with a readable message.
  process.exitCode = 1;
  console.error(err && err.stack ? err.stack : String(err));
});
