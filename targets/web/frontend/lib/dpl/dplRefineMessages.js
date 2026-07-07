/**
 * @file react-intl messages for the Manage-tab DPL refine toolbar ({@link module:gui/components/DplRefineBar}).
 * Split out of the component so the button catalog ({@link module:gui/lib/dpl/dplRefine}) can be built
 * from an `intl` without pulling in the component. Each refine dimension has a label plus a
 * more/less pair; standalone actions (Tighten) and the Draft-from-description control live here too.
 * @module gui/lib/dpl/dplRefineMessages
 */
import { defineMessages } from "react-intl";

export const m = defineMessages({
  // Toolbar chrome
  lead: { id: "dplRefine.lead", defaultMessage: "Refine" },
  toolbar: { id: "dplRefine.toolbar", defaultMessage: "Refine this template with AI" },

  // Detail
  detailLabel: { id: "dplRefine.detailLabel", defaultMessage: "Detail" },
  detailMore: { id: "dplRefine.detailMore", defaultMessage: "Add detail" },
  detailMoreHint: {
    id: "dplRefine.detailMoreHint",
    defaultMessage: "Layer in more texture, material, lighting, and mood — mostly behind gates.",
  },
  detailLess: { id: "dplRefine.detailLess", defaultMessage: "Trim detail" },
  detailLessHint: {
    id: "dplRefine.detailLessHint",
    defaultMessage: "Strip filler and keep only the strong, essential fragments.",
  },

  // Complexity (structural richness)
  complexLabel: { id: "dplRefine.complexLabel", defaultMessage: "Complexity" },
  complexMore: { id: "dplRefine.complexMore", defaultMessage: "More complex" },
  complexMoreHint: {
    id: "dplRefine.complexMoreHint",
    defaultMessage: "Turn flat lines into choices, gates, and repeats so each roll differs.",
  },
  complexLess: { id: "dplRefine.complexLess", defaultMessage: "Simplify" },
  complexLessHint: {
    id: "dplRefine.complexLessHint",
    defaultMessage: "Collapse choices and gates into fewer, clearer lines.",
  },

  // Focus dial
  focusLabel: { id: "dplRefine.focusLabel", defaultMessage: "Focus" },
  focusMore: { id: "dplRefine.focusMore", defaultMessage: "Sharpen" },
  focusMoreHint: {
    id: "dplRefine.focusMoreHint",
    defaultMessage: "Keep only the essential subject; push fluff behind [f<40%].",
  },
  focusLess: { id: "dplRefine.focusLess", defaultMessage: "Loosen" },
  focusLessHint: {
    id: "dplRefine.focusLessHint",
    defaultMessage: "Add atmospheric garnish as [f<40%] lines for low-focus rolls.",
  },

  // Intensity dial
  intensityLabel: { id: "dplRefine.intensityLabel", defaultMessage: "Intensity" },
  intensityMore: { id: "dplRefine.intensityMore", defaultMessage: "Crank" },
  intensityMoreHint: {
    id: "dplRefine.intensityMoreHint",
    defaultMessage: "Add lavish [i>70%] variants for a richer image when dialed up.",
  },
  intensityLess: { id: "dplRefine.intensityLess", defaultMessage: "Ease" },
  intensityLessHint: {
    id: "dplRefine.intensityLessHint",
    defaultMessage: "Add pared-back [i<25%] variants for a clean image when dialed down.",
  },

  // Variety (per-roll variation)
  varietyLabel: { id: "dplRefine.varietyLabel", defaultMessage: "Variety" },
  varietyMore: { id: "dplRefine.varietyMore", defaultMessage: "More varied" },
  varietyMoreHint: {
    id: "dplRefine.varietyMoreHint",
    // Single-quote the braces so ICU renders a literal {salt} token, not a placeholder.
    defaultMessage: "Add choices and '{salt}' so repeated generations differ.",
  },
  varietyLess: { id: "dplRefine.varietyLess", defaultMessage: "More consistent" },
  varietyLessHint: {
    id: "dplRefine.varietyLessHint",
    defaultMessage: "Fix the most variable choices so rolls look alike.",
  },

  // Polish (single action)
  polishLabel: { id: "dplRefine.polishLabel", defaultMessage: "Polish" },
  tighten: { id: "dplRefine.tighten", defaultMessage: "Tighten" },
  tightenHint: {
    id: "dplRefine.tightenHint",
    defaultMessage: "Fix indentation, tokens, and duplicates without changing the intent.",
  },

  // Free-text message box: a segmented Modify (change the current template) / Draft new (from a
  // description) control with one input.
  askModify: { id: "dplRefine.askModify", defaultMessage: "Modify" },
  askModifyHint: {
    id: "dplRefine.askModifyHint",
    defaultMessage: "Type a change and the AI re-processes the current template.",
  },
  askCreate: { id: "dplRefine.askCreate", defaultMessage: "Draft new" },
  askCreateHint: {
    id: "dplRefine.askCreateHint",
    defaultMessage: "Describe a subject and let AI build a fresh starting template.",
  },
  modifyPlaceholder: {
    id: "dplRefine.modifyPlaceholder",
    defaultMessage: "e.g. make the armor ornate, swap the sword for a spear, add a stormy dusk sky",
  },
  createPlaceholder: {
    id: "dplRefine.createPlaceholder",
    defaultMessage: "e.g. a battle-worn space marine on a rain-soaked alien ruin at dusk",
  },
  modifyAria: { id: "dplRefine.modifyAria", defaultMessage: "Describe a change to this template" },
  createAria: { id: "dplRefine.createAria", defaultMessage: "Describe the subject to draft a template" },
  send: { id: "dplRefine.send", defaultMessage: "Send" },
  createSubmit: { id: "dplRefine.createSubmit", defaultMessage: "Draft" },

  // Shared status / errors (parent-driven)
  working: { id: "dplRefine.working", defaultMessage: "Refining…" },
  drafting: { id: "dplRefine.drafting", defaultMessage: "Drafting…" },
  modifying: { id: "dplRefine.modifying", defaultMessage: "Modifying…" },
  undo: { id: "dplRefine.undo", defaultMessage: "Undo" },
  pickProvider: {
    id: "dplRefine.pickProvider",
    defaultMessage: "Pick a text (AI) provider first — Home → gear → Auto-fix.",
  },
  noKey: {
    id: "dplRefine.noKey",
    defaultMessage: "No API key for {provider} — add it under Home → gear → Auto-fix.",
  },
  needContent: {
    id: "dplRefine.needContent",
    defaultMessage: "Write or draft a template first, then refine it.",
  },
  needDescription: {
    id: "dplRefine.needDescription",
    defaultMessage: "Type a short description first.",
  },
  needInstruction: {
    id: "dplRefine.needInstruction",
    defaultMessage: "Type a change to make first.",
  },
  empty: {
    id: "dplRefine.empty",
    defaultMessage: "The AI returned nothing — try again.",
  },
  applied: {
    id: "dplRefine.applied",
    defaultMessage: "{label} applied — review, then Save.",
  },
  appliedIssues: {
    id: "dplRefine.appliedIssues",
    defaultMessage:
      "{label} applied, but the result has {count, plural, one {# issue} other {# issues}} — review or Undo.",
  },
  drafted: { id: "dplRefine.drafted", defaultMessage: "Drafted a template — review, then Save." },
  modified: { id: "dplRefine.modified", defaultMessage: "Change applied — review, then Save." },
  modifiedIssues: {
    id: "dplRefine.modifiedIssues",
    defaultMessage:
      "Change applied, but the result has {count, plural, one {# issue} other {# issues}} — review or Undo.",
  },
  reverted: { id: "dplRefine.reverted", defaultMessage: "Reverted the last refine." },
  failed: { id: "dplRefine.failed", defaultMessage: "Refine failed: {error}" },
});
