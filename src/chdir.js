/**
 * @file
 * @brief Side-effect module: process.chdir to the repo root (the parent of src/). MUST be imported before any module that reads a cwd-relative file. Notes: notes/reference/esm-patterns.md.
 */

// Side-effect module: make every relative path in the app resolve from the
// project root, no matter where `node` was launched from. This MUST be imported
// before any module that reads cwd-relative files (settings loading, output
// folder, lists, etc.). With ES modules, importing this first guarantees the
// chdir runs before those modules evaluate.
//
// This file lives in src/, so the project root is its PARENT directory. The
// runtime data that stays at the root (./output, ./user-settings.json,
// ./results.json) and the prompt content under ./data resolve from there.
import path from "node:path";

process.chdir(path.join(import.meta.dirname, ".."));
