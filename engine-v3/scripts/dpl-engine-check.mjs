/**
 * @file
 * @brief End-to-end: run the core engine over the `.dpl` generators (lists + JS sidecars resolve).
 *        Run: node scripts/dpl-engine-check.mjs
 */
import { createEngine } from "../src/core/engine.js";
import { nodeLoader } from "../src/core/nodeLoader.js";

const engine = createEngine(nodeLoader);
const cases = [
  "{#cave}", // bare (suffix-resolved)
  "{#furry}",
  "{#vibrant-art}",
  "{#space}",
  "{#entity}",
  "{#random-words}",
  "{#scene/cave}", // explicit category path
  "{#scene}", // implied folder group (pick one scene)
  "{#any}", // wildcard — any generator
];

let failed = 0;
for (const c of cases) {
  let out = "";
  try {
    out = engine.generate({ prompt: c, includeAdult: false });
  } catch (e) {
    failed++;
    console.error(`ERROR ${c}: ${e.message}`);
    continue;
  }
  const leftover = /\{#|\{js:/.test(out); // unresolved dynamic-prompt / js tokens = a real failure
  if (typeof out !== "string" || out.trim() === "" || leftover) failed++;
  console.log(`${c}\n  -> ${out}\n`);
}
console.log(failed ? `FAILED (${failed})` : "OK — generators expand end-to-end via the engine");
process.exit(failed ? 1 : 0);
