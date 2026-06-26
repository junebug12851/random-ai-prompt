/**
 * Midjourney — prompt formatter. The engine already emits the prompt body in MJ dialect
 * (`word::factor` weighting); this appends the trailing `--param` flags from the catalog
 * (`data/parameters.json`) plus the mutually-exclusive model flag (`--v` or `--niji`,
 * from `data/versions.json`). Data-driven so adding a parameter is a data edit, not code.
 * @module gui/providers/midjourney/code/format
 */
import parameters from "../data/parameters.json";

/**
 * Whether a settings value is "set" (worth emitting). Empty string / null / undefined are
 * unset; `false` is unset for boolean flags (emitted only when true).
 * @param {*} v The value.
 * @returns {boolean}
 */
const isSet = (v) => v !== "" && v !== null && v !== undefined;

/**
 * Append Midjourney parameters to a prompt body.
 * @param {string} prompt The engine-produced MJ prompt body.
 * @param {object} [settings] The provider's params (`ar`, `stylize`, `version`, `niji`, …).
 * @returns {string} The full Midjourney prompt, ready to paste.
 */
export default function format(prompt, settings = {}) {
  const flags = [];

  // Model flag: Niji overrides Version (they're mutually exclusive).
  if (isSet(settings.niji)) flags.push(`--niji ${settings.niji}`);
  else if (isSet(settings.version)) flags.push(`--v ${settings.version}`);

  for (const p of parameters) {
    const v = settings[p.key];
    if (p.type === "bool") {
      if (v === true) flags.push(p.flag); // bare flag, e.g. --tile
    } else if (isSet(v)) {
      flags.push(`${p.flag} ${v}`);
    }
  }

  return [String(prompt || "").trim(), flags.join(" ")].filter(Boolean).join(" ");
}
