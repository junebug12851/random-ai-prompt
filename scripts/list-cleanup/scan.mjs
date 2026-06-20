/*
    Copyright 2026 junebug12851 — Apache-2.0 (see blocklist.mjs header).
*/

/**
 * @file
 * @brief Read-only audit: scan every list + CSV source for removable content
 * and write a categorized manifest + human report. Changes nothing.
 *
 *   node scripts/list-cleanup/scan.mjs
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

// Lists that may legitimately contain adult/extreme vocabulary -> full ruleset.
// Everything else is treated as proper-noun/descriptive -> core slurs only.
const CONTENT_LISTS = new Set([
  "danbooru", "d-keyword", "d-general", "d-character", "d-character-c",
  "d-character-nc", "d-meta", "d-person", "keyword-adult", "clothes",
]);

// Pure-geography list: real place names that legitimately echo slurs as part
// of a longer name (e.g. "Coon Rapids", the hamlet "Dyke"). Exempt from the
// safety scan to avoid scrubbing real geography.
const EXEMPT_LISTS = new Set(["city"]);

const findings = []; // { file, lineNo, line, category, term }

function scanLines(fileLabel, lines, listType) {
  lines.forEach((raw, i) => {
    const line = raw.replace(/\r$/, "");
    if (line.trim() === "") return;
    const r = classifyRemoval(line, { listType });
    if (r) findings.push({ file: fileLabel, lineNo: i + 1, line, category: r.category, term: r.term });
  });
}

// --- list .txt files ---
for (const fname of fs.readdirSync(listsDir).filter((f) => f.endsWith(".txt"))) {
  const name = fname.replace(/\.txt$/, "");
  if (EXEMPT_LISTS.has(name)) continue;
  const listType = CONTENT_LISTS.has(name) ? "content" : "proper";
  const lines = fs.readFileSync(path.join(listsDir, fname), "utf8").split("\n");
  scanLines(fname, lines, listType);
}

// --- danbooru.csv (name,type,count) -> classify the de-underscored name ---
{
  const csv = fs.readFileSync(path.join(dataDir, "danbooru.csv"), "utf8").split("\n");
  csv.forEach((raw, i) => {
    const line = raw.replace(/\r$/, "");
    if (line.trim() === "") return;
    const name = line.split(",")[0] || "";
    const keyword = name.replace(/[\/\\_]+/g, " ");
    const r = classifyRemoval(keyword, { listType: "content" });
    if (r) findings.push({ file: "danbooru.csv", lineNo: i + 1, line: keyword, category: r.category, term: r.term });
  });
}

// --- artists.csv -> proper (names), core slurs only ---
{
  const csv = fs.readFileSync(path.join(dataDir, "artists.csv"), "utf8").split("\n");
  csv.forEach((raw, i) => {
    const line = raw.replace(/\r$/, "");
    if (line.trim() === "") return;
    const name = line.split(",")[0] || "";
    const r = classifyRemoval(name, { listType: "proper" });
    if (r) findings.push({ file: "artists.csv", lineNo: i + 1, line: name, category: r.category, term: r.term });
  });
}

// --- aggregate ---
const byCategory = {};
const byFile = {};
const byTerm = {};
for (const f of findings) {
  byCategory[f.category] = (byCategory[f.category] || 0) + 1;
  byFile[f.file] = (byFile[f.file] || 0) + 1;
  const key = `${f.category}:${f.term}`;
  byTerm[key] = (byTerm[key] || 0) + 1;
}

fs.writeFileSync(path.join(outDir, "removals.json"), JSON.stringify({ findings, byCategory, byFile }, null, 2));

// human report
let md = `# Offensive-content removal audit\n\nGenerated ${new Date().toISOString()}\n\n`;
md += `Total flagged lines: **${findings.length}**\n\n## By category\n\n`;
for (const [c, n] of Object.entries(byCategory).sort((a, b) => b[1] - a[1])) md += `- ${c}: ${n}\n`;
md += `\n## By file\n\n`;
for (const [c, n] of Object.entries(byFile).sort((a, b) => b[1] - a[1])) md += `- ${c}: ${n}\n`;
md += `\n## Distinct matched terms (term: occurrences)\n\n`;
for (const [c, n] of Object.entries(byTerm).sort((a, b) => b[1] - a[1])) md += `- ${c} — ${n}\n`;
fs.writeFileSync(path.join(outDir, "REMOVALS-REPORT.md"), md);

// console summary (safe to surface)
console.log("TOTAL flagged:", findings.length);
console.log("By category:", JSON.stringify(byCategory));
console.log("By file:", JSON.stringify(byFile));
console.log("Distinct terms:", Object.keys(byTerm).length);
console.log("Wrote:", path.relative(repoRoot, path.join(outDir, "removals.json")));
