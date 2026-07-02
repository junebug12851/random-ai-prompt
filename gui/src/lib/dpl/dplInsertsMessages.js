/**
 * @file react-intl message definitions for the DPL insert toolbar catalog (category labels/hints
 * and per-construct label/desc). Split out of dplInserts.js, which keeps the catalog structure.
 * The `syntax` / `template` / `example` fields are literal DPL and stay verbatim, so they live with
 * the catalog, not here. @module gui/lib/dpl/dplInsertsMessages
 */
import { defineMessages } from "react-intl";

export const m = defineMessages({
  // Categories
  structureLabel: { id: "dplIns.structure.label", defaultMessage: "Structure" },
  structureHint: { id: "dplIns.structure.hint", defaultMessage: "Bullets, ordering, and sections." },
  chanceLabel: { id: "dplIns.chance.label", defaultMessage: "Chance" },
  chanceHint: { id: "dplIns.chance.hint", defaultMessage: "Keep a line only some of the time." },
  chooseLabel: { id: "dplIns.choose.label", defaultMessage: "Choose" },
  chooseHint: { id: "dplIns.choose.hint", defaultMessage: "Pick from a set of options." },
  repeatLabel: { id: "dplIns.repeat.label", defaultMessage: "Repeat" },
  repeatHint: { id: "dplIns.repeat.hint", defaultMessage: "Render the same body several times." },
  flowLabel: { id: "dplIns.flow.label", defaultMessage: "Flow & calls" },
  flowHint: {
    id: "dplIns.flow.hint",
    defaultMessage: "Jump between sections and pull in other blocks.",
  },
  emphasisLabel: { id: "dplIns.emphasis.label", defaultMessage: "Emphasis" },
  emphasisHint: {
    id: "dplIns.emphasis.hint",
    defaultMessage: "Nudge how strongly a phrase is weighted (the engine translates it for each AI).",
  },
  codeLabel: { id: "dplIns.code.label", defaultMessage: "Code" },
  codeHint: { id: "dplIns.code.hint", defaultMessage: "Inline JS, comments, and engine controls." },

  // Structure items
  bulletLabel: { id: "dplIns.bullet.label", defaultMessage: "Bullet line" },
  bulletDesc: {
    id: "dplIns.bullet.desc",
    defaultMessage: "A bullet; a simple bullet defaults to a 50% chance.",
  },
  weightLabel: { id: "dplIns.weight.label", defaultMessage: "Priority weight" },
  weightDesc: {
    id: "dplIns.weight.desc",
    defaultMessage: "Pin a line's order — a lower number sorts earlier, wherever you type it.",
  },
  headingLabel: { id: "dplIns.heading.label", defaultMessage: "Section heading" },
  headingDesc: {
    id: "dplIns.heading.desc",
    defaultMessage: "A named section you can jump to with “go to”.",
  },

  // Chance items
  maybeLabel: { id: "dplIns.maybe.label", defaultMessage: "Maybe" },
  maybeDesc: { id: "dplIns.maybe.desc", defaultMessage: "50% chance this line is kept." },
  pctChanceLabel: { id: "dplIns.pctChance.label", defaultMessage: "N% chance" },
  pctChanceDesc: {
    id: "dplIns.pctChance.desc",
    defaultMessage: "Custom probability the line is kept.",
  },
  otherwiseLabel: { id: "dplIns.otherwise.label", defaultMessage: "Otherwise" },
  otherwiseDesc: {
    id: "dplIns.otherwise.desc",
    defaultMessage: "Runs only when the chance just above it failed.",
  },

  // Choose items
  oneOfLabel: { id: "dplIns.oneOf.label", defaultMessage: "One of" },
  oneOfDesc: { id: "dplIns.oneOf.desc", defaultMessage: "Pick exactly one of the options." },
  nOfLabel: { id: "dplIns.nOf.label", defaultMessage: "N of" },
  nOfDesc: { id: "dplIns.nOf.desc", defaultMessage: "Pick exactly N of the options." },
  rangeOfLabel: { id: "dplIns.rangeOf.label", defaultMessage: "N to M of" },
  rangeOfDesc: { id: "dplIns.rangeOf.desc", defaultMessage: "Pick a random count between N and M." },
  oneOfNothingLabel: { id: "dplIns.oneOfNothing.label", defaultMessage: "One of, or nothing" },
  oneOfNothingDesc: {
    id: "dplIns.oneOfNothing.desc",
    defaultMessage: "Pick one — but sometimes nothing at all.",
  },

  // Repeat items
  repeatNLabel: { id: "dplIns.repeatN.label", defaultMessage: "Repeat N times" },
  repeatNDesc: { id: "dplIns.repeatN.desc", defaultMessage: "Render the body exactly N times." },
  repeatRangeLabel: { id: "dplIns.repeatRange.label", defaultMessage: "Repeat N to M times" },
  repeatRangeDesc: {
    id: "dplIns.repeatRange.desc",
    defaultMessage: "Render the body a random N–M times.",
  },

  // Flow items
  gotoLabel: { id: "dplIns.goto.label", defaultMessage: "Go to section" },
  gotoDesc: { id: "dplIns.goto.desc", defaultMessage: "Jump into another named section." },
  gobackLabel: { id: "dplIns.goback.label", defaultMessage: "Go back" },
  gobackDesc: {
    id: "dplIns.goback.desc",
    defaultMessage: "Stop / return from the current section.",
  },
  insertLabel: { id: "dplIns.insert.label", defaultMessage: "Insert by name" },
  insertDesc: {
    id: "dplIns.insert.desc",
    defaultMessage: "Insert another generator or list by name.",
  },
  callLabel: { id: "dplIns.call.label", defaultMessage: "Call (+name)" },
  callDesc: {
    id: "dplIns.call.desc",
    // {token} carries the literal "{#name}" so ICU doesn't parse the braces.
    defaultMessage: "Call a generator or section by name (→ {token}).",
  },
  insertJsLabel: { id: "dplIns.insertJs.label", defaultMessage: "Insert JS block" },
  insertJsDesc: {
    id: "dplIns.insertJs.desc",
    defaultMessage: "Insert the output of a named JS block.",
  },

  // Emphasis items
  emphLabel: { id: "dplIns.emph.label", defaultMessage: "Emphasize" },
  emphDesc: {
    id: "dplIns.emph.desc",
    defaultMessage: "More attention on the wrapped text. Each extra ( adds a level (+10), capped at 5.",
  },
  emphStrongLabel: { id: "dplIns.emphStrong.label", defaultMessage: "Emphasize strongly" },
  emphStrongDesc: {
    id: "dplIns.emphStrong.desc",
    defaultMessage:
      "Stack ( for more — (((text))) is the strongest. Renders as a weight (SD/MJ), braces (NovelAI), or an intensity word (plain).",
  },
  deEmphLabel: { id: "dplIns.deEmph.label", defaultMessage: "De-emphasize" },
  deEmphDesc: {
    id: "dplIns.deEmph.desc",
    defaultMessage:
      "Less attention on the wrapped text. Stack [ for less; floors at the lowest level (never zero).",
  },
  emphWeightLabel: { id: "dplIns.emphWeight.label", defaultMessage: "Weighted phrase" },
  emphWeightDesc: {
    id: "dplIns.emphWeight.desc",
    defaultMessage: "Set an explicit numeric weight (passed through as-is).",
  },

  // Code items
  commentLabel: { id: "dplIns.comment.label", defaultMessage: "Comment" },
  commentDesc: {
    id: "dplIns.comment.desc",
    defaultMessage: "A note ignored by the engine (to end of line).",
  },
  saltLabel: { id: "dplIns.salt.label", defaultMessage: "Seed salt" },
  saltDesc: { id: "dplIns.salt.desc", defaultMessage: "Inject a random number to nudge the result." },
});
