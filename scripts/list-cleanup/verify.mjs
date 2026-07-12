/* Copyright 2026 1fairyfox — Apache-2.0. Ad-hoc virtual-list smoke check. */
import { nodeLoader } from "../../engine/core/nodeLoader.js";

const names = nodeLoader.listNames();
const check = [
  "danbooru",
  "danbooru-sfw",
  "d-keyword",
  "d-character",
  "artist",
  "artist-digipa",
  "adjective-all",
  "noun-all",
  "dict-adjective",
  "keyword",
];
console.log("total list names (incl virtual):", names.length);
for (const n of check) {
  const lines = nodeLoader.readListLines(n);
  console.log(`${n}: ${lines ? lines.length : "NULL"}`);
}
// sanity: danbooru-sfw must be <= danbooru
const d = nodeLoader.readListLines("danbooru").length;
const ds = nodeLoader.readListLines("danbooru-sfw").length;
console.log(`\nsfw filter removed ${d - ds} nsfw lines from danbooru (${d} -> ${ds})`);
