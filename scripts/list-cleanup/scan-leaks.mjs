/* Copyright 2026 1fairyfox — Apache-2.0.
 * Spot-check helper: flag NSFW / offensive lines that leaked into lists that are
 * supposed to be clean (everything except the intentionally-adult danbooru/* and
 * keyword/keyword-adult). Also dumps a small sample of every file for eyeballing.
 *   node scripts/list-cleanup/scan-leaks.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { classifyRemoval, isNsfw } from "../../engine/contentSafety.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const listsDir = path.resolve(__dirname, "..", "..", "data", "lists");

// Lists where adult content is expected/allowed (gated). Everything else should be clean.
const EXPECT_ADULT = (rel) =>
  rel.startsWith("danbooru/") ||
  rel === "keyword/keyword-adult" ||
  rel === "look/clothes-adult" ||
  rel === "word/adult" ||
  rel === "artist/nudity";

function walk(dir, prefix, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) walk(path.join(dir, e.name), `${prefix}${e.name}/`, out);
    else if (e.name.endsWith(".txt")) out.push(`${prefix}${e.name.replace(/\.txt$/, "")}`);
  }
}
const names = [];
walk(listsDir, "", names);
names.sort();

const leaks = [];
for (const rel of names) {
  if (EXPECT_ADULT(rel)) continue;
  const lines = fs.readFileSync(path.join(listsDir, `${rel}.txt`), "utf8").split(/\r?\n/);
  lines.forEach((raw) => {
    const line = raw.replace(/\r$/, "");
    if (line.trim() === "") return;
    const rm = classifyRemoval(line, { listType: "content" });
    if (rm) leaks.push({ rel, line, why: `REMOVE:${rm.category}` });
    else if (isNsfw(line)) leaks.push({ rel, line, why: "NSFW" });
  });
}

const byFile = {};
for (const l of leaks) (byFile[l.rel] ||= []).push(`${l.why}  ${l.line}`);
console.log(`=== leaks in supposedly-clean lists: ${leaks.length} ===`);
for (const [f, arr] of Object.entries(byFile)) {
  console.log(`\n${f}  (${arr.length})`);
  for (const a of arr.slice(0, 30)) console.log("   " + a);
  if (arr.length > 30) console.log(`   ...and ${arr.length - 30} more`);
}
if (!leaks.length) console.log("(none)");
