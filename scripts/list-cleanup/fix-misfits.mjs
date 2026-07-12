/* Copyright 2026 1fairyfox — Apache-2.0.
 * Spot-check fixes: pull danbooru face/expression/pose tags out of word/adjective
 * into a new look/expression list, drop typos, and move a stray anime title out of
 * artist/anime. Relocations only (typos removed). Reviewed by hand.
 *   node scripts/list-cleanup/fix-misfits.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const listsDir = path.resolve(__dirname, "..", "..", "data", "lists");
const read = (rel) =>
  fs
    .readFileSync(path.join(listsDir, `${rel}.txt`), "utf8")
    .split(/\r?\n/)
    .map((l) => l.replace(/\r$/, ""))
    .filter((l) => l.trim() !== "");
const writeSorted = (rel, arr) =>
  fs.writeFileSync(
    path.join(listsDir, `${rel}.txt`),
    Array.from(new Set(arr))
      .sort((a, b) => a.localeCompare(b))
      .join("\n") + "\n",
  );

// expression / face / pose tags that don't belong in an adjective list
const EXPRESSION = new Set([
  "crazy smile",
  "doyagao",
  "evil grin",
  "evil smile",
  "face stretching",
  "fanning face",
  "finger biting",
  "finger sucking",
  "forced smile",
  "glove biting",
  "hair tucking",
  "hair twirling",
  "hand biting",
  "head biting",
  "headpating",
  "light smile",
  "naughty face",
  "nose blush",
  "one eye closed",
  "seductive smile",
  "smirk",
  "torogao",
  "troll face",
  "v-shaped eyebrows",
  "wavy mouth",
  "goldfish scooping",
]);
const TYPOS = new Set(["faceing", "operateing", "gnawling"]);

// word/adjective -> remove expression+typos; collect expressions
const adj = read("word/adjective");
const keptAdj = [];
const moved = [];
for (const l of adj) {
  if (EXPRESSION.has(l)) {
    moved.push(l);
    continue;
  }
  if (TYPOS.has(l)) continue;
  keptAdj.push(l);
}
writeSorted("word/adjective", keptAdj);
writeSorted("look/expression", moved);

// artist/anime -> move "Sailor Moon" (a title, not an artist) to name/anime-name
const anime = read("artist/anime");
if (anime.includes("Sailor Moon")) {
  writeSorted(
    "artist/anime",
    anime.filter((l) => l !== "Sailor Moon"),
  );
  writeSorted("name/anime-name", [...read("name/anime-name"), "Sailor Moon"]);
  console.log("moved 'Sailor Moon' artist/anime -> name/anime-name");
}

console.log(
  `word/adjective: moved ${moved.length} expression tags -> look/expression, removed ${[...TYPOS].length} typos`,
);
