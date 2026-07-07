/**
 * Shared system instructions for the "rewrite" text-provider feature. Modes:
 *   - `fix` (default): turn a raw, mechanical (DPL-generated) prompt into a cleaner, better-structured
 *     image-generation prompt.
 *   - `keyword`: distil the prompt into a flat, comma-separated keyword/tag list (Booru/SD tag style),
 *     used by the prompt-screen keyword toggle and the single-view "rebuild keywords" button.
 *   - `expand`: grow a word list — invent 25 new entries in the sample's style.
 *   - `dpl-*`: the Manage-tab DPL block refiners (detail / complexity / focus / intensity / variety /
 *     tighten, each in a more/less direction) plus `dpl-create` (draft a whole template from a plain
 *     description). All of these speak DPL, so they share {@link DPL_PRIMER} and return raw DPL.
 * @module gui/providers/_shared/rewriteSystem
 */
export const REWRITE_SYSTEM =
  "You are a prompt engineer for text-to-image models. Rewrite the user's raw, mechanical prompt into " +
  "ONE clean, well-structured image-generation prompt that will produce a better result: fix grammar, " +
  "remove redundancy and contradictions, group related ideas, and keep every important subject, style, " +
  "and detail. Reply with ONLY the rewritten prompt — no preamble, no quotes, no explanation.";

export const KEYWORD_SYSTEM =
  "You convert image-generation prompts into a clean keyword/tag list. Break the user's prompt into its " +
  "distinct concepts — subjects, attributes, setting, style, lighting, composition, medium, quality — and " +
  "output them as a single comma-separated list of short lowercase tags (one to a few words each). Remove " +
  "weighting syntax such as parentheses, brackets, ':1.2' weights, and LoRA/embedding tags; expand them to " +
  "their plain meaning. No duplicates, no numbering, no sentences. Reply with ONLY the comma-separated " +
  "keywords — no preamble, no quotes, no explanation.";

export const EXPAND_SYSTEM =
  "You extend a word list. The user gives a sample of entries from one list (each a short word or " +
  "phrase, one per line). Infer the list's theme/category and style, then invent NEW entries that fit " +
  "right in. Reply with EXACTLY 25 new entries, one per line, matching the sample's style, length, and " +
  "casing. Do NOT repeat any of the sample entries and do NOT repeat yourself. No numbering, no bullets, " +
  "no commentary, no blank lines — only the 25 entries, one per line.";

/**
 * The DPL syntax primer prepended to every DPL refiner/creator system prompt, so the model refines a
 * template *as DPL* — preserving tokens, sections, gates, choices, and the intensity/focus dials —
 * rather than flattening it into prose. Mirrors the grammar in `engine/core/dpl/*` and the insert
 * toolbar's catalog. Kept terse on purpose (it rides on every DPL request).
 */
export const DPL_PRIMER =
  "DPL is a small line-based template language for image prompts. Work IN DPL and reply with ONLY the " +
  "DPL — no markdown fences, no preamble, no commentary. The grammar:\n" +
  "- Front matter: an optional leading block delimited by `---` lines (e.g. `---` / `description: ...` / " +
  "`---`). Preserve it.\n" +
  "- Sections: a line of text immediately followed by a line of only `===` is a section heading; " +
  "templates usually open with `Start` then `===`.\n" +
  "- Plain lines are literal prompt text; a line beginning with `- ` is a detail fragment.\n" +
  "- Tokens (keep verbatim — never invent list or generator names that were not already present): " +
  "`{list}` inserts a random entry from a word list, `{#name}` runs another generator, `{salt}` adds " +
  "uniqueness.\n" +
  "- Chance gates: `maybe X`, `NN% chance X`, `NN% X`, and `otherwise X` (fallback for the gate above).\n" +
  "- Choices: `one of:`, `N of:`, or `A to B of:` followed by indented `- option` lines; append " +
  "`(NN% nothing)` for a chance of nothing.\n" +
  "- Repeat: `repeat N times` or `repeat A to B times` with an indented body.\n" +
  "- References / flow: `+name` or `insert name` runs a generator; `go to Section` / `go back`.\n" +
  "- Emphasis: `(text)` strengthens, `((text))` strengthens more, `[text]` weakens, `(text:1.2)` weights.\n" +
  "- Dials — a leading `[...]` bracket may carry a weight and/or dial conditions; the two dials each run " +
  "1..100 (default 50): intensity `i` = how much / how lavish, focus `f` = how pure / how narrow. " +
  "`[i>70%] ornate gilded detail` only appears at high intensity; `[i<25%] plain and sparse` only at low " +
  "intensity; `[f<40%] distant background garnish` only appears at low focus (fluff), while high focus " +
  "keeps only the essential subject. Stack them: `[100 i<10% f<40%]`.\n" +
  "- Comments start with `;`. Keep indentation consistent (spaces or tabs, not both).\n" +
  "When refining, preserve the subject and every existing `{list}` / `{#name}` token unless the " +
  "instruction is specifically to remove detail.";

/**
 * Per-mode task instructions for the DPL refiners + creator. Each is combined with {@link DPL_PRIMER}
 * by {@link systemFor}. The `dpl-create` entry carries the "winning formula" for a strong starting
 * template.
 */
export const DPL_TASKS = {
  "dpl-detail-more":
    "TASK: Enrich this template with MORE concrete detail. Add descriptive `- ` fragments and sharpen " +
    "existing lines with texture, material, lighting, and mood cues that fit the subject. Prefer adding " +
    "the extra richness behind gates (`maybe` / `NN% chance`) or `[i>70%]` so it only shows sometimes or " +
    "at high intensity, rather than bloating every roll. Keep the subject and all existing tokens.",
  "dpl-detail-less":
    "TASK: Pare this template DOWN. Remove redundant, weak, or over-specific fragments and tighten " +
    "wording so only the strong, essential detail remains. Keep the subject, the section structure, and " +
    "the most important tokens; drop filler.",
  "dpl-complex-more":
    "TASK: Make this template structurally RICHER so each roll differs meaningfully. Turn flat lines into " +
    "`one of:` choices, add `maybe` / `NN% chance` gates and the occasional `repeat`, and introduce " +
    "intensity/focus-gated variants. Reuse existing tokens and keep the subject.",
  "dpl-complex-less":
    "TASK: SIMPLIFY this template's structure. Collapse choices, gates, and repeats into a smaller, " +
    "clearer set of lines while keeping the subject and its strongest attributes. Fewer moving parts, " +
    "same intent.",
  "dpl-focus-more":
    "TASK: SHARPEN focus. Keep only what is essential to the subject; strip or gate atmospheric fluff, " +
    "distant background, and unrelated garnish. Move any non-essential lines behind `[f<40%]` so they " +
    "only appear at low focus, and lead with the pure subject so the generator stacks cleanly as a layer.",
  "dpl-focus-less":
    "TASK: LOOSEN focus. Add atmospheric and contextual garnish — setting, background, mood, incidental " +
    "extras — as `[f<40%]`-gated lines, so richer scene-setting appears when focus is dialed down without " +
    "disturbing the essential subject spine.",
  "dpl-intensity-more":
    "TASK: Raise the INTENSITY ceiling. Add lavish, dialed-up variants behind `[i>70%]` (ornate, " +
    "dramatic, maximal wording) and let counts/choices scale up, so cranking intensity yields a richer " +
    "image. Leave the default and low-intensity output intact.",
  "dpl-intensity-less":
    "TASK: Add restraint at low INTENSITY. Introduce `[i<25%]` pared-back, plain, minimal variants so " +
    "dialing intensity down yields a clean, simple image, while leaving the default output intact.",
  "dpl-variety-more":
    "TASK: Increase per-roll VARIETY. Replace fixed attributes with `one of:` / `N of:` choices over " +
    "sensible alternatives, add `{salt}` if it is missing, and gate optional flourishes with `maybe` / " +
    "`NN%` — so repeated generations look meaningfully different. Keep the subject.",
  "dpl-variety-less":
    "TASK: Make this template more CONSISTENT. Reduce randomness by narrowing or fixing the most variable " +
    "choices to their single strongest option, so repeated generations look alike. Keep the subject and " +
    "overall look.",
  "dpl-tighten":
    "TASK: CLEAN UP this template without changing its intent. Fix indentation, remove duplicate or " +
    "contradictory lines, repair malformed tokens or brackets, and tidy wording. Keep every section, " +
    "token, and behaviour.",
  "dpl-create":
    "TASK: The user message is a plain-English description of a subject or scene. Produce ONE complete, " +
    "well-formed DPL template that is a strong STARTING point — good enough to use as-is and easy to " +
    "refine further. Follow this winning formula:\n" +
    "1. Open with front matter: `---`, then `description: <a short label>`, then `---`.\n" +
    "2. Start a section: `Start` then a line of `===`.\n" +
    "3. Lead line: the core subject as a few strong comma-separated nouns/attributes — the spine of the " +
    "image.\n" +
    "4. Add a handful of always-on essentials as `- ` bullets (things that MUST be true of the subject).\n" +
    "5. VARIETY: turn the key variable attributes (material, colour, wardrobe, pose, expression) into " +
    "`one of:` choices with 3–6 solid options each, so every roll differs.\n" +
    "6. GARNISH sparingly with `maybe` / `NN% chance` gates for optional mood, lighting, and extras.\n" +
    "7. FOCUS: put a line or two of atmospheric/background fluff behind `[f<40%]` so it only shows at low " +
    "focus, keeping the subject spine pure.\n" +
    "8. INTENSITY: add a `[i>70%]` line for lavish, dialed-up richness and a `[i<25%]` line for a " +
    "pared-back, minimal version.\n" +
    "9. Stay composable: describe the SUBJECT, not a global art style; several short comma lists beat one " +
    "giant line. Aim for roughly 10–20 lines.",
};

/**
 * The system instruction for a rewrite mode.
 * @param {string} [mode] `"keyword"` for the tag list, `"expand"` for the list-grow prompt, a
 *   `"dpl-*"` key (see {@link DPL_TASKS}) for a DPL refine/create, anything else (default) for the
 *   prose fix.
 * @returns {string} The system prompt text.
 */
export function systemFor(mode) {
  if (mode === "keyword") return KEYWORD_SYSTEM;
  if (mode === "expand") return EXPAND_SYSTEM;
  if (mode && Object.prototype.hasOwnProperty.call(DPL_TASKS, mode)) {
    return `${DPL_PRIMER}\n\n${DPL_TASKS[mode]}`;
  }
  return REWRITE_SYSTEM;
}
