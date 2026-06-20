/*
    Copyright 2026 junebug12851 — Apache-2.0 (see src/contentSafety.js header).
*/

/**
 * @file
 * @brief Collapse the duplicated composite list files into virtual lists.
 * For each composite, any line that exists ONLY in the physical composite (not
 * reachable from its atomic members) is appended to a designated atomic "sink"
 * so nothing is lost, then the physical composite file is deleted. After this,
 * src/listManifest.js virtual lists fully cover the original content.
 *
 *   node scripts/list-cleanup/collapse.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const listsDir = path.resolve(__dirname, "..", "..", "data", "lists");

const read = (n) => {
  try {
    return fs.readFileSync(path.join(listsDir, `${n}.txt`), "utf8").split(/\r?\n/).filter((l) => l.trim() !== "");
  } catch {
    return [];
  }
};

// composite -> { members: atomic list names, sink: atomic to receive orphans }
const COMPOSITES = {
  danbooru: { members: ["d-general", "d-artist", "d-character-c", "d-character-nc", "d-meta"], sink: "d-general" },
  "d-keyword": { members: ["d-general", "d-character-c", "d-character-nc", "d-meta"], sink: "d-general" },
  "d-character": { members: ["d-character-nc", "d-character-c"], sink: "d-general" },
  artist: {
    members: [
      "artist-anime", "artist-bw", "artist-cartoon", "artist-dhigh", "artist-dmed",
      "artist-dlow", "artist-fareast", "artist-fineart", "artist-nudity",
      "artist-scribbles", "artist-special", "artist-ukioe", "artist-weird",
    ],
    sink: "artist-special",
  },
  "artist-digipa": { members: ["artist-dhigh", "artist-dmed", "artist-dlow"], sink: "artist-special" },
};

for (const [name, def] of Object.entries(COMPOSITES)) {
  const file = path.join(listsDir, `${name}.txt`);
  if (!fs.existsSync(file)) {
    console.log(`${name}: no physical file, skipping`);
    continue;
  }
  const physical = read(name);
  const covered = new Set();
  for (const m of def.members) for (const l of read(m)) covered.add(l);
  const orphans = [...new Set(physical.filter((l) => !covered.has(l)))];

  if (orphans.length) {
    const sinkPath = path.join(listsDir, `${def.sink}.txt`);
    const sinkLines = new Set(read(def.sink));
    const toAdd = orphans.filter((l) => !sinkLines.has(l));
    if (toAdd.length) {
      const cur = fs.readFileSync(sinkPath, "utf8");
      const sep = cur.endsWith("\n") ? "" : "\n";
      fs.appendFileSync(sinkPath, sep + toAdd.join("\n") + "\n");
    }
    console.log(`${name}: ${orphans.length} orphan(s) -> ${def.sink} (${toAdd.length} new)`);
  } else {
    console.log(`${name}: fully covered by atomics, no orphans`);
  }
  fs.rmSync(file);
  console.log(`${name}: deleted physical file (now virtual)`);
}
