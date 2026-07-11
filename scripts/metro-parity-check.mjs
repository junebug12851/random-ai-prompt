/**
 * @file
 * @brief Parity gate for the Metro mobile loader — proves the engine's output through `metroLoader`
 * matches `nodeLoader` exactly (same catalog names + byte-identical seeded generations). This is the
 * GO/NO-GO de-risk check before any Expo/RN scaffolding: if the generated static catalog drives the
 * unchanged engine identically to the filesystem loader, the whole mobile approach is sound.
 *
 * Run against the FULL-tier catalog (so both loaders see the same corpus):
 *   node scripts/build-metro-catalog.mjs --tier=full
 *   node scripts/metro-parity-check.mjs
 */
import { createEngine } from "../engine/core/engine.js";
import { nodeLoader } from "../engine/core/nodeLoader.js";
import { metroLoader } from "../engine/core/metroLoader.js";
import baseSettings from "../engine/settings.js";

let failures = 0;
const fail = (msg) => {
  failures++;
  console.error("  x " + msg);
};
const ok = (msg) => console.log("  ok " + msg);

const setEq = (a, b, label) => {
  const A = new Set(a);
  const B = new Set(b);
  const onlyA = [...A].filter((x) => !B.has(x));
  const onlyB = [...B].filter((x) => !A.has(x));
  if (onlyA.length || onlyB.length) {
    fail(
      `${label}: node-only=[${onlyA.slice(0, 8).join(", ")}] ` +
        `metro-only=[${onlyB.slice(0, 8).join(", ")}] (sizes node=${A.size} metro=${B.size})`,
    );
  } else ok(`${label}: ${A.size} names identical`);
};

console.log("catalog parity (nodeLoader vs metroLoader):");
// The mobile target ships BUILT-IN content only — no `user/` overlay (a local/desktop feature that is
// gated off the online build too). So compare against nodeLoader's built-in catalog by dropping the
// `user/` overlay names, exactly as the online browser build does. A divergence here would mean a REAL
// built-in mismatch, not the expected overlay difference.
const noUser = (names) => names.filter((n) => !String(n).startsWith("user/"));
setEq(noUser(nodeLoader.blockNames()), metroLoader.blockNames(), "blockNames (built-in)");
setEq(noUser(nodeLoader.listNames()), metroLoader.listNames(), "listNames (built-in)");
console.log(`  (metro presets: ${metroLoader.presetNames().length} — node loader exposes none)`);

const nEng = createEngine(nodeLoader);
const mEng = createEngine(metroLoader);

const prompts = [
  "{#random-words}",
  "{#scene}",
  "{#style/anime-realism}",
  "a {look/color} {nature/flower} in {place/city}",
  "{#subject/person}, {#fragment/glow}",
  baseSettings.prompt,
];

console.log("seeded generation parity (node vs metro):");
let genFail = 0;
let genTotal = 0;
for (const prompt of prompts) {
  for (let seed = 1; seed <= 25; seed++) {
    genTotal++;
    const s = { ...baseSettings, prompt, seed, generateImages: false };
    const n = nEng.generate(s);
    const m = mEng.generate(s);
    if (n !== m) {
      genFail++;
      if (genFail <= 4) {
        fail(`prompt=${JSON.stringify(prompt)} seed=${seed}\n      node : ${n}\n      metro: ${m}`);
      }
    }
  }
}
if (genFail === 0) ok(`${genTotal} seeded generations identical across ${prompts.length} prompts`);
else fail(`${genFail}/${genTotal} seeded generations diverged`);

console.log("");
if (failures === 0) {
  console.log("METRO PARITY: PASS — engine output through metroLoader matches nodeLoader.");
  process.exit(0);
} else {
  console.error(`METRO PARITY: FAIL — ${failures} check(s) failed.`);
  process.exit(1);
}
