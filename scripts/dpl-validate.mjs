/**
 * @file
 * @brief Render the converted v3 .dpl generators a few times to confirm they parse + render.
 *        Run: node scripts/dpl-validate.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compileDpl } from "../src/core/dpl/dpl.js";

const root = fileURLToPath(new URL("../data/dynamic-prompts/v3/", import.meta.url));

// Walk the v3 tree for .dpl files.
function dplFiles(dir, prefix = "") {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) out.push(...dplFiles(path.join(dir, e.name), `${prefix}${e.name}/`));
    else if (e.name.endsWith(".dpl"))
      out.push({ key: prefix + e.name.replace(/\.dpl$/, ""), file: path.join(dir, e.name) });
  }
  return out;
}

// Stub bridge: JS resolves to a marker; cross-generator/list/expansion tokens pass through.
const bridge = { resolveJs: (p) => `[js:${p}]` };

let failed = 0;
for (const { key, file } of dplFiles(root)) {
  try {
    const mod = compileDpl(fs.readFileSync(file, "utf8"), bridge);
    const sample = Array.from({ length: 3 }, () => mod.default({}, {}, {}));
    console.log(`\n=== ${key}  (full=${mod.full})`);
    sample.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));
    if (sample.some((s) => typeof s !== "string")) throw new Error("non-string output");
  } catch (e) {
    failed++;
    console.error(`  ERROR in ${key}: ${e.message}`);
  }
}
console.log(`\n${failed ? `FAILED (${failed})` : "OK — all v3 .dpl generators rendered"}`);
process.exit(failed ? 1 : 0);
