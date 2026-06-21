/**
 * @file
 * @brief End-to-end: run the core engine over v3 `.dpl` generators (lists + JS sidecars resolve).
 *        Run: node scripts/dpl-engine-check.mjs
 */
import { createEngine } from "../src/core/engine.js";
import { nodeLoader } from "../src/core/nodeLoader.js";

const engine = createEngine(nodeLoader);
const cases = [
  "{#cave}", // v3 default (bare)
  "{#furry}",
  "{#vibrant-art}",
  "{#space}",
  "{#entity}",
  "{#random-words}",
  "{#v3/scene/cave}", // explicit v3 path
  "{#v1/castle}", // frozen v1 by prefix
  "{#v2/scene/cave}", // frozen v2 by full path
  "{#v2/cave}", // frozen v2 by suffix within v2
  "{#scene}", // v3 implied folder group (pick one scene)
  "{#v2/scene}", // v2 implied folder group — frozen generations are first-class
  "{#any}", // v3 wildcard
  "{#v2/any}", // v2 wildcard
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
console.log(failed ? `FAILED (${failed})` : "OK — v3 generators expand end-to-end via the engine");
process.exit(failed ? 1 : 0);
