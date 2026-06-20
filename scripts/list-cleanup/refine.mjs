/* Copyright 2026 junebug12851 — Apache-2.0.
 * Two refinements:
 *  A. Clean dict-adverb: re-route entries that aren't really adverbs (the old
 *     bare "-ly" rule mislabeled -ly nouns/verbs).
 *  B. Second pass on keyword.txt: pull out capitalized words that are really
 *     common words (lowercase form is in the dictionary) into the dict-* lists,
 *     and demonyms into demonym.txt; leave genuine proper nouns behind.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nlp from "compromise";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const listsDir = path.resolve(__dirname, "..", "..", "data", "lists");
const file = (n) => path.join(listsDir, `${n}.txt`);
const read = (n) => {
  try { return fs.readFileSync(file(n), "utf8").split(/\r?\n/).map((l) => l.trim()).filter(Boolean); }
  catch { return []; }
};
const writeSorted = (n, arr) =>
  fs.writeFileSync(file(n), Array.from(new Set(arr)).sort((a, b) => a.localeCompare(b)).join("\n") + "\n");

// --- A. clean dict-adverb ---------------------------------------------------
const adverbs = read("dict-adverb");
const keepAdv = [];
const moved = { "dict-adjective": [], "dict-verb": [], "dict-noun": [] };
for (const w of adverbs) {
  const doc = nlp(w);
  if (doc.has("#Adverb")) keepAdv.push(w);
  else if (doc.has("#Adjective")) moved["dict-adjective"].push(w);
  else if (doc.has("#Verb")) moved["dict-verb"].push(w);
  else moved["dict-noun"].push(w);
}
writeSorted("dict-adverb", keepAdv);
for (const [list, words] of Object.entries(moved)) if (words.length) writeSorted(list, [...read(list), ...words]);
const advFixStats = { keptAdverb: keepAdv.length, toAdjective: moved["dict-adjective"].length, toVerb: moved["dict-verb"].length, toNoun: moved["dict-noun"].length };

// --- build clean POS membership sets ---------------------------------------
const setOf = (n) => new Set(read(n).map((w) => w.toLowerCase()));
const sets = {
  "dict-adjective": new Set([...setOf("adjective"), ...setOf("dict-adjective")]),
  "dict-verb": new Set([...setOf("verb"), ...setOf("dict-verb")]),
  "dict-adverb": new Set([...setOf("adverb"), ...setOf("dict-adverb")]),
  "dict-misc": setOf("dict-misc"),
  "dict-noun": new Set([...setOf("noun"), ...setOf("dict-noun")]),
};

// --- B. second pass on keyword.txt -----------------------------------------
const kw = read("keyword");
const keepProper = [];
const demonyms = [];
const toList = { "dict-adjective": [], "dict-verb": [], "dict-adverb": [], "dict-misc": [], "dict-noun": [] };
for (const w of kw) {
  if (nlp(w).has("#Demonym")) { demonyms.push(w); continue; }
  const lc = w.toLowerCase();
  let placed = false;
  for (const list of ["dict-adjective", "dict-verb", "dict-adverb", "dict-misc", "dict-noun"]) {
    if (sets[list].has(lc)) { toList[list].push(w.toLowerCase()); placed = true; break; }
  }
  if (!placed) keepProper.push(w);
}
writeSorted("keyword", keepProper);
if (demonyms.length) writeSorted("demonym", demonyms);
for (const [list, words] of Object.entries(toList)) if (words.length) writeSorted(list, [...read(list), ...words]);

const moveStats = Object.fromEntries(Object.entries(toList).map(([k, v]) => [k, v.length]));
console.log("A. dict-adverb cleanup:", JSON.stringify(advFixStats));
console.log("B. keyword.txt second pass:");
console.log("   demonym.txt:", demonyms.length);
console.log("   moved to dict lists:", JSON.stringify(moveStats));
console.log("   keyword.txt now (proper nouns):", new Set(keepProper).size);
