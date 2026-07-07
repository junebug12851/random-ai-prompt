/**
 * The catalog behind the Manage-tab DPL **refine** toolbar: the AI refinement actions grouped by
 * dimension (Detail, Complexity, Focus, Intensity, Variety) plus a standalone Polish action. Each
 * action carries the `mode` string handed to the text (rewrite) provider via `systemFor(mode)` — the
 * same plumbing the list editor's "AI Expand" uses — so no new provider code is needed. The
 * dimensions come in a more/less pair; the model is taught DPL by the shared `DPL_PRIMER`.
 *
 * `getDplRefineActions(intl)` localizes the labels/hints; the raw mode strings stay verbatim. The
 * "create from description" action is intentionally NOT here — it lives on its own control in the bar
 * because it takes a free-text description rather than acting on the current template.
 * @module gui/lib/dpl/dplRefine
 */
import { m } from "./dplRefineMessages.js";

/** Every refine mode this catalog can emit (plus the creator), for validation + tests. */
export const DPL_REFINE_MODES = Object.freeze([
  "dpl-detail-more",
  "dpl-detail-less",
  "dpl-complex-more",
  "dpl-complex-less",
  "dpl-focus-more",
  "dpl-focus-less",
  "dpl-intensity-more",
  "dpl-intensity-less",
  "dpl-variety-more",
  "dpl-variety-less",
  "dpl-tighten",
]);

/** The create-from-description mode (used by the bar's own control). */
export const DPL_CREATE_MODE = "dpl-create";

/** The free-text "apply this instruction to the current template" mode. */
export const DPL_CUSTOM_MODE = "dpl-custom";

/**
 * Compose the user message for a {@link DPL_CUSTOM_MODE} request: the free-text instruction, then the
 * current template after a fixed `--- TEMPLATE ---` delimiter the system prompt keys on.
 * @param {string} instruction The user's change request.
 * @param {string} template The current DPL template.
 * @returns {string} The combined prompt for the text provider.
 */
export function buildCustomPrompt(instruction, template) {
  return `INSTRUCTION:\n${String(instruction ?? "").trim()}\n\n--- TEMPLATE ---\n${String(template ?? "")}`;
}

/**
 * Build the localized refine-action catalog.
 * @param {import("react-intl").IntlShape} intl The react-intl instance (from `useIntl()`).
 * @returns {Array<{key: string, label: string, actions: Array<{id: string, mode: string, label: string, hint: string, dir: ("more"|"less"|"only")}>}>}
 *   Dimension groups, each with one or two direction actions.
 */
export function getDplRefineActions(intl) {
  const t = (d) => intl.formatMessage(d);
  return [
    {
      key: "detail",
      label: t(m.detailLabel),
      actions: [
        { id: "detail-more", mode: "dpl-detail-more", dir: "more", label: t(m.detailMore), hint: t(m.detailMoreHint) },
        { id: "detail-less", mode: "dpl-detail-less", dir: "less", label: t(m.detailLess), hint: t(m.detailLessHint) },
      ],
    },
    {
      key: "complex",
      label: t(m.complexLabel),
      actions: [
        { id: "complex-more", mode: "dpl-complex-more", dir: "more", label: t(m.complexMore), hint: t(m.complexMoreHint) },
        { id: "complex-less", mode: "dpl-complex-less", dir: "less", label: t(m.complexLess), hint: t(m.complexLessHint) },
      ],
    },
    {
      key: "focus",
      label: t(m.focusLabel),
      actions: [
        { id: "focus-more", mode: "dpl-focus-more", dir: "more", label: t(m.focusMore), hint: t(m.focusMoreHint) },
        { id: "focus-less", mode: "dpl-focus-less", dir: "less", label: t(m.focusLess), hint: t(m.focusLessHint) },
      ],
    },
    {
      key: "intensity",
      label: t(m.intensityLabel),
      actions: [
        { id: "intensity-more", mode: "dpl-intensity-more", dir: "more", label: t(m.intensityMore), hint: t(m.intensityMoreHint) },
        { id: "intensity-less", mode: "dpl-intensity-less", dir: "less", label: t(m.intensityLess), hint: t(m.intensityLessHint) },
      ],
    },
    {
      key: "variety",
      label: t(m.varietyLabel),
      actions: [
        { id: "variety-more", mode: "dpl-variety-more", dir: "more", label: t(m.varietyMore), hint: t(m.varietyMoreHint) },
        { id: "variety-less", mode: "dpl-variety-less", dir: "less", label: t(m.varietyLess), hint: t(m.varietyLessHint) },
      ],
    },
    {
      key: "polish",
      label: t(m.polishLabel),
      actions: [{ id: "tighten", mode: "dpl-tighten", dir: "only", label: t(m.tighten), hint: t(m.tightenHint) }],
    },
  ];
}

/**
 * Normalize a model's DPL reply into a clean template: strip a wrapping markdown code fence (``` or
 * ```dpl), trim surrounding blank lines, and drop a single pair of wrapping quotes if the whole
 * thing is quoted. Never touches the interior — DPL indentation and blank lines inside are preserved.
 * @param {string} out The raw provider text.
 * @returns {string} The cleaned DPL (may be empty if the model returned nothing usable).
 */
export function cleanDplOutput(out) {
  let text = String(out ?? "").replace(/\r\n/g, "\n");
  // Strip a single wrapping fenced block: optional leading ```lang and trailing ```.
  const fence = text.match(/^\s*```[^\n]*\n([\s\S]*?)\n?```\s*$/);
  if (fence) text = fence[1];
  text = text.replace(/^\n+/, "").replace(/\s+$/, "");
  // Drop one pair of wrapping quotes only if they enclose the whole (single-line) reply.
  if (/^"[^\n]*"$/.test(text) || /^'[^\n]*'$/.test(text)) text = text.slice(1, -1);
  return text;
}

export default getDplRefineActions;
