/* Copyright 2026 junebug12851 — Apache-2.0.
 * Split the one danbooru list that genuinely mixes (d/general) into EXCLUSIVE
 * sfw + nsfw files. The "full" version is the d/general-all group (imports both).
 * No duplication. Other danbooru atomics stay whole (too little/no nsfw to split).
 *   node scripts/list-cleanup/split-general.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isNsfw } from "../../src/contentSafety.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dDir = path.resolve(__dirname, "..", "..", "data", "lists", "danbooru", "d");
const full = fs.readFileSync(path.join(dDir, "general.txt"), "utf8").split(/\r?\n/).filter((l) => l.trim() !== "");
const sfw = full.filter((l) => !isNsfw(l));
const nsfw = full.filter((l) => isNsfw(l));
fs.writeFileSync(path.join(dDir, "general.txt"), sfw.join("\n") + "\n"); // sfw-exclusive
fs.writeFileSync(path.join(dDir, "general-nsfw.txt"), nsfw.join("\n") + "\n"); // nsfw-exclusive
console.log(`d/general: ${full.length} -> sfw ${sfw.length} + nsfw ${nsfw.length} (general-nsfw)`);
