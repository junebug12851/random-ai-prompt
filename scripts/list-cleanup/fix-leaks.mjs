/* Copyright 2026 junebug12851 — Apache-2.0.
 * Relocate NSFW terms that leaked into SFW lists into gated adult counterparts,
 * and drop extreme terms. False positives (legit words whose SFW sense dominates)
 * are KEPT. Reviewed line-by-line; KEEP set encodes those decisions.
 *   node scripts/list-cleanup/fix-leaks.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { classifyRemoval, isNsfw } from "../../src/contentSafety.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const listsDir = path.resolve(__dirname, "..", "..", "data", "lists");

// Flagged but legit (SFW sense dominates) — never move/remove these.
const KEEP = new Set([
  "explicit", "facial", "naked", "oral", "sexual", "ass", "butt", "breast",
  "sex", "intercourse", "presenting", "naked mole rat", "x-ray",
]);

// SFW list -> where its NSFW lines should be relocated (gated).
const ROUTES = {
  "look/clothes": "look/clothes-nsfw",
  "word/adjective": "word/adult-nsfw",
  "word/dict-adjective": "word/adult-nsfw",
  "word/dict-noun": "word/adult-nsfw",
  "word/dict-verb": "word/adult-nsfw",
  "word/noun": "word/adult-nsfw",
  "word/verb": "word/adult-nsfw",
};

const read = (rel) => {
  try { return fs.readFileSync(path.join(listsDir, `${rel}.txt`), "utf8").split(/\r?\n/); }
  catch { return []; }
};
const eol = (rel) => (fs.readFileSync(path.join(listsDir, `${rel}.txt`), "utf8").includes("\r\n") ? "\r\n" : "\n");

const adds = {}; // target -> Set of lines to add
const log = { moved: [], removed: [], kept: [] };

for (const [src, target] of Object.entries(ROUTES)) {
  const raw = read(src);
  const e = eol(src);
  const trailing = /\n$/.test(fs.readFileSync(path.join(listsDir, `${src}.txt`), "utf8"));
  const lines = raw.map((l) => l.replace(/\r$/, ""));
  if (trailing && lines[lines.length - 1] === "") lines.pop();
  const kept = [];
  for (const line of lines) {
    if (line.trim() === "") continue;
    const lc = line.toLowerCase();
    if (KEEP.has(lc)) { kept.push(line); continue; }
    const rm = classifyRemoval(line, { listType: "content" });
    if (rm) { log.removed.push(`${src}: ${line} (${rm.category})`); continue; } // drop extreme/slur
    if (isNsfw(line)) {
      (adds[target] ||= new Set()).add(line);
      log.moved.push(`${src} -> ${target}: ${line}`);
      continue;
    }
    kept.push(line);
  }
  fs.writeFileSync(path.join(listsDir, `${src}.txt`), kept.join(e) + (trailing ? e : ""));
}

// append moved lines to their gated target lists (create if needed, dedup, sort)
for (const [target, set] of Object.entries(adds)) {
  const file = path.join(listsDir, `${target}.txt`);
  const existing = new Set(read(target).map((l) => l.replace(/\r$/, "")).filter((l) => l.trim() !== ""));
  for (const l of set) existing.add(l);
  fs.writeFileSync(file, Array.from(existing).sort((a, b) => a.localeCompare(b)).join("\n") + "\n");
}

console.log(`moved ${log.moved.length}, removed ${log.removed.length}`);
console.log("\n-- removed (extreme/slur) --\n  " + (log.removed.join("\n  ") || "(none)"));
console.log("\n-- sample moved --\n  " + log.moved.slice(0, 20).join("\n  "));
console.log(`\ngated targets: ${Object.keys(adds).join(", ")}`);
