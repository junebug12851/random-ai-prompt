/**
 * @file What does ONE prompt actually cost, and where does the time go?
 *
 * The on-device gate measured the engine at **23–30 ms/prompt** on an Android emulator while Node does
 * the same work in a fraction of a millisecond. Two explanations fit that gap — "Hermes has no JIT and
 * the CI CPU is emulated" (fine, nothing to do) and "the engine does something pathological that V8's
 * optimizer hides from us" (very much something to do) — and hand-waving cannot tell them apart.
 *
 * So: measure in Node first, with the SAME loader and the SAME settings the phone uses, and get a
 * per-prompt cost and a scaling curve. That is the number every device figure gets compared against.
 *
 * Run: `node scripts/profile-engine.mjs [--loader=node|metro] [--n=1000]`
 */
import { createEngine } from "../engine/core/engine.js";
import { createPromptRun } from "../engine/promptRun.js";
import baseSettings from "../engine/settings.js";

const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.slice(k.length + 3) : d;
};

const which = arg("loader", "node");
const { nodeLoader } = await import("../engine/core/nodeLoader.js");
const loader =
  which === "metro" ? (await import("../engine/core/metroLoader.js")).metroLoader : nodeLoader;

const run = createPromptRun(createEngine(loader));

/** The settings the mobile app actually generates with (its defaults, one prompt at a time). */
const settings = { ...baseSettings, generateImages: false };

/** Time a batch, discarding the first (JIT warm-up / lazy catalog reads would flatter later runs). */
function timeBatch(n) {
  const t0 = process.hrtime.bigint();
  const { prompts } = run.generatePrompts({ ...settings, promptCount: n, randomSeed: true });
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  if (prompts.length !== n) throw new Error(`asked for ${n}, got ${prompts.length}`);
  return ms;
}

timeBatch(20); // warm the caches so the curve measures steady-state work, not first-touch I/O

const N = Number(arg("n", "1000"));
console.log(`engine profile — loader=${which}, prompt=${JSON.stringify(settings.prompt)}\n`);
console.log("      N        total     per prompt");
for (const n of [20, 200, N].filter((v, i, a) => a.indexOf(v) === i)) {
  const ms = timeBatch(n);
  console.log(
    `${String(n).padStart(7)}  ${`${ms.toFixed(1)} ms`.padStart(11)}  ${`${(ms / n).toFixed(3)} ms`.padStart(12)}`,
  );
}
console.log(
  "\nCompare against the device (Detox run): ~23–30 ms/prompt on an emulator. A LINEAR curve here with a\n" +
    "tiny per-prompt cost means the engine is sound and the gap is the runtime (Hermes, no JIT) plus an\n" +
    "emulated CPU — measure on a real handset before optimising anything.",
);
