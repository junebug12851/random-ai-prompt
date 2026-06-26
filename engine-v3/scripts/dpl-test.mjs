/**
 * @file
 * @brief Standalone checks for the DPL engine (src/core/dpl/dpl.js). Run: node scripts/dpl-test.mjs
 */
import { compileDpl } from "../src/core/dpl/dpl.js";

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) {
    pass++;
  } else {
    fail++;
    console.error(`  FAIL: ${name}`);
  }
}
// Render a source N times and return the set of outputs (to test randomness).
function runs(src, n = 400, bridge = null) {
  const mod = compileDpl(src, bridge);
  return Array.from({ length: n }, () => mod.default({}, {}, {}));
}

// 1. Weights reorder locally: explicit [10] beats auto-1000, regardless of document order.
{
  const out = runs("Start\n===\naaa\n[10] zzz\n", 1)[0];
  check("weights sort (zzz before aaa)", out === "zzz, aaa");
}

// 2. Plain lines are always emitted; 0% never; 100%/maybe ranges.
{
  const all = runs("Start\n===\nalways here\n- 0% never\n- 100% surely\n");
  check(
    "plain always present",
    all.every((o) => o.includes("always here")),
  );
  check(
    "0% never appears",
    all.every((o) => !o.includes("never")),
  );
  check(
    "100% always appears",
    all.every((o) => o.includes("surely")),
  );
}

// 3. `one of` picks exactly one option.
{
  const all = runs("Start\n===\n- one of:\n    - alpha\n    - beta\n    - gamma\n");
  const ok = all.every((o) => {
    const hits = ["alpha", "beta", "gamma"].filter((w) => o.includes(w)).length;
    return hits === 1;
  });
  check("one of picks exactly one", ok);
  const seen = new Set(all.flatMap((o) => ["alpha", "beta", "gamma"].filter((w) => o.includes(w))));
  check("one of can pick each option", seen.size === 3);
}

// 4. `2 of` picks exactly two distinct options (digit counts only).
{
  const all = runs("Start\n===\n- 2 of:\n    - a1\n    - b2\n    - c3\n");
  const ok = all.every((o) => ["a1", "b2", "c3"].filter((w) => o.includes(w)).length === 2);
  check("2 of picks exactly two", ok);
}

// 5. `one of (50% nothing)` sometimes yields nothing, sometimes one.
{
  const all = runs("Start\n===\n- one of (50% nothing):\n    - solo\n");
  check(
    "miss yields empty sometimes",
    all.some((o) => o === ""),
  );
  check(
    "miss yields the option sometimes",
    all.some((o) => o.includes("solo")),
  );
}

// 6. `repeat 3 times` emits exactly 3 copies.
{
  const out = runs("Start\n===\n- repeat 3 times: star\n", 1)[0];
  check("repeat 3 times -> 3 copies", out === "star, star, star");
}

// 7. `repeat 2 to 4 times` stays in range.
{
  const all = runs("Start\n===\n- repeat 2 to 4 times: x\n");
  const ok = all.every((o) => {
    const c = (o.match(/x/g) || []).length;
    return c >= 2 && c <= 4;
  });
  check("repeat range within 2..4", ok);
}

// 8. maybe / otherwise are mutually exclusive (plain lines inside are always-on when the block runs).
{
  const all = runs("Start\n===\n- maybe:\n    A\n- otherwise:\n    B\n");
  check(
    "maybe/otherwise never both",
    all.every((o) => !(o.includes("A") && o.includes("B"))),
  );
  check(
    "maybe/otherwise always one",
    all.every((o) => o.includes("A") || o.includes("B")),
  );
}

// 9. Local section call (+name) — section names are case-sensitive, so the ref matches the heading.
{
  const src =
    "cave-type\n===\n- one of:\n    - sea cave, {#underwater}\n    - lava cave, {#lava}\n\n" +
    "Start\n===\ncave\n- +cave-type\n";
  const all = runs(src);
  check(
    "call renders a local section",
    all.every((o) => o.startsWith("cave")),
  );
  check(
    "called section produces at most one type",
    all.every((o) => ["sea cave", "lava cave"].filter((w) => o.includes(w)).length <= 1),
  );
}

// 9b. Case-sensitive: a ref whose case differs from the heading does NOT call the local section.
{
  const src = "Cave-Type\n===\n- sea cave\n\nStart\n===\nrock\n- +cave-type\n";
  const all = runs(src);
  check(
    "mismatched-case ref never calls local section",
    all.every((o) => !o.includes("sea cave")),
  );
  check(
    "mismatched-case ref becomes a token (when its 50% bullet fires)",
    all.some((o) => o.includes("{#cave-type}")),
  );
}

// 9c. A bare bullet defaults to ~50% (not always, not never).
{
  const all = runs("Start\n===\n- coin\n");
  const hits = all.filter((o) => o.includes("coin")).length;
  check("bare bullet ~50% (present sometimes)", hits > 120 && hits < 280);
  check(
    "bare bullet absent sometimes",
    all.some((o) => o === ""),
  );
}

// 10. Front-matter: type/full + suggestions:off.
{
  const mod = compileDpl("---\ntype: full\nsuggestions: off\n---\nStart\n===\nhi\n");
  check("full flag parsed", mod.full === true);
  check("suggestion_exclude parsed", mod.suggestion_exclude === true);
}

// 11. JS bridge: inline {js:...} and script delegation.
{
  const bridge = { resolveJs: (path) => `JS(${path})` };
  const inline = compileDpl("Start\n===\n{js:colorful.js} {flower}\n", bridge).default({}, {}, {});
  check("inline js resolves", inline === "JS(colorful.js) {flower}");
  const scripted = compileDpl("---\nscript: entity.js\n---\n", bridge).default({}, {}, {});
  check("script delegation resolves", scripted === "JS(entity.js)");
}

// 12. Per-iteration probability inside a repeat block.
{
  const all = runs("Start\n===\n- repeat 4 times:\n    - 50% bird\n");
  check(
    "per-iteration repeat 0..4 birds",
    all.every((o) => (o.match(/bird/g) || []).length <= 4),
  );
  check(
    "per-iteration sometimes < 4",
    all.some((o) => (o.match(/bird/g) || []).length < 4),
  );
}

console.log(`\nDPL engine: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
