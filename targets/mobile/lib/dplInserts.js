/**
 * The DPL insert menu for the phone — the engine's grammar with English labels on it.
 *
 * This file used to BE the catalog: 262 hand-ported lines mirroring the web's, kept honest by a drift
 * check (`checkDplInserts` in `scripts/mobile-parity-check.mjs`) that existed only because the copy
 * did. The grammar is the engine's — it describes what `engine/core/dpl/dpl.js` compiles — so it now
 * lives in `engine/dplInsertCatalog.js` and both targets read it. The check is deleted with the copy:
 * **you cannot drift from yourself.** (Last item of the de-duplication campaign — see
 * `notes/plans/de-duplication.md`.)
 *
 * What stays here is the LABEL LAYER, and only that. The web localizes its labels through react-intl;
 * the phone ships English (no i18n runtime on mobile yet), so the two label layers use different
 * machinery and are deliberately NOT shared — pulling react-intl into React Native to unify a string
 * table would be importing the web's constraints along with its words. The labels below are the
 * English `defaultMessage`s of `targets/web/frontend/lib/dpl/dplInsertsMessages.js`.
 *
 * Keys are derived from the catalog ids (`camelId`), so a construct added to the engine grammar with
 * no label here fails `tests/unit/dplInsertCatalog.test.js` instead of rendering "undefined" on a phone.
 */
import {
  buildInsertMenu,
  camelId,
  materializeTemplate,
} from "engine/dplInsertCatalog.js";

/** Category labels + hints, keyed by `camelId(category.key)`. */
export const CATEGORY_LABELS = {
  structure: { label: "Structure", hint: "Bullets, ordering, and sections." },
  chance: { label: "Chance", hint: "Keep a line only some of the time." },
  choose: { label: "Choose", hint: "Pick from a set of options." },
  repeat: { label: "Repeat", hint: "Render the same body several times." },
  flow: { label: "Flow & calls", hint: "Jump between sections and pull in other blocks." },
  emphasis: {
    label: "Emphasis",
    hint: "Nudge how strongly a phrase is weighted (the engine translates it for each AI).",
  },
  code: { label: "Code", hint: "Inline JS, comments, and engine controls." },
};

/** Item labels + descriptions, keyed by `camelId(item.id)`. */
export const ITEM_LABELS = {
  bullet: {
    label: "Bullet line",
    desc: "A bullet; a simple bullet defaults to a 50% chance.",
  },
  weight: {
    label: "Priority weight",
    desc: "Pin a line's order — a lower number sorts earlier, wherever you type it.",
  },
  heading: {
    label: "Section heading",
    desc: "A named section you can jump to with “go to”.",
  },
  maybe: { label: "Maybe", desc: "50% chance this line is kept." },
  pctChance: { label: "N% chance", desc: "Custom probability the line is kept." },
  otherwise: {
    label: "Otherwise",
    desc: "Runs only when the chance just above it failed.",
  },
  oneOf: { label: "One of", desc: "Pick exactly one of the options." },
  nOf: { label: "N of", desc: "Pick exactly N of the options." },
  rangeOf: { label: "N to M of", desc: "Pick a random count between N and M." },
  oneOfNothing: {
    label: "One of, or nothing",
    desc: "Pick one — but sometimes nothing at all.",
  },
  repeatN: { label: "Repeat N times", desc: "Render the body exactly N times." },
  repeatRange: { label: "Repeat N to M times", desc: "Render the body a random N–M times." },
  goto: { label: "Go to section", desc: "Jump into another named section." },
  goback: { label: "Go back", desc: "Stop / return from the current section." },
  insert: { label: "Insert by name", desc: "Insert another generator or list by name." },
  call: { label: "Call (+name)", desc: "Call a generator or section by name (→ {#name})." },
  insertJs: { label: "Insert JS block", desc: "Insert the output of a named JS block." },
  emph: {
    label: "Emphasize",
    desc: "More attention on the wrapped text. Each extra ( adds a level (+10), capped at 5.",
  },
  emphStrong: {
    label: "Emphasize strongly",
    desc: "Stack ( for more — (((text))) is the strongest. Renders as a weight (SD/MJ), braces (NovelAI), or an intensity word (plain).",
  },
  deEmph: {
    label: "De-emphasize",
    desc: "Less attention on the wrapped text. Stack [ for less; floors at the lowest level (never zero).",
  },
  emphWeight: {
    label: "Weighted phrase",
    desc: "Set an explicit numeric weight (passed through as-is).",
  },
  comment: { label: "Comment", desc: "A note ignored by the engine (to end of line)." },
  salt: { label: "Seed salt", desc: "Inject a random number to nudge the result." },
};

/**
 * The catalog the mobile Insert menu renders: the engine's grammar + the English labels above.
 * Same shape the screen has always consumed (`{key, label, hint, items:[{id, label, desc, syntax,
 * template, line?, wrap?, example?}]}`), so nothing downstream changed.
 */
export const DPL_INSERTS = buildInsertMenu({
  category: (c) => CATEGORY_LABELS[camelId(c.key)],
  item: (it) => ITEM_LABELS[camelId(it.id)],
});

/**
 * Turn a snippet template into the plain text a `TextInput` can take (no CodeMirror on a phone).
 * Re-exported from the engine so the mobile call sites keep working unchanged.
 */
export const materialize = materializeTemplate;
