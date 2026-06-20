/* Copyright 2026 junebug12851 — Apache-2.0.
 * Collapse the dictionary POS lists into the curated ones (one list per POS).
 * dict-misc becomes word/misc. Removes the dict-* files.
 *   node scripts/list-cleanup/merge-dict.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const listsDir = path.resolve(__dirname, "..", "..", "data", "lists");
const file = (rel) => path.join(listsDir, `${rel}.txt`);
const read = (rel) => {
  try { return fs.readFileSync(file(rel), "utf8").split(/\r?\n/).map((l) => l.replace(/\r$/, "")).filter((l) => l.trim() !== ""); }
  catch { return []; }
};
const writeSorted = (rel, arr) => fs.writeFileSync(file(rel), Array.from(new Set(arr)).sort((a, b) => a.localeCompare(b)).join("\n") + "\n");

const PAIRS = [
  ["word/dict-adjective", "word/adjective"],
  ["word/dict-noun", "word/noun"],
  ["word/dict-verb", "word/verb"],
  ["word/dict-adverb", "word/adverb"],
];
for (const [dict, target] of PAIRS) {
  const before = new Set(read(target)).size;
  const merged = [...read(target), ...read(dict)];
  writeSorted(target, merged);
  fs.rmSync(file(dict), { force: true });
  console.log(`${target}: ${before} + ${read(dict).length === 0 ? "(dict removed)" : ""} -> ${new Set(read(target)).size}`);
}

// dict-misc -> word/misc
writeSorted("word/misc", read("word/dict-misc"));
fs.rmSync(file("word/dict-misc"), { force: true });
console.log("word/misc:", new Set(read("word/misc")).size);
