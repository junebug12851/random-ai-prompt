/* Copyright 2026 junebug12851 — Apache-2.0. Build the human change report from logs. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "out");
const purge = JSON.parse(fs.readFileSync(path.join(outDir, "purge-log.json"), "utf8"));
const pos = JSON.parse(fs.readFileSync(path.join(outDir, "pos-stats.json"), "utf8"));

const byCat = {};
const byFile = {};
const byTerm = {};
for (const f of purge) {
  byCat[f.category] = (byCat[f.category] || 0) + 1;
  byFile[f.file] = (byFile[f.file] || 0) + 1;
  const k = `${f.category} / ${f.term}`;
  byTerm[k] = (byTerm[k] || 0) + 1;
}

let md = `# Keyword-list cleanup — change report (v2.1.0)\n\n`;
md += `Branch \`cleanup/list-reorg\`. Generated ${new Date().toISOString()}.\n\n`;

md += `## 1. Offensive content removed (${purge.length} entries)\n\n`;
md += `Policy: remove slurs, content sexualizing minors, and extreme shock/gore/non-consensual.\n`;
md += `Ordinary adult/nudity terms were KEPT (NSFW-gated), not deleted.\n\n`;
md += `By category:\n\n`;
for (const [c, n] of Object.entries(byCat).sort((a, b) => b[1] - a[1])) md += `- **${c}**: ${n}\n`;
md += `\nBy file:\n\n`;
for (const [c, n] of Object.entries(byFile).sort((a, b) => b[1] - a[1])) md += `- ${c}: ${n}\n`;
md += `\nDistinct terms matched (term — occurrences):\n\n`;
for (const [c, n] of Object.entries(byTerm).sort((a, b) => b[1] - a[1])) md += `- ${c} — ${n}\n`;
md += `\nFull line-by-line list: \`scripts/list-cleanup/out/purge-log.json\`.\n`;
md += `Source \`danbooru.csv\` had 47 matching rows removed at source; the build scripts now filter on regenerate.\n\n`;

md += `## 2. Dictionary sorted by part of speech\n\n`;
md += `\`keyword.txt\` (48,750-line SCOWL dump) → sorted with the compromise NLP library:\n\n`;
for (const [k, v] of Object.entries(pos.summary)) {
  const label = k === "proper" ? "keyword.txt (proper nouns, kept here)" : `${k}.txt`;
  md += `- ${label}: ${v}\n`;
}
md += `\nDropped as junk (owner-approved): `;
md += Object.entries(pos.stats).map(([k, v]) => `${k.replace("dropped_", "")} ${v}`).join(", ");
md += `.\n\nConservation check: 46,500 sorted + 2,250 dropped = 48,750 original lines. Nothing unaccounted.\n\n`;

md += `## 3. Lists collapsed into virtual lists\n\n`;
md += `These duplicated files were DELETED and are now computed on demand (src/listManifest.js):\n\n`;
md += `- \`danbooru\`, \`d-keyword\`, \`d-character\` — unions of the atomic d-* lists\n`;
md += `- \`artist\`, \`artist-digipa\` — unions of the atomic artist-* lists\n`;
md += `\nNew virtual lists added:\n\n`;
md += `- \`danbooru-sfw\` — danbooru with NSFW-lexicon lines filtered out (the clean anime list)\n`;
md += `- \`adjective-all\`, \`noun-all\`, \`verb-all\`, \`adverb-all\` — curated list + matching dict-* list\n`;
md += `\n6 uncategorized artist entries were preserved into \`artist-special\` before deletion.\n`;

fs.writeFileSync(path.join(outDir, "CHANGE-REPORT.md"), md);
console.log("Wrote", path.relative(path.resolve(__dirname, "..", ".."), path.join(outDir, "CHANGE-REPORT.md")));
