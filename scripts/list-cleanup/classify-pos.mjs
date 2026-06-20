/*
    Copyright 2026 junebug12851 — Apache-2.0 (see src/contentSafety.js header).
*/

/**
 * @file
 * @brief Sort the giant keyword.txt dictionary dump into part-of-speech lists.
 *
 *   - Capitalized entries (names / places / brands) stay in keyword.txt (it
 *     becomes the proper-noun list).
 *   - Lowercase common words are tagged with `compromise` and routed to
 *     dict-adjective / dict-noun / dict-verb / dict-adverb (+ dict-misc for the
 *     unclassifiable). These feed the *-all virtual lists.
 *   - JUNK is dropped (owner decision 2026-06-20): possessives/contractions
 *     (anything with an apostrophe), non-alphabetic fragments, and redundant
 *     inflected forms whose base word is already present.
 *
 *   node scripts/list-cleanup/classify-pos.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nlp from "compromise";
import { classifyRemoval } from "../../src/contentSafety.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const listsDir = path.resolve(__dirname, "..", "..", "data", "lists");
const outDir = path.join(__dirname, "out");
fs.mkdirSync(outDir, { recursive: true });

const src = path.join(listsDir, "keyword.txt");
const raw = fs.readFileSync(src, "utf8");
const eol = raw.includes("\r\n") ? "\r\n" : "\n";
const trailing = /\r?\n$/.test(raw);
const lines = raw.split(/\r?\n/);
if (trailing) lines.pop();

const lowerSet = new Set(
  lines.map((l) => l.trim()).filter((l) => /^[a-z][a-z -]*$/.test(l)),
);

// Cheap, dependency-free redundancy check: is `word` an inflection of a base
// word that is also present in the list?
function isRedundantInflection(word) {
  const cands = new Set();
  if (word.endsWith("s")) cands.add(word.slice(0, -1));
  if (word.endsWith("es")) cands.add(word.slice(0, -2));
  if (word.endsWith("ies")) cands.add(word.slice(0, -3) + "y");
  if (word.endsWith("ed")) {
    cands.add(word.slice(0, -2));
    cands.add(word.slice(0, -1));
    cands.add(word.slice(0, -2) + "e");
  }
  if (word.endsWith("ing")) {
    cands.add(word.slice(0, -3));
    cands.add(word.slice(0, -3) + "e");
  }
  if (word.endsWith("ly")) cands.add(word.slice(0, -2));
  for (const c of cands) if (c.length >= 3 && lowerSet.has(c)) return true;
  return false;
}

const out = {
  proper: [],
  "dict-adjective": [],
  "dict-noun": [],
  "dict-verb": [],
  "dict-adverb": [],
  "dict-misc": [],
};
const stats = { dropped_junk: 0, dropped_inflection: 0, dropped_unsafe: 0 };

for (const rawLine of lines) {
  const word = rawLine.trim();
  if (word === "") continue;

  // safety net (should already be clean)
  if (classifyRemoval(word, { listType: "content" })) {
    stats.dropped_unsafe++;
    continue;
  }

  // proper nouns stay put
  if (/^[A-Z]/.test(word)) {
    out.proper.push(word);
    continue;
  }

  // junk: apostrophes / non-alpha / too short
  if (/['’]/.test(word) || !/^[a-z][a-z -]*$/.test(word) || word.length < 2) {
    stats.dropped_junk++;
    continue;
  }

  // redundant inflected form whose base is present
  if (isRedundantInflection(word)) {
    stats.dropped_inflection++;
    continue;
  }

  // POS via compromise (isolated-word tagging — best effort)
  const doc = nlp(word);
  let bucket;
  if (doc.has("#Adverb") || /ly$/.test(word)) bucket = "dict-adverb";
  else if (doc.has("#Adjective")) bucket = "dict-adjective";
  else if (doc.has("#Verb")) bucket = "dict-verb";
  else if (doc.has("#Noun")) bucket = "dict-noun";
  else bucket = "dict-misc";
  out[bucket].push(word);
}

const summary = {};
for (const [name, arr] of Object.entries(out)) {
  const uniq = Array.from(new Set(arr)).sort((a, b) => a.localeCompare(b));
  summary[name] = uniq.length;
  if (name === "proper") {
    let txt = uniq.join(eol);
    if (trailing) txt += eol;
    fs.writeFileSync(src, txt); // keyword.txt becomes the proper-noun list
  } else {
    fs.writeFileSync(path.join(listsDir, `${name}.txt`), uniq.join("\n") + "\n");
  }
}

fs.writeFileSync(path.join(outDir, "pos-stats.json"), JSON.stringify({ summary, stats }, null, 2));
console.log("POS sort complete:");
console.log("  written:", JSON.stringify(summary));
console.log("  dropped:", JSON.stringify(stats));
