/**
 * Midjourney — provider-owned settings schema + defaults, **derived from the parameter
 * catalog** (`data/parameters.json` + `data/versions.json`) so the knobs, the UI, and the
 * formatter never drift. The model version (`--v`) and Niji (`--niji`, anime) are mutually
 * exclusive.
 * @module gui/providers/midjourney/settings
 */
import parameters from "./data/parameters.json";
import versions from "./data/versions.json";

/** Map a catalog field type to a UI control type. */
const uiType = (t) =>
  t === "int" || t === "number"
    ? "number"
    : t === "bool"
      ? "checkbox"
      : t === "select"
        ? "select"
        : "text";

const defaults = { version: versions.defaultVersion, niji: "" };
for (const p of parameters) defaults[p.key] = p.default ?? "";

const fields = [
  { key: "version", label: "Version", type: "select", options: versions.versions },
  {
    key: "niji",
    label: "Niji (anime) — overrides version",
    type: "select",
    options: ["", ...versions.nijiVersions],
  },
  ...parameters.map((p) => ({
    key: p.key,
    label: p.label,
    type: uiType(p.type),
    ...(p.min != null ? { min: p.min } : {}),
    ...(p.max != null ? { max: p.max } : {}),
    ...(p.step != null ? { step: p.step } : {}),
    ...(p.options ? { options: p.options } : {}),
  })),
];

export default { defaults, fields };
