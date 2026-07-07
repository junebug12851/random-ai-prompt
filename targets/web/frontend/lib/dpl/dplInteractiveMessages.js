/**
 * Localized strings for the DPL editor's interactive layer — the hover intensity/focus dials
 * ({@link module:gui/lib/dpl/dplDials}) and the `+` line-action menu
 * ({@link module:gui/lib/dpl/dplLineActions}). Those extensions are plain CodeMirror (outside the
 * React tree), so {@link buildInteractiveLabels} formats every string here through the caller's
 * `intl` up front and hands the extensions a flat, ready-to-render `labels` object.
 * @module gui/lib/dpl/dplInteractiveMessages
 */
import { defineMessages } from "react-intl";

export const m = defineMessages({
  // Dials
  dialIntensity: { id: "dplInteractive.dialIntensity", defaultMessage: "intensity" },
  dialFocus: { id: "dplInteractive.dialFocus", defaultMessage: "focus" },

  // Line-action menu — top level
  frontMatter: { id: "dplInteractive.frontMatter", defaultMessage: "Front matter" },
  insertFrontMatter: { id: "dplInteractive.insertFrontMatter", defaultMessage: "Insert front matter" },
  promote: { id: "dplInteractive.promote", defaultMessage: "Promote to…" },
  replaceWith: { id: "dplInteractive.replaceWith", defaultMessage: "Replace line with…" },
  insertAbove: { id: "dplInteractive.insertAbove", defaultMessage: "Insert blank line above" },
  insertBelow: { id: "dplInteractive.insertBelow", defaultMessage: "Insert blank line below" },
  newSection: { id: "dplInteractive.newSection", defaultMessage: "New section…" },

  // Promotions (prefix the existing line content)
  promBullet: { id: "dplInteractive.promBullet", defaultMessage: "Bullet  - …" },
  promMaybe: { id: "dplInteractive.promMaybe", defaultMessage: "Maybe (50% chance)" },
  promPct: { id: "dplInteractive.promPct", defaultMessage: "NN% chance" },
  promOtherwise: { id: "dplInteractive.promOtherwise", defaultMessage: "Otherwise (fallback)" },
  promWeight: { id: "dplInteractive.promWeight", defaultMessage: "Weighted [100]" },
  promCond: { id: "dplInteractive.promCond", defaultMessage: "Dial condition [i<50%]" },

  // Replace-with templates
  tplText: { id: "dplInteractive.tplText", defaultMessage: "Plain text" },
  tplBullet: { id: "dplInteractive.tplBullet", defaultMessage: "Bullet  - …" },
  tplMaybe: { id: "dplInteractive.tplMaybe", defaultMessage: "Maybe (50% chance)" },
  tplPct: { id: "dplInteractive.tplPct", defaultMessage: "NN% chance" },
  tplOtherwise: { id: "dplInteractive.tplOtherwise", defaultMessage: "Otherwise (fallback)" },
  tplWeight: { id: "dplInteractive.tplWeight", defaultMessage: "Weighted [100]" },
  tplCond: { id: "dplInteractive.tplCond", defaultMessage: "Dial condition [i<50%]" },
  tplOneOf: { id: "dplInteractive.tplOneOf", defaultMessage: "One of (pick 1)" },
  tplNOf: { id: "dplInteractive.tplNOf", defaultMessage: "N of (pick N)" },
  tplRangeOf: { id: "dplInteractive.tplRangeOf", defaultMessage: "A to B of (pick a range)" },
  tplOneOfNothing: { id: "dplInteractive.tplOneOfNothing", defaultMessage: "One of, or nothing" },
  tplRepeat: { id: "dplInteractive.tplRepeat", defaultMessage: "Repeat N times" },
  tplRepeatRange: { id: "dplInteractive.tplRepeatRange", defaultMessage: "Repeat A to B times" },
  tplGoto: { id: "dplInteractive.tplGoto", defaultMessage: "Go to section" },
  tplGoback: { id: "dplInteractive.tplGoback", defaultMessage: "Go back" },
  tplInsert: { id: "dplInteractive.tplInsert", defaultMessage: "Insert block" },
  tplCall: { id: "dplInteractive.tplCall", defaultMessage: "Call +block" },
  tplInsertJs: { id: "dplInteractive.tplInsertJs", defaultMessage: "Insert JS file" },
  tplComment: { id: "dplInteractive.tplComment", defaultMessage: "Comment  ; …" },

  // Front-matter keys
  fmDesc: { id: "dplInteractive.fmDesc", defaultMessage: "description:" },
  fmSuggestions: { id: "dplInteractive.fmSuggestions", defaultMessage: "suggestions: off" },
  fmStacking: { id: "dplInteractive.fmStacking", defaultMessage: "stacking: true" },
  fmScript: { id: "dplInteractive.fmScript", defaultMessage: "script:" },

  // Sections
  secStart: { id: "dplInteractive.secStart", defaultMessage: "Start (entry)" },
  secAutoBegin: { id: "dplInteractive.secAutoBegin", defaultMessage: "Auto Begin" },
  secAutoEnd: { id: "dplInteractive.secAutoEnd", defaultMessage: "Auto End" },
  secCustom: { id: "dplInteractive.secCustom", defaultMessage: "Custom section…" },
});

/**
 * Format every interactive-layer string through `intl` into the flat `labels` object the dial + line-
 * action extensions consume.
 * @param {import("react-intl").IntlShape} intl
 * @returns {object} labels
 */
export function buildInteractiveLabels(intl) {
  const t = (d) => intl.formatMessage(d);
  return {
    // dials
    intensity: t(m.dialIntensity),
    focus: t(m.dialFocus),
    // menu — top level
    frontMatter: t(m.frontMatter),
    insertFrontMatter: t(m.insertFrontMatter),
    promote: t(m.promote),
    replaceWith: t(m.replaceWith),
    insertAbove: t(m.insertAbove),
    insertBelow: t(m.insertBelow),
    newSection: t(m.newSection),
    // promotions
    promBullet: t(m.promBullet),
    promMaybe: t(m.promMaybe),
    promPct: t(m.promPct),
    promOtherwise: t(m.promOtherwise),
    promWeight: t(m.promWeight),
    promCond: t(m.promCond),
    // templates
    tplText: t(m.tplText),
    tplBullet: t(m.tplBullet),
    tplMaybe: t(m.tplMaybe),
    tplPct: t(m.tplPct),
    tplOtherwise: t(m.tplOtherwise),
    tplWeight: t(m.tplWeight),
    tplCond: t(m.tplCond),
    tplOneOf: t(m.tplOneOf),
    tplNOf: t(m.tplNOf),
    tplRangeOf: t(m.tplRangeOf),
    tplOneOfNothing: t(m.tplOneOfNothing),
    tplRepeat: t(m.tplRepeat),
    tplRepeatRange: t(m.tplRepeatRange),
    tplGoto: t(m.tplGoto),
    tplGoback: t(m.tplGoback),
    tplInsert: t(m.tplInsert),
    tplCall: t(m.tplCall),
    tplInsertJs: t(m.tplInsertJs),
    tplComment: t(m.tplComment),
    // front-matter keys
    fmDesc: t(m.fmDesc),
    fmSuggestions: t(m.fmSuggestions),
    fmStacking: t(m.fmStacking),
    fmScript: t(m.fmScript),
    // sections
    secStart: t(m.secStart),
    secAutoBegin: t(m.secAutoBegin),
    secAutoEnd: t(m.secAutoEnd),
    secCustom: t(m.secCustom),
  };
}
