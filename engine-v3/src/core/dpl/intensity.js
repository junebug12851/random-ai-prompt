/**
 * @file
 * @brief DPL intensity + focus dial math: clamping to 1..100, count scaling, relative
 * modifiers, and dial-condition evaluation. See notes/reference/intensity-design.md and
 * notes/reference/focus-design.md.
 */

// Intensity: a per-reference "how much" dial (1..100). Unspecified → DEFAULT_INTENSITY; 0 → 1.
// See notes/reference/intensity-design.md.
export const DEFAULT_INTENSITY = 50;

// Focus: a per-reference "how pure / how narrow" dial (1..100), a SIBLING of intensity. Low focus
// admits fluff/extra/unrelated detail (a city in a cave scene, distant mountains, mood garnish); high
// focus keeps only what is strictly essential to the subject, which also makes a generator stack more
// cleanly as a global layer. Unlike intensity, focus does NOT auto-scale gates/counts — it is purely
// author-judged via `[f<NN%]` conditions and the `$focus` token (a human/AI decides, per line, what
// is fluff at what focus). See notes/reference/focus-design.md.
export const DEFAULT_FOCUS = 50;

/** Normalize an intensity argument to an integer 1..100 (undefined → default, 0 → 1, >100 → 100). */
export function clampIntensity(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return DEFAULT_INTENSITY;
  const r = Math.round(n);
  if (r <= 0) return 1; // "0% is assumed to be 1%"
  return Math.min(r, 100);
}

/** Normalize a focus argument to an integer 1..100 (undefined → default, 0 → 1, >100 → 100). */
export function clampFocus(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return DEFAULT_FOCUS;
  const r = Math.round(n);
  if (r <= 0) return 1;
  return Math.min(r, 100);
}

/** Scale an authored count by intensity: round(n × intensity/100), never below 0. */
export function scaleCount(n, intensity) {
  return Math.max(0, Math.round(n * (intensity / 100)));
}

/**
 * Apply a relative modifier to an intensity, clamped to 1..100. A signed percent is taken *of the
 * value* — `+25` → ×1.25, `-25` → ×0.75 ("25% more/less of the intensity"). `null`/`""` → unchanged.
 */
export function applyIntensityMod(base, mod) {
  if (mod == null || mod === "") return clampIntensity(base);
  const p = Number(mod);
  if (!Number.isFinite(p)) return clampIntensity(base);
  return clampIntensity(base * (1 + p / 100));
}

/** Evaluate a dial condition (`{op, value}`) against the current dial value (intensity or focus). */
export function condPasses(cond, value) {
  switch (cond.op) {
    case "<":
      return value < cond.value;
    case "<=":
      return value <= cond.value;
    case ">":
      return value > cond.value;
    case ">=":
      return value >= cond.value;
    case "=":
    case "==":
      return value === cond.value;
    case "!=":
      return value !== cond.value;
    default:
      return true;
  }
}
