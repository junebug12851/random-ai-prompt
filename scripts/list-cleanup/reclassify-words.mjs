/* Copyright 2026 1fairyfox — Apache-2.0.
 * Strict POS validation of the curated word lists against WordNet. Each entry:
 *  - stays if WordNet confirms its current part of speech;
 *  - else if it's an action gerund (contains an -ing token and isn't a WordNet
 *    adjective) -> look/action;
 *  - else if WordNet confirms a DIFFERENT POS -> that curated list;
 *  - else (WordNet doesn't know it) -> kept in place (no loss).
 *   node scripts/list-cleanup/reclassify-words.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const listsDir = path.resolve(__dirname, "..", "..", "data", "lists");
const wnDir = require("wordnet-db").path;

function loadIndex(file) {
  const set = new Set();
  for (const line of fs.readFileSync(path.join(wnDir, file), "utf8").split("\n")) {
    if (!line || line[0] === " ") continue;
    const lemma = line.split(" ")[0];
    if (lemma) set.add(lemma.replace(/_/g, " ").toLowerCase());
  }
  return set;
}
const wn = {
  adj: loadIndex("index.adj"),
  noun: loadIndex("index.noun"),
  verb: loadIndex("index.verb"),
  adv: loadIndex("index.adv"),
};

const read = (rel) => {
  try {
    return fs
      .readFileSync(path.join(listsDir, `${rel}.txt`), "utf8")
      .split(/\r?\n/)
      .map((l) => l.replace(/\r$/, ""))
      .filter((l) => l.trim() !== "");
  } catch {
    return [];
  }
};
const writeSorted = (rel, set) =>
  fs.writeFileSync(
    path.join(listsDir, `${rel}.txt`),
    Array.from(set)
      .sort((a, b) => a.localeCompare(b))
      .join("\n") + "\n",
  );

const HOME = {
  "word/adjective": "adj",
  "word/noun": "noun",
  "word/verb": "verb",
  "word/adverb": "adv",
};
const FILE = { adj: "word/adjective", noun: "word/noun", verb: "word/verb", adv: "word/adverb" };
const result = {
  adj: new Set(),
  noun: new Set(),
  verb: new Set(),
  adv: new Set(),
  action: new Set(),
};
const log = { toAction: [], cross: [], unknownKept: 0, confirmed: 0 };

for (const [rel, home] of Object.entries(HOME)) {
  for (const e of read(rel)) {
    const lc = e.toLowerCase();
    const mem = {
      adj: wn.adj.has(lc),
      noun: wn.noun.has(lc),
      verb: wn.verb.has(lc),
      adv: wn.adv.has(lc),
    };
    if (mem[home]) {
      result[home].add(e);
      log.confirmed++;
      continue;
    }
    const hasIng = lc.split(/[\s-]+/).some((w) => w.endsWith("ing"));
    if (hasIng && !mem.adj) {
      result.action.add(e);
      log.toAction.push(`${rel}: ${e}`);
      continue;
    }
    const hit = ["noun", "verb", "adj", "adv"].find((k) => mem[k]);
    if (hit) {
      result[hit].add(e);
      log.cross.push(`${rel}: ${e} -> ${FILE[hit]}`);
      continue;
    }
    result[home].add(e); // WordNet doesn't know it — keep where it is
    log.unknownKept++;
  }
}

for (const k of ["adj", "noun", "verb", "adv"]) writeSorted(FILE[k], result[k]);
writeSorted("look/action", result.action);

console.log("confirmed-in-place:", log.confirmed, "| unknown-kept:", log.unknownKept);
console.log("-> look/action:", log.toAction.length, "| cross-POS moves:", log.cross.length);
console.log("\nsample actions:\n  " + log.toAction.slice(0, 25).join("\n  "));
console.log("\nsample cross-POS:\n  " + log.cross.slice(0, 25).join("\n  "));
console.log(
  "\nfinal sizes: adjective",
  result.adj.size,
  "noun",
  result.noun.size,
  "verb",
  result.verb.size,
  "adverb",
  result.adv.size,
  "action",
  result.action.size,
);
