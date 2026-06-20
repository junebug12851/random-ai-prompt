/* Copyright 2026 junebug12851 — Apache-2.0.
 * Preprocess the danbooru atomics into real SFW and NSFW files (no runtime
 * filtering). For each danbooru/d/<x>.txt: SFW lines stay; NSFW lines (per the
 * contentSafety lexicon) move to danbooru/d-nsfw/<x>.txt.
 *   node scripts/list-cleanup/split-danbooru-nsfw.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isNsfw } from "../../src/contentSafety.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dDir = path.resolve(__dirname, "..", "..", "data", "lists", "danbooru", "d");
const sfwDir = path.resolve(__dirname, "..", "..", "data", "lists", "danbooru", "d-sfw");
fs.mkdirSync(sfwDir, { recursive: true });

// Leave the full danbooru/d/<x> lists intact (gated). Write a PREPROCESSED
// SFW-only copy to danbooru/d-sfw/<x> that the danbooru-sfw group reads directly
// — so the clean list is real files, never filtered at runtime.
for (const f of fs.readdirSync(dDir).filter((f) => f.endsWith(".txt"))) {
  const lines = fs.readFileSync(path.join(dDir, f), "utf8").split(/\r?\n/).filter((l) => l.trim() !== "");
  const sfw = lines.filter((l) => !isNsfw(l));
  fs.writeFileSync(path.join(sfwDir, f), sfw.join("\n") + "\n");
  console.log(`${f}: ${lines.length} -> d-sfw/${f} ${sfw.length} (${lines.length - sfw.length} nsfw dropped)`);
}
