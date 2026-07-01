/*
    Copyright 2026 junebug12851 — Apache-2.0 (see blocklist.mjs header).
*/

/**
 * @file
 * @brief Apply the safety purge: remove flagged lines from every list and from
 * the danbooru.csv / artists.csv sources, preserving each file's line endings.
 * Idempotent. Run after reviewing scan.mjs output.
 *
 *   node scripts/list-cleanup/purge.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { classifyRemoval } from "../../src/contentSafety.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");
const listsDir = path.join(repoRoot, "data", "lists");
const dataDir = path.join(repoRoot, "data");
const outDir = path.join(__dirname, "out");
fs.mkdirSync(outDir, { recursive: true });

const CONTENT_LISTS = new Set([
  "danbooru",
  "d-keyword",
  "d-general",
  "d-character",
  "d-character-c",
  "d-character-nc",
  "d-meta",
  "d-person",
  "keyword-adult",
  "clothes",
]);
const EXEMPT_LISTS = new Set(["city"]);

const log = [];

function eolOf(text) {
  return text.includes("\r\n") ? "\r\n" : "\n";
}

function rewriteFile(absPath, label, classifyFn, transformLineForClassify = (l) => l) {
  const raw = fs.readFileSync(absPath, "utf8");
  if (raw === "") return;
  const eol = eolOf(raw);
  const trailing = /\r?\n$/.test(raw);
  const lines = raw.split(/\r?\n/);
  if (trailing) lines.pop(); // drop the empty element from the trailing newline
  const kept = [];
  let removed = 0;
  for (const line of lines) {
    const r = classifyFn(transformLineForClassify(line));
    if (r) {
      removed++;
      log.push({ file: label, line, category: r.category, term: r.term });
    } else {
      kept.push(line);
    }
  }
  if (removed > 0) {
    let out = kept.join(eol);
    if (trailing) out += eol;
    fs.writeFileSync(absPath, out);
  }
  return removed;
}

// --- .txt lists ---
for (const fname of fs.readdirSync(listsDir).filter((f) => f.endsWith(".txt"))) {
  const name = fname.replace(/\.txt$/, "");
  if (EXEMPT_LISTS.has(name)) continue;
  const listType = CONTENT_LISTS.has(name) ? "content" : "proper";
  const n = rewriteFile(path.join(listsDir, fname), fname, (l) => classifyRemoval(l, { listType }));
  if (n) console.log(`${fname}: removed ${n}`);
}

// --- danbooru.csv (classify de-underscored name field, content rules) ---
{
  const n = rewriteFile(
    path.join(dataDir, "sources", "danbooru.csv"),
    "danbooru.csv",
    (l) => classifyRemoval(l, { listType: "content" }),
    (line) => (line.split(",")[0] || "").replace(/[/\\_]+/g, " "),
  );
  if (n) console.log(`danbooru.csv: removed ${n}`);
}

// --- artists.csv (proper / core slurs only) ---
{
  const n = rewriteFile(
    path.join(dataDir, "sources", "artists.csv"),
    "artists.csv",
    (l) => classifyRemoval(l, { listType: "proper" }),
    (line) => line.split(",")[0] || "",
  );
  if (n) console.log(`artists.csv: removed ${n}`);
}

fs.writeFileSync(path.join(outDir, "purge-log.json"), JSON.stringify(log, null, 2));
console.log(`\nTotal removed: ${log.length}. Log: scripts/list-cleanup/out/purge-log.json`);
