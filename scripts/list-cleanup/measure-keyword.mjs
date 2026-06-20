/* Copyright 2026 junebug12851 — Apache-2.0. Read-only: precise common-word overlap in keyword.txt. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nlp from "compromise";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const listsDir = path.resolve(__dirname, "..", "..", "data", "lists");
const read = (n) =>
  fs.readFileSync(path.join(listsDir, `${n}.txt`), "utf8").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
const setOf = (n) => new Set(read(n).map((w) => w.toLowerCase()));

const sets = {
  adjective: new Set([...setOf("adjective"), ...setOf("dict-adjective")]),
  verb: new Set([...setOf("verb"), ...setOf("dict-verb")]),
  adverb: new Set([...setOf("adverb"), ...setOf("dict-adverb")]),
  noun: new Set([...setOf("noun"), ...setOf("dict-noun")]),
  misc: setOf("dict-misc"),
};

const kw = read("keyword");
const hit = { adjective: [], verb: [], adverb: [], noun: [], misc: [], demonym: [], none: 0 };

for (const w of kw) {
  const lc = w.toLowerCase();
  if (nlp(w).has("#Demonym")) { hit.demonym.push(w); continue; }
  // precise: lowercase form is literally a dictionary common word
  if (sets.adjective.has(lc)) hit.adjective.push(w);
  else if (sets.verb.has(lc)) hit.verb.push(w);
  else if (sets.adverb.has(lc)) hit.adverb.push(w);
  else if (sets.misc.has(lc)) hit.misc.push(w);
  else if (sets.noun.has(lc)) hit.noun.push(w);
  else hit.none++;
}

console.log("keyword.txt total:", kw.length);
for (const k of ["demonym", "adjective", "verb", "adverb", "noun", "misc"]) {
  console.log(`\n${k}: ${hit[k].length}`);
  console.log("  e.g.", hit[k].slice(0, 18).join(", "));
}
console.log("\nstays proper (no lowercase dictionary match):", hit.none);
