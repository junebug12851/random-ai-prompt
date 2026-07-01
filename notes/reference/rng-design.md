# Randomness & seeding design

How the engine draws randomness, and how a generation is made deterministic (reproducible from a
seed). Introduced in 2.35.0; replaces the earlier "swap `Math.random`" approach.

## The problem it replaces

Every random draw in the pipeline used to bottom out in the global `Math.random`, and "seeding" for
tests meant swapping `Math.random` for a fixed sequence (`tests/helpers/seededRandom.js`). That works
for a snapshot test but is a leaky global side effect, and anything that captured `Math.random` at
import time — notably **lodash** `_.random` / `_.sample` / `_.shuffle` — escaped the swap entirely, so
a few generators could never actually be seeded. There was also a raw `Math.random()` leak inside the
DPL renderer's `weightedSampleN`.

## The pieces

- **`src/core/rng.js`** — a real, self-contained PRNG.
  - `cyrb128(str)` hashes an arbitrary seed **string** into 128 bits of state (so `"1"` and `"2"` are
    unrelated streams, and any string is a valid seed).
  - `sfc32(a,b,c,d)` is a small, fast, well-distributed 128-bit-state generator → floats in [0, 1).
  - `Rng` wraps them with the draws the pipeline needs: `float` / `int` / `chance` / `pick` /
    `sample` / `shuffle`, plus **`fork(label)`** to derive an independent, deterministic sub-stream.
  - `createRng(seed)` builds one, generating (and recording on `.seed`) a random seed when none is
    given — so an unseeded run can still be captured and replayed.
- **`src/helpers/random.js`** — the pipeline's draw helpers (`randomFloat` / `randomInt` / `sample` /
  `shuffle`) now read from an **ambient** source. Default is `Math.random` (so unseeded behavior is
  unchanged and the legacy Math.random-swap test path still works). `withAmbientRng(rng, fn)` installs
  an `Rng` as the ambient source for the duration of `fn` (nestable, restores on exit).
- **`src/core/dpl/rng.js`** — the DPL renderer's `ctx.rng` seam delegates to `randomFloat`, and now
  also exposes `float()`. The `weightedSampleN` leak was fixed to draw from `ctx.rng`.

## How the engine uses it

`src/core/engine.js` installs the ambient `Rng` for a generation:

- `generate({ seed })` — seeded → deterministic (same seed + catalog → same prompt); unseeded → draws
  from `Math.random` as before.
- `generateWithSeed(settings)` — always deterministic and **returns `{ prompt, seed }`**, auto-choosing
  a seed when none is given. Pass the `seed` back as `settings.seed` to reproduce the prompt.
- `generateMany({ seed })` — each prompt gets its own sub-stream (`parent.fork(i)`), so the whole batch
  is reproducible.
- `generateManyAsync(settings)` — same output/seeding as `generateMany`, but yields to the event loop
  between prompts so a large batch doesn't block. This is the **async-capable boundary**: the
  per-prompt render is pure CPU and stays synchronous by design (it also drives the instant live
  preview, which must not become async).

`settings.seed` flows through the GUI facade (`gui/src/lib/promptEngine.js`) automatically because it
spreads `settings`, so a seed field in the UI is a thin follow-up — the engine already honors it.

## Rules

- **Never** use lodash `_.random` / `_.sample` / `_.shuffle` (or a bare `Math.random`) in engine code
  or in a generator — they bypass the ambient source and can't be seeded. Use `src/helpers/random.js`
  (or `ctx.rng` inside the DPL renderer). The two intentional `Math.random` fallbacks live in
  `rng.js` (`randomSeed`) and `helpers/random.js` (the unseeded default).
- Determinism holds for a fixed **catalog** (lists/generators). Editing content changes output for a
  given seed — that's expected.
