/**
 * @file Generate `data/manifest.json` — the published list of content files (entry `.txt` / `.group`
 * lists and `.dpl` / `.js` generators) per root. The Manage tab fetches this from the stable branch
 * to show "ghost" entries (files deleted locally but still available upstream, restorable), so it
 * needs no GitHub-API tree scrape — just a static file + a set difference.
 *
 * Run at release (and whenever data files are added/removed): `npm run manifest`.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildManageSnapshot } from "../targets/web/backend/manageFs.js";

// BUILT-IN ONLY: the published manifest describes the upstream `data/` catalog (for the Manage tab's
// ghost/restore feature). The user overlay (`user/`) has no upstream and must never appear here.
const snap = buildManageSnapshot({ includeUser: false });
const manifest = {
  generatedAt: new Date().toISOString(),
  lists: [
    ...Object.keys(snap.lists).map((k) => `${k}.txt`),
    ...Object.keys(snap.listGroups).map((k) => `${k}.group`),
  ].sort(),
  blocks: [
    ...Object.keys(snap.dpDpl).map((k) => `${k}.dpl`),
    ...snap.dpJsKeys.map((k) => `${k}.js`),
  ].sort(),
};

const outPath = path.join(
  fileURLToPath(new URL("../engine/data/", import.meta.url)),
  "manifest.json",
);
fs.writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(
  `wrote ${path.relative(process.cwd(), outPath)} — ${manifest.lists.length} lists, ${manifest["blocks"].length} generators`,
);
