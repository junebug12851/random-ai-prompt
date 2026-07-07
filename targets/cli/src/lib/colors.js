/**
 * @file
 * @brief Terminal color + styling helpers. Wraps picocolors (which already honors NO_COLOR /
 * FORCE_COLOR and TTY detection) and adds a few semantic helpers used across the commands, plus a
 * `--no-color` / `--color` override the program sets before anything prints.
 */
import pc from "picocolors";

// picocolors decides color support at import from process.stdout.isTTY + NO_COLOR/FORCE_COLOR.
// We allow an explicit override (the global --color / --no-color flags) by re-creating the instance.
let colors = pc;

/**
 * Force color on or off (the `--color` / `--no-color` global flags), overriding auto-detection.
 * @param {boolean|undefined} enabled true = force on, false = force off, undefined = auto.
 * @returns {void}
 */
export function setColorEnabled(enabled) {
  if (enabled === undefined) {
    colors = pc;
    return;
  }
  colors = pc.createColors(enabled);
}

/** @returns {boolean} Whether color output is currently active. */
export const colorActive = () => colors.isColorSupported;

// Semantic styles — a thin, stable vocabulary so command code never reaches for raw color names.
export const c = {
  /** @param {string} s @returns {string} */
  heading: (s) => colors.bold(colors.cyan(s)),
  /** @param {string} s @returns {string} */
  subhead: (s) => colors.bold(s),
  /** @param {string} s @returns {string} */
  key: (s) => colors.green(s),
  /** @param {string} s @returns {string} */
  value: (s) => colors.white(s),
  /** @param {string} s @returns {string} */
  muted: (s) => colors.dim(s),
  /** @param {string} s @returns {string} */
  accent: (s) => colors.magenta(s),
  /** @param {string} s @returns {string} */
  ok: (s) => colors.green(s),
  /** @param {string} s @returns {string} */
  warn: (s) => colors.yellow(s),
  /** @param {string} s @returns {string} */
  err: (s) => colors.red(s),
  /** @param {string} s @returns {string} */
  bold: (s) => colors.bold(s),
  /** @param {string} s @returns {string} */
  dim: (s) => colors.dim(s),
  /** @param {string} s @returns {string} */
  underline: (s) => colors.underline(s),
};

/** Prefixes for the three message levels, colored + symbol'd for a modern feel. */
export const badge = {
  ok: () => c.ok("✓"),
  warn: () => c.warn("!"),
  err: () => c.err("✗"),
  info: () => c.accent("›"),
};

/**
 * Print a success/info/warn/error line to the right stream.
 * @param {"ok"|"info"|"warn"|"err"} level The message level.
 * @param {string} msg The message.
 * @returns {void}
 */
export function say(level, msg) {
  const line = `${badge[level] ? badge[level]() : ""} ${msg}`.trim();
  if (level === "err" || level === "warn") console.error(line);
  else console.log(line);
}
