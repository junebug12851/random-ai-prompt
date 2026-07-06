/**
 * @file Bundle-size budget check (performance gate). Builds nothing itself — run
 * `npm run web:build` first — it reads the produced `targets/web/dist/assets/*.js`, gzips each,
 * and fails if the total JS (gzipped) exceeds the budget. Keeps a regression in shipped
 * weight from sneaking in on an upgrade. Tune BUDGET_KB as the app legitimately grows.
 *
 * Usage: `node scripts/check-bundle-size.mjs` (or `npm run test:perf`, which builds first).
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const assetsDir = path.join(root, "gui", "dist", "assets");

// Gzipped-JS budget for the whole SPA bundle. Set with headroom above the current
// footprint; CI fails if a change pushes the shipped JS past it.
const BUDGET_KB = 900;

function gzipKb(buf) {
  return zlib.gzipSync(buf, { level: 9 }).length / 1024;
}

if (!fs.existsSync(assetsDir)) {
  console.error(`✗ No build found at targets/web/dist/assets — run "npm run web:build" first.`);
  process.exit(1);
}

const jsFiles = fs.readdirSync(assetsDir).filter((f) => f.endsWith(".js"));
if (!jsFiles.length) {
  console.error("✗ No JS assets found in the build.");
  process.exit(1);
}

let totalKb = 0;
const rows = jsFiles
  .map((f) => {
    const kb = gzipKb(fs.readFileSync(path.join(assetsDir, f)));
    totalKb += kb;
    return { f, kb };
  })
  .sort((a, b) => b.kb - a.kb);

console.log("Bundle JS (gzipped):");
for (const r of rows) console.log(`  ${r.kb.toFixed(1).padStart(7)} KB  ${r.f}`);
console.log(`  ${"-".repeat(7)}`);
console.log(`  ${totalKb.toFixed(1).padStart(7)} KB  total  (budget ${BUDGET_KB} KB)`);

if (totalKb > BUDGET_KB) {
  console.error(`\n✗ Bundle over budget by ${(totalKb - BUDGET_KB).toFixed(1)} KB.`);
  process.exit(1);
}
console.log(`\n✓ Within budget (${(BUDGET_KB - totalKb).toFixed(1)} KB headroom).`);
