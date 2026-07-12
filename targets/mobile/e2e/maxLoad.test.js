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
 * invariant is **scaling**: a virtualized list holds a window of rows, so going from 20 prompts to
 * 1000 (50×) must NOT cost 50× the memory or collapse the frame rate. If someone swaps FlashList for
 * a `.map()`, or makes the rows re-render on every state change, memory explodes and janky frames
 * spike — and this fails. On a healthy app the two rolls look nearly identical, which is the whole
 * point of the promise.
 *
 * The baseline is measured in the same session on the same device, so emulator noise, GPU mode and
 * CPU contention cancel out instead of being budgeted for.
 */
const { device, element, by, waitFor } = require("detox");
const jestExpect = require("expect").default; // Detox's `expect` shadows Jest's — see Detox docs.
const { resetFrameStats, readFrameStats, readMemoryMb } = require("./deviceMetrics");

/** The app's SUPPORTED load — the level it handles with no performance loss, NOT a cap. */
const MAX_PROMPTS = Number(process.env.MOBILE_MAX_PROMPTS || 1000);
/** The control group: a roll small enough that no virtualization is needed to survive it. */
const BASELINE_PROMPTS = 20;

/** Measurements from the small roll, used as the yardstick for the big one. */
let baseline = null;

/** Roll N prompts and wait for the app to say it produced exactly N. */
async function roll(n) {
  // The composer (count field + generate button) is the results list's HEADER — so the previous
  // measurement's scrolling leaves it off screen, and Espresso refuses to act on a view that isn't
  // visible ("the target view does not match one or more of the following constraints"). Ride the list
  // back to the top first. (Found on the first real CI run: the baseline roll passed, the 1000 roll
  // failed in 19 ms — a test-harness bug, not the app's, and worth the two lines to say so.)
  try {
    await element(by.id("results-list")).scrollTo("top");
  } catch {
    // Nothing rolled yet — the list isn't scrollable. Fine.
  }

  await element(by.id("prompt-count")).replaceText(String(n));
  // Dismiss the number pad so it can't sit on top of the generate button.
  await element(by.id("prompt-count")).tapReturnKey();

  const started = Date.now();
  await element(by.id("generate")).tap();
  await waitFor(element(by.id("results-count")))
    .toHaveText(`${n} generated`)
    .withTimeout(180000);
  return Date.now() - started;
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
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
    await waitFor(element(by.id("generate")))
      .toBeVisible()
      .withTimeout(120000);
  });

  it(`rolls ${BASELINE_PROMPTS} prompts (the baseline this device is judged against)`, async () => {
    const elapsed = await roll(BASELINE_PROMPTS);
    const { frames, memMb } = await scrollAndMeasure(device.id, 3);
    baseline = { elapsed, frames, memMb };

    // eslint-disable-next-line no-console
    console.log(
      `[device] ${BASELINE_PROMPTS} prompts: ${elapsed}ms · ${memMb.toFixed(0)}MB · ` +
        `${frames.janky}/${frames.total} janky (${frames.jankPercent}%) · p90 ${frames.p90}ms`,
    );

    jestExpect(memMb).toBeGreaterThan(0); // the metrics pipe works; without this the test is blind
  });

  it(`rolls ${MAX_PROMPTS} prompts and stays smooth — the promise, on real frames`, async () => {
    const elapsed = await roll(MAX_PROMPTS);
    const { frames, memMb } = await scrollAndMeasure(device.id, 8);

    // eslint-disable-next-line no-console
    console.log(
      `[device] ${MAX_PROMPTS} prompts: ${elapsed}ms · ${memMb.toFixed(0)}MB · ` +
        `${frames.janky}/${frames.total} janky (${frames.jankPercent}%) · p90 ${frames.p90}ms · ` +
        `p95 ${frames.p95}ms · p99 ${frames.p99}ms`,
    );

    // 1. It PRODUCED all of them. (`roll` already waited for "1000 generated" — a partial roll times
    //    out rather than passing quietly, which is how a re-introduced cap gets caught.)
    //    The ceiling is deliberately loose: the engine does this in ~0.2 ms/prompt, so anything under
    //    a minute means the cost is not the engine going quadratic.
    jestExpect(elapsed).toBeLessThan(60000);

    // 2. It stayed VIRTUALIZED — the invariant the proxy could not see. 50× the rows must not mean
    //    50× the memory; a recycled window is roughly flat. The allowance (2× + 120MB) is enormous
    //    compared to a real regression (every row mounted is orders of magnitude), so this fails on
    //    pathology, not on noise.
    const memCeiling = baseline.memMb * 2 + 120;
    jestExpect(memMb).toBeLessThan(memCeiling);

    // 3. It stayed SMOOTH. Compared against this device's own baseline, not an absolute frame budget
    //    — a software-rendered emulator janks even when the app is perfect, and that noise is
    //    identical in both rolls.
    const jankCeiling = Math.max(baseline.frames.jankPercent * 2 + 15, 35);
    jestExpect(frames.total).toBeGreaterThan(10); // we really did drive frames
    jestExpect(frames.jankPercent).toBeLessThan(jankCeiling);

    // 4. It stayed ALIVE. The app is still interactive after the big roll — no ANR, no frozen JS
    //    thread. (A list that mounted 1000 rows typically passes 1–3 and dies here.)
    await element(by.id("prompt-count")).replaceText("7");
    await expect(element(by.id("prompt-count"))).toHaveText("7");
  });
});
