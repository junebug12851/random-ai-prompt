/* Copyright 2026 junebug12851 — Apache-2.0. Read-only: bucket keyword.txt to plan a second pass. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nlp from "compromise";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const listsDir = path.resolve(__dirname, "..", "..", "data", "lists");
const lines = fs
  .readFileSync(path.join(listsDir, "keyword.txt"), "utf8")
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter(Boolean);

// "Definitely a name/place" tags -> keep as proper noun.
const PROPER = ["#Person", "#FirstName", "#LastName", "#Place", "#City", "#Country", "#Region", "#Organization", "#Honorific"];

const buckets = { proper: [], demonym: [], adjective: [], verb: [], adverb: [], commonNoun: [], acronym: [], unknownProper: [] };

for (const w of lines) {
  const doc = nlp(w);
  const isProper = PROPER.some((t) => doc.has(t));
  if (w.length >= 2 && w === w.toUpperCase() && /^[A-Z]+$/.test(w)) {
    buckets.acronym.push(w);
  } else if (doc.has("#Demonym")) {
    buckets.demonym.push(w);
  } else if (isProper) {
    buckets.proper.push(w);
  } else if (doc.has("#Adverb")) {
    buckets.adverb.push(w);
  } else if (doc.has("#Adjective")) {
    buckets.adjective.push(w);
  } else if (doc.has("#Verb")) {
    buckets.verb.push(w);
  } else if (doc.has("#Noun") && !doc.has("#ProperNoun")) {
    buckets.commonNoun.push(w);
  } else {
    buckets.unknownProper.push(w); // capitalized, unrecognized -> almost certainly a real proper noun (Aachen, Abkhazia)
  }
}

console.log("keyword.txt total:", lines.length);
for (const [k, v] of Object.entries(buckets)) {
  console.log(`\n${k}: ${v.length}`);
  console.log("  e.g.", v.slice(0, 16).join(", "));
}
