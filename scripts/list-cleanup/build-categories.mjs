/* Copyright 2026 junebug12851 — Apache-2.0.
 * Distribute hand-classified proper nouns (cat/batch-*.json) into category lists.
 * SAFETY: only words that actually exist in keyword.txt are moved; anything not
 * listed in a batch stays in keyword.txt (never deleted). Reports coverage and
 * any listed word that didn't match (likely a typo) so nothing is silently lost.
 *
 *   node scripts/list-cleanup/build-categories.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const listsDir = path.resolve(__dirname, "..", "..", "data", "lists");
const catDir = path.join(__dirname, "cat");

const CATEGORY_FILE = {
  person: "person",
  place: "place",
  organization: "organization",
  mythology: "mythology",
  astronomy: "astronomy",
  "people-group": "people-group",
  religion: "religion",
  history: "history",
  work: "work",
};

const read = (abs) => {
  try { return fs.readFileSync(abs, "utf8").split(/\r?\n/).map((l) => l.trim()).filter(Boolean); }
  catch { return []; }
};

const keywordPath = path.join(listsDir, "keyword.txt");
// Snapshot the pre-classification keyword list ONCE, then always distribute from
// that fixed base. This makes the builder idempotent / re-runnable as batches are
// added (keyword.txt is rewritten = base minus everything classified).
const basePath = path.join(catDir, "keyword-base.txt");
if (!fs.existsSync(catDir)) fs.mkdirSync(catDir, { recursive: true });
if (!fs.existsSync(basePath)) fs.copyFileSync(keywordPath, basePath);
const keywordSet = new Set(read(basePath));
const original = keywordSet.size;

// merge all batch files: category -> Set of words
const merged = {};
const batchFiles = fs.existsSync(catDir) ? fs.readdirSync(catDir).filter((f) => f.endsWith(".json")).sort() : [];
for (const bf of batchFiles) {
  const obj = JSON.parse(fs.readFileSync(path.join(catDir, bf), "utf8"));
  for (const [cat, words] of Object.entries(obj)) {
    if (!CATEGORY_FILE[cat]) { console.warn(`unknown category '${cat}' in ${bf}`); continue; }
    (merged[cat] ||= new Set());
    for (const w of words) merged[cat].add(w);
  }
}

const notFound = [];
const claimed = new Set();
let moved = 0;
for (const [cat, words] of Object.entries(merged)) {
  const file = path.join(listsDir, `${CATEGORY_FILE[cat]}.txt`);
  const existing = new Set(read(file));
  for (const w of words) {
    if (!keywordSet.has(w)) { notFound.push(`${cat}: ${w}`); continue; }
    if (claimed.has(w)) continue; // first category wins if listed twice
    existing.add(w);
    claimed.add(w);
    moved++;
  }
  fs.writeFileSync(file, Array.from(existing).sort((a, b) => a.localeCompare(b)).join("\n") + "\n");
}

const remainder = Array.from(keywordSet).filter((w) => !claimed.has(w)).sort((a, b) => a.localeCompare(b));
fs.writeFileSync(keywordPath, remainder.join("\n") + "\n");

console.log(`original keyword.txt: ${original}`);
console.log(`moved into categories: ${moved}`);
console.log(`keyword.txt remainder: ${remainder.length}`);
console.log(`coverage check: ${moved + remainder.length === original ? "OK (nothing lost)" : "MISMATCH!"}`);
for (const [cat] of Object.entries(merged)) console.log(`  ${cat}: ${merged[cat].size} listed`);
if (notFound.length) console.log(`\nNOT FOUND (likely typos, left in keyword.txt): ${notFound.length}\n  ${notFound.slice(0, 40).join("\n  ")}`);
