/*
    Copyright 2026 1fairyfox — Apache-2.0 (see src/contentSafety.js header).
*/

/**
 * @file
 * @brief Authoritative POS sort of the keyword.txt dictionary using WordNet.
 *
 * Replaces the earlier guess-from-spelling heuristic. Every word is LOOKED UP in
 * the WordNet index files (via the `wordpos`/`wordnet-db` dev dependency) and
 * placed in the dict-* list(s) for the part(s) of speech the dictionary actually
 * assigns it (a word can be several — `bond` -> noun + verb). Words WordNet does
 * not know are treated as proper nouns (kept in keyword.txt) or, if lowercase,
 * obscure/function words (dict-misc). Demonyms are split to demonym.txt.
 *
 * Input: the original slur-free dictionary (scripts/list-cleanup/out/original-dict.txt,
 * dumped from git). Run once; outputs overwrite the dict-* / keyword / demonym lists.
 *
 *   node scripts/list-cleanup/pos-dictionary.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import nlp from "compromise";
import { classifyRemoval } from "../../engine/contentSafety.js";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const listsDir = path.resolve(__dirname, "..", "..", "data", "lists");
const outDir = path.join(__dirname, "out");
const wnDir = require("wordnet-db").path;

// --- load WordNet POS lemma sets -------------------------------------------
function loadIndex(file) {
  const set = new Set();
  const text = fs.readFileSync(path.join(wnDir, file), "utf8");
  for (const line of text.split("\n")) {
    if (!line || line[0] === " ") continue; // skip license header
    const lemma = line.split(" ")[0];
    if (lemma) set.add(lemma.replace(/_/g, " ").toLowerCase());
  }
  return set;
}
const wn = {
  "dict-noun": loadIndex("index.noun"),
  "dict-verb": loadIndex("index.verb"),
  "dict-adjective": loadIndex("index.adj"),
  "dict-adverb": loadIndex("index.adv"),
};

// --- input dictionary ------------------------------------------------------
const words = fs
  .readFileSync(path.join(outDir, "original-dict.txt"), "utf8")
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter(Boolean);
const wordSet = new Set(words.map((w) => w.toLowerCase()));

function isRedundantInflection(word) {
  const c = new Set();
  if (word.endsWith("s")) c.add(word.slice(0, -1));
  if (word.endsWith("es")) c.add(word.slice(0, -2));
  if (word.endsWith("ies")) c.add(word.slice(0, -3) + "y");
  if (word.endsWith("ed")) {
    c.add(word.slice(0, -2));
    c.add(word.slice(0, -1));
  }
  if (word.endsWith("ing")) {
    c.add(word.slice(0, -3));
    c.add(word.slice(0, -3) + "e");
  }
  for (const x of c) if (x.length >= 3 && wordSet.has(x)) return true;
  return false;
}

const out = {
  proper: new Set(),
  demonym: new Set(),
  "dict-noun": new Set(),
  "dict-verb": new Set(),
  "dict-adjective": new Set(),
  "dict-adverb": new Set(),
  "dict-misc": new Set(),
};
const stats = {
  dropped_junk: 0,
  dropped_inflection: 0,
  dropped_unsafe: 0,
  in_wordnet: 0,
  proper: 0,
  misc: 0,
  multi: 0,
};

for (const w of words) {
  if (classifyRemoval(w, { listType: "content" })) {
    stats.dropped_unsafe++;
    continue;
  }
  if (/['’]/.test(w) || !/^[A-Za-z][A-Za-z -]*$/.test(w) || w.length < 2) {
    stats.dropped_junk++;
    continue;
  }
  const lc = w.toLowerCase();
  if (isRedundantInflection(lc)) {
    stats.dropped_inflection++;
    continue;
  }

  // demonym -> its own list
  if (/^[A-Z]/.test(w) && nlp(w).has("#Demonym")) {
    out.demonym.add(w);
    continue;
  }

  const pos = ["dict-noun", "dict-verb", "dict-adjective", "dict-adverb"].filter((p) =>
    wn[p].has(lc),
  );
  const cap = /^[A-Z]/.test(w);
  const hasModifier =
    pos.includes("dict-verb") || pos.includes("dict-adjective") || pos.includes("dict-adverb");

  if (cap && pos.length && !hasModifier) {
    // Capitalized and WordNet knows it ONLY as a noun -> almost certainly a
    // proper noun WordNet happens to list (America, Paris, December). Keep it.
    out.proper.add(w);
    stats.proper++;
  } else if (pos.length) {
    for (const p of pos) out[p].add(lc);
    stats.in_wordnet++;
    if (pos.length > 1) stats.multi++;
  } else if (cap) {
    out.proper.add(w); // capitalized + unknown to WordNet = proper noun
    stats.proper++;
  } else {
    out["dict-misc"].add(lc); // lowercase + unknown = obscure / function word
    stats.misc++;
  }
}

const write = (n, set) =>
  fs.writeFileSync(
    path.join(listsDir, `${n}.txt`),
    Array.from(set)
      .sort((a, b) => a.localeCompare(b))
      .join("\n") + "\n",
  );
write("keyword", out.proper);
write("demonym", out.demonym);
for (const p of ["dict-noun", "dict-verb", "dict-adjective", "dict-adverb", "dict-misc"])
  write(p, out[p]);

const summary = Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.size]));
fs.writeFileSync(
  path.join(outDir, "pos-dictionary-stats.json"),
  JSON.stringify({ summary, stats }, null, 2),
);
console.log("WordNet POS sort complete.");
console.log("  list sizes:", JSON.stringify(summary));
console.log("  stats:", JSON.stringify(stats));
