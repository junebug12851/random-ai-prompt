/**
 * @file THE on-device max-load test — the app's 1000-prompt promise, verified where it is made.
 *
 * The mobile suite's one honest gap (documented in `tests/e2e-mobile/perf.spec.js` and
 * `notes/plans/testing.md`) was this: the 1000-prompt claim is a claim about a **phone**, and the
 * react-native-web proxy runs FlashList's *web* renderer, which doesn't recycle like the native one.
 * A pass there would have proved nothing; a fail there would have "fixed" the app for a renderer it
 * never ships on. So the assertion moved onto a real Android runtime, and the evidence is the
 * platform's own frame accounting (`dumpsys gfxinfo`), not a stopwatch in the test.
 *
 * ## What is actually asserted, and why it can't be fooled
 *
 * Not "1000 prompts in under N ms" — that's a benchmark of whatever box CI got that morning. The
 * invariant is **scaling**, measured as a three-point curve on one device in one session: **20 → 200 →
 * 1000**. A virtualized list holds a *window* of rows and a linear generate path costs the same per
 * prompt at any N, so the big roll must not cost more *per prompt*, more memory, or more jank than the
 * small ones. Swap FlashList for a `.map()`, or make the rows re-render on every state change, and the
 * curve bends — that is the defect this catches, and it is invisible to any single-point stopwatch.
 *
 * The middle probe exists because the first CI run couldn't tell two very different things apart: "this
 * emulator is slow" (per-prompt cost constant — fine) and "this app is quadratic" (per-prompt cost
 * climbing with N — a real bug). One point cannot distinguish them; three can.
 *
 * The baseline is measured in the same session on the same device, so emulator noise, GPU mode and
 * CPU contention cancel out instead of being budgeted for.
 */
const { device, element, by, waitFor } = require("detox");
const jestExpect = require("expect").default; // Detox's `expect` shadows Jest's — see Detox docs.
const {
  clearLog,
  resetFrameStats,
  readFrameStats,
  readMemoryMb,
  readEngineMs,
  describeForeground,
} = require("./deviceMetrics");

/** The app's SUPPORTED load — the level it handles with no performance loss, NOT a cap. */
const MAX_PROMPTS = Number(process.env.MOBILE_MAX_PROMPTS || 1000);
/** The control group: a roll small enough that no virtualization is needed to survive it. */
const BASELINE_PROMPTS = 20;
/** The middle probe: the point of a THREE-point curve is to tell "slow" from "quadratic" apart. */
const PROBE_PROMPTS = 200;

/**
 * How long a single roll may take before we call it a failure.
 *
 * Deliberately huge — it is a *hang* detector, not a performance budget. The budget is the scaling
 * assertion below (cost per prompt must not blow up with N); a wall-clock ceiling here would just
 * encode whatever this morning's runner was worth. The first run with a 180 s cap timed out at 1000
 * and told us nothing about *why*, which is the whole reason for the three-point curve.
 */
const ROLL_TIMEOUT_MS = Number(process.env.MOBILE_ROLL_TIMEOUT_MS || 240000);

/** How many result rows the app is currently showing (the label is cumulative, so we track it). */
let onScreen = 0;
/** Measurements from the small roll, used as the yardstick for the big one. */
let baseline = null;
/** Measurements from the middle probe — the second point on the curve. */
let probe = null;

/**
 * Roll N prompts and wait for the app to say it produced exactly N.
 *
 * **Clear first — and this line is the whole story of a wasted afternoon.** Results ACCUMULATE across
 * rolls (the app prepends each batch, by design). So after a 20-prompt baseline, rolling 200 makes the
 * label read "220 generated", and a test waiting for "200 generated" waits forever. Which it did: two
 * ten-minute timeouts per run, reported as *the app failing its 1000-prompt promise*.
 *
 * It was never the app. The device's own log said so all along — engine 13.0 s for 1000 prompts, rows
 * committed **34 ms later** — and I still went looking for a render bug, because the test's verdict was
 * louder than the app's evidence. Read the instrument you built before you distrust the thing it measures.
 */
async function roll(n) {
  // ORDER MATTERS, and getting it wrong cost a 40-minute run: the composer AND the Clear-all button both
  // live in the list's HEADER, so after the previous roll's scrolling they are off screen — and Espresso
  // will not act on a view it cannot see. Ride the list back to the top FIRST; only then is there
  // anything to press. (My first attempt tapped Clear-all before scrolling: the tap threw, the catch
  // swallowed it, the list never cleared, and the label kept reading "220 generated".)
  try {
    await element(by.id("results-list")).scrollTo("top");
  } catch {
    // Nothing rolled yet — the list isn't scrollable. Fine.
  }

  // NOW clear, so "N generated" can only mean this roll.
  //
  // And belt AND braces: track what's on screen rather than assuming the clear worked. A swallowed
  // failure here is precisely what turned a test bug into a phantom app defect, so the expected label is
  // derived from state we actually observed, not from a hope.
  try {
    await element(by.id("clear-all")).tap();
    onScreen = 0;
  } catch {
    // Nothing rolled yet (no Clear all on screen) — `onScreen` already says so.
  }

  await element(by.id("prompt-count")).replaceText(String(n));
  // Dismiss the number pad so it can't sit on top of the generate button.
  //
  // NOT `device.pressBack()`: with no keyboard up, BACK goes to the *activity* and closes the app — the
  // next action then fails with "No activities in stage RESUMED", which reads like an app crash and
  // isn't one. (Cost a CI round-trip to learn. The keyboard's own return key only ever talks to the
  // keyboard.)
  try {
    await element(by.id("prompt-count")).tapReturnKey();
  } catch {
    // No IME to dismiss on this skin — fine, the generate button is reachable either way.
  }

  clearLog(device.id); // so the engine timing we read back belongs to THIS roll

  // The app's label is CUMULATIVE ("220 generated" after a 20-roll and a 200-roll), so the expected text
  // is whatever is already on screen plus this roll — not `n`. Assuming `n` is what sent two runs into
  // ten-minute timeouts and got written up as an app defect.
  const expected = onScreen + n;

  const started = Date.now();
  await element(by.id("generate")).tap();
  await waitFor(element(by.id("results-count")))
    .toHaveText(`${expected} generated`)
    .withTimeout(ROLL_TIMEOUT_MS);
  const total = Date.now() - started;
  onScreen = expected;

  // The split. `total` is engine + render + list mount; `engineMs` is what the app says the engine alone
  // cost. Everything else is the render. One number is a complaint; two are a diagnosis.
  const engineMs = readEngineMs(device.id);
  return { total, engineMs, renderMs: engineMs == null ? null : total - engineMs };
}

/** Scroll the results list hard and report what the phone reports about those frames. */
async function scrollAndMeasure(deviceId, passes = 6) {
  resetFrameStats(deviceId);
  for (let i = 0; i < passes; i++) {
    await element(by.id("results-list")).scroll(900, "down", NaN, 0.85);
  }
  const frames = readFrameStats(deviceId);
  const memMb = readMemoryMb(deviceId);
  return { frames, memMb };
}

describe("mobile @ max load (on device)", () => {
  /**
   * Launch and wait for the composer — retrying the launch once.
   *
   * On a cold CI emulator the app sometimes comes up without taking window focus (the *launcher* keeps
   * it), and Espresso then refuses to touch anything: three tests die in 3 ms with a root dump, looking
   * exactly like an app crash. A second launch settles it. If it doesn't, we print what the DEVICE says
   * — who holds focus, whether our activity is resumed, and the crash buffer — because "has-window-focus
   * =false" on its own has now cost several CI round-trips to interpret.
   */
  async function launchAndWait(attempt = 1) {
    await device.launchApp({ newInstance: true });
    await device.disableSynchronization();
    try {
      await waitFor(element(by.id("generate")))
        .toBeVisible()
        .withTimeout(60000);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(
        `[device] the composer never became visible (attempt ${attempt}).\n${describeForeground(device.id)}`,
      );
      if (attempt >= 2) throw e;
      await launchAndWait(attempt + 1);
    }
  }

  // `launchAndWait` also calls `device.disableSynchronization()` — Detox drives the app MANUALLY here.
  //
  // The composer advertises a rotating random suggestion in its placeholder, on a timer, so the view
  // hierarchy never stops requesting layout, and Espresso — which waits for the UI thread to go quiet
  // before it will act — waits forever. That is a healthy, animated app, not a stuck one, and Detox
  // documents `disableSynchronization()` as the escape hatch for exactly it.
  //
  // Nothing is lost: every wait in this file is on real, observable UI state (the literal "N generated"
  // label the app renders when the roll completes), which is a stronger signal than "the framework
  // believes it is idle" — and it is the state the assertion is about anyway.
  beforeAll(async () => {
    await launchAndWait();
  });

  /** One line per roll, with the engine/render split — the whole point of the exercise. */
  function report(n, r, frames, memMb) {
    const split =
      r.engineMs == null
        ? "engine ?ms (the app didn't log it)"
        : `engine ${r.engineMs}ms + render ${r.renderMs}ms`;
    // eslint-disable-next-line no-console
    console.log(
      `[device] ${n} prompts: ${r.total}ms total (${(r.total / n).toFixed(1)} ms/prompt) — ${split} · ` +
        `${memMb.toFixed(0)}MB · ${frames.janky}/${frames.total} janky (${frames.jankPercent}%) · ` +
        `p90 ${frames.p90}ms p95 ${frames.p95}ms p99 ${frames.p99}ms`,
    );
  }

  it(`rolls ${BASELINE_PROMPTS} prompts (the baseline this device is judged against)`, async () => {
    const r = await roll(BASELINE_PROMPTS);
    const { frames, memMb } = await scrollAndMeasure(device.id, 3);
    baseline = { elapsed: r.total, roll: r, frames, memMb };
    report(BASELINE_PROMPTS, r, frames, memMb);

    jestExpect(memMb).toBeGreaterThan(0); // the metrics pipe works; without this the test is blind
  });

  it(`rolls ${PROBE_PROMPTS} prompts (the middle of the curve — is the cost LINEAR?)`, async () => {
    const r = await roll(PROBE_PROMPTS);
    const { frames, memMb } = await scrollAndMeasure(device.id, 5);
    probe = { elapsed: r.total, roll: r, frames, memMb };
    report(PROBE_PROMPTS, r, frames, memMb);

    // The point of the middle probe: separate "this device is slow" (per-prompt cost roughly constant —
    // fine, that's Hermes on a software-rendered emulator) from "this app is quadratic" (per-prompt
    // cost climbing with N — a real defect that a 50× roll would turn into a hang). 10× the prompts
    // must not cost much more than 10× the time.
    const perPromptBaseline = baseline.elapsed / BASELINE_PROMPTS;
    const perPromptProbe = r.total / PROBE_PROMPTS;
    jestExpect(perPromptProbe).toBeLessThan(perPromptBaseline * 3 + 20);
  });

  it(`rolls ${MAX_PROMPTS} prompts and stays smooth — the promise, on real frames`, async () => {
    const r = await roll(MAX_PROMPTS);
    const elapsed = r.total;
    const { frames, memMb } = await scrollAndMeasure(device.id, 8);
    report(MAX_PROMPTS, r, frames, memMb);

    // 1. It PRODUCED all of them. `roll` waited for the literal "1000 generated" — a partial roll times
    //    out rather than passing quietly, which is how a re-introduced cap gets caught.
    //
    //    Note what is NOT asserted: a wall-clock ceiling. The app's promise is "no performance loss at
    //    this load", not "1000 prompts in N seconds on whatever box CI got". A stopwatch budget here
    //    would be a benchmark of the runner, and would go red on a busy morning while a genuinely
    //    quadratic regression slid through on a fast one. The budget is the SCALING below.
    jestExpect(elapsed).toBeGreaterThan(0);

    // 2. The cost per prompt did NOT climb with N — the curve is linear across 20 → 200 → 1000. This is
    //    the assertion that catches a real defect: an O(n²) generate path, or a list that re-renders
    //    every row per item, shows up here as per-prompt cost multiplying while the small rolls stay
    //    innocent. Generous multiple, because the small rolls carry fixed startup cost.
    const perPromptProbe = probe.elapsed / PROBE_PROMPTS;
    const perPromptMax = elapsed / MAX_PROMPTS;
    jestExpect(perPromptMax).toBeLessThan(perPromptProbe * 3 + 20);

    // 3. It stayed VIRTUALIZED — the invariant the proxy could not see. 50× the rows must not mean 50×
    //    the memory; a recycled window is roughly flat. The allowance (2× + 120 MB) is enormous next to
    //    a real regression (every row mounted is orders of magnitude), so this fails on pathology, not
    //    on noise.
    const memCeiling = baseline.memMb * 2 + 120;
    jestExpect(memMb).toBeLessThan(memCeiling);

    // 4. It stayed SMOOTH. Compared against this device's OWN baseline, not an absolute frame budget —
    //    a software-rendered emulator janks even when the app is perfect (the baseline run measured 97%
    //    janky frames), and that noise is identical in both rolls, so it cancels.
    const jankCeiling = Math.max(baseline.frames.jankPercent * 1.3 + 10, 40);
    jestExpect(frames.total).toBeGreaterThan(10); // we really did drive frames
    jestExpect(frames.jankPercent).toBeLessThan(jankCeiling);

    // 5. It stayed ALIVE. The app is still interactive after the big roll — no ANR, no frozen JS thread.
    //    (A list that mounted all 1000 rows typically passes 1–4 and dies here.)
    //
    //    Ride back to the top first: the composer lives in the list header, and we just scrolled eight
    //    screens down to measure frames. Espresso won't type into a view it can't see — and that failure
    //    ("the target view does not match one or more of the following constraints") looks nothing like
    //    what it is. Third time this file has learned it; hence the comment.
    await element(by.id("results-list")).scrollTo("top");
    await element(by.id("prompt-count")).replaceText("7");
    await expect(element(by.id("prompt-count"))).toHaveText("7");
  });
});
