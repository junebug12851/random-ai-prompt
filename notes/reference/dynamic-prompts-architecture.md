# Dynamic prompts — architecture

How `data/dynamic-prompts/` is structured after the modernization that brought it to parity with
the keyword-list ([`list-architecture.md`](list-architecture.md)) and expansion
([`expansions-architecture.md`](expansions-architecture.md)) systems — **2.3.0** (the `v2/` reorg,
suffix resolution, sidecars) and **2.4.0** (the `{#name}` sigil, name-token gating, and the uniform
SPA). Only the parts that *make sense* for code generators were ported;
what was intentionally left out is noted at the end. For the catalog / authoring idiom see
[`dynamic-prompts.md`](dynamic-prompts.md); for the engine see
[../systems/core-engine.md](../systems/core-engine.md).

## What a dynamic prompt is

A **dynamic prompt** is a `data/dynamic-prompts/**/<name>.js` generator script referenced in a
prompt as `{#name}`. It `export default`s a function `(settings, imageSettings, upscaleSettings) =>
string` plus optional `export const full` / `export const suggestion_exclude` flags. The
dynamic-prompt stage runs it and splices the result in, recursively (up to 10 passes), so a
generator can emit `{#other}`, `{list}`, and `<expansion>` tokens that then expand.

## The `{#name}` sigil (2.4.0)

Dynamic prompts are written **brace-delimited** — `{#name}` — uniform with `{list}` and
`<expansion>`, and able to carry `/` paths (`{#scene/beach}`). The old bare `#name` (no braces) is no
longer recognized: the braces stop a stray `#` in plain prompt text from being eaten, and make the three
sigils visually consistent. The stage regex is `/\{#([\w/-]+)\}/g`; the list stage skips any
`{#…}` (a `p1.startsWith("#")` guard) so the two `{…}` sigils never collide. The migration of the
204 internal references across 54 v2 generators is scripted in
[`scripts/migrate-dynprompt-sigil.mjs`](../../scripts/migrate-dynprompt-sigil.mjs) (comment-safe,
idempotent); v1 generators have no internal `#` refs, so they were untouched.

The engine is loader-injected: the active code is the core stage
[`src/core/stages/dynamicPrompt.js`](../../src/core/stages/dynamicPrompt.js), which calls
`loader.loadDynamicPrompt(key)` / `loader.dynamicPromptNames()`. The classic pipeline
`src/prompt-modules/dynamic-prompt.js` (and `src/server.js`) are **read-only legacy reference**
being replaced — nothing active imports the legacy stage, and it is not kept in sync.

## The v2/ reorg (ported from lists/expansions)

The generators are sorted into category folders under a new `v2/` root —
`v2/{scene,subject,fragment,style,prompt,user}/` — purely for organization, with `v1/` left
frozen. The move + import rewrites are scripted in
[`scripts/reorg-dynprompts-v2.mjs`](../../scripts/reorg-dynprompts-v2.mjs), which resolves each
import's old→new absolute path so both `src/` helper imports (now `../../../../src/…` from a v2
file) and cross-category sibling imports (`../fragment/nature.js`) are rewritten correctly.

## Path-suffix resolution (ported from lists/expansions)

`{#name}` resolves by **path suffix** via the shared `resolveName()` from `listManifest.js` — exact
path wins, else the shallowest name ending `/<ref>`, ties broken by `compareNames()`. Basenames
were kept unique during the move, so every pre-existing `{#beach}` / `{#fx}` / `{#artists}` reference
still resolves with no edits, and categories never have to be typed. The stage splits the catalog
once per run into `v1/` (reached only via `{#name-v1}`) and the rest (v2, reached bare), resolving
each against its own subset so `{#comic}` finds `v2/style/comic`, never `v1/comic`. `{#user-name}` is
a back-compat alias that strips `user-` and resolves into `v2/user/`. Gating is automatic
by name token: `isGatedDynPrompt(name)` in
[`gatedLists.js`](../../src/gatedLists.js) is true when the name carries an `nsfw` token, so such a
generator resolves to "" (and is hidden in the picker) while `includeAdult` is off — the same rule
lists/expansions use, no hardcoded list.

## Pick-one groups + the `{#any}` wildcard (2.5.0)

Like lists, a category folder with 2+ generators is an IMPLIED group, but the "pick one" picks one
GENERATOR (not one word): `{#scene}` runs one random scene generator. `.group` files and
`_enable/_disable-group-list` markers work too. Group dirs are added to the stage's resolution pool so a
bare `{#scene}` suffix-matches `v2/scene`. The reserved `{#any}` wildcard
([`dynPromptManifest.js`](../../src/dynPromptManifest.js)) picks one generator from the WHOLE v2 catalog,
with the lists' `{keyword}`-style variants: `{#any}` = SFW (off) / +NSFW (on), `{#any-sfw}` = SFW always,
`{#any-nsfw}` = nothing (off) / +NSFW (on). All picks are gate-aware (`hasNsfwToken`). Crucially these
resolve to ONE concrete generator that is then run — never a union; the variant suffix is parsed only for
`{#any}`, so a real nsfw-token generator name still resolves directly. Expansions get the same treatment:
`<folder>` (or a `.group`) splices ONE random expansion from the folder (see
[`expansions-architecture.md`](expansions-architecture.md)).

## Description sidecars + tooltips (ported from lists/expansions)

Each generator may carry an optional `<name>.json` sidecar (`{ "description": "…" }`) and each
category folder a `<folder>.json`, read via `loader.readDynPromptMeta(name)`. The SPA token cloud
([`gui/src/lib/promptEngine.js`](../../gui/src/lib/promptEngine.js)) shows each entry's
description as its button tooltip, sorts entries in natural order (`compareNames`), and displays
the shortest unambiguous `{#token}` via `computeButtonNames()`. The sidecars are regenerated by
[`scripts/dynprompt-meta/write-dynprompt-meta.mjs`](../../scripts/dynprompt-meta/write-dynprompt-meta.mjs),
the analog of `scripts/expansion-meta/write-expansion-meta.mjs` (v1 generators are auto-described
as frozen mirrors).

## `_`-internal + `_force-prefix` (ported)

`_`-prefixed files are internal/config, never generators — both loaders skip them
(`namesUnder` in [`nodeLoader.js`](../../src/core/nodeLoader.js); a basename check in
[`browserLoader.js`](../../src/core/browserLoader.js)). A folder with an empty `_force-prefix`
marker shows its path in the `{#token}`; the loaders expose `dynPromptForcedPrefixDirs()` and the
classifier/SPA feed it to `computeButtonNames`. No v2 folder is force-prefixed today (basenames
are unique, so tokens are bare), but the machinery is wired for parity.

## The UI: Full / Partial tabs + v1/v2 superset links (2.5.0)

The SPA ([`gui/src/lib/promptEngine.js`](../../gui/src/lib/promptEngine.js) `getBlocks` +
[`Home.jsx`](../../gui/src/components/Home.jsx)) groups dynamic prompts under a single **"Prompts"**
navbar heading that carries one **v1/v2 superset switch** (`dynVer` state; rendered `v1 v2`, v2 selected by
default) and two sub-tabs — **full** and **partial**. Within a sub-tab, generators sit under category-folder
pills; a folder pill is a **clickable group button** when the folder is an implied group (inserts
`{#folder}` = a random generator of that folder), and the `{#any}` family is a clickable "any" pill
(inserts `{#any}`) with `{#any-sfw}` / `{#any-nsfw}` entries, exactly like the lists' `keyword` pill. Each
dynamic block is `dynVersioned` and carries `variants.v2` / `variants.v1`, so the switch swaps the whole
catalog (v1 is all-full, so its partial sub-tab is empty). The classifier
[`src/promptFilesAndSuggestions.js`](../../src/promptFilesAndSuggestions.js) still classifies full/partial
(for the `{#random}` suggestion builder) and applies the same name-token gating to its pools.

## Verification seam (important)

`npm run smoke` exercises the **node** loader and expands a suggestion, but the classifier never
loads `v1/` modules — so a broken `v1/` import is invisible to smoke and only surfaces in
`npm --prefix gui run build` (the Vite glob bundles every generator). **Always run both.** This
is exactly how the 10 `v1/*` files importing the moved `entity.js` were caught during the 2.3.0
reorg (repointed to `../v2/subject/entity.js`).

## What was intentionally NOT ported

- **SFW/NSFW file splitting** — there is nothing to split (a generator is code, not lines); adult
  content is gated by the `nsfw` **name token** instead (see above), which is the portable half of
  the list NSFW model. The `{#any-sfw}` / `{#any-nsfw}` variants give the wildcard the same mode
  semantics without any file split.
- **List-style line unions for groups** — a `{#folder}` / `{#any}` group does NOT union members into a
  pool of lines; it picks ONE member generator and runs it (the "pick one generator, not one word"
  rule). See [`../decisions/rejected.md`](../decisions/rejected.md) for the back-and-forth that settled this.

See [`../../data/dynamic-prompts/README.md`](../../data/dynamic-prompts/README.md) for the
user-facing reference.
