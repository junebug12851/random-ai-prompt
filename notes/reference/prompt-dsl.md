# Reference — The Prompt DSL (the original micro-language)

The heart of the project, and where most of the original 2022–2023 design effort went, is a small
**prompt mini-language**: a prompt string is run through an ordered pipeline of string-rewriting stages,
each owning one sigil. This page documents the language and its randomization math in full — the
**micro** systems. For the macro flow see [`../systems/overview.md`](../systems/overview.md); for the
build history that produced it see [`../context/history.md`](../context/history.md).

The **active** implementation is the loader-injected `src/core/` engine (used by the SPA and the shared
pipeline); `src/prompt-modules/*` is the original Node CLI/server pipeline, now **frozen legacy reference**
(being replaced — don't maintain it). Same syntax, same math; see
[`../systems/core-engine.md`](../systems/core-engine.md).

## The pipeline order

`processBatch()` (`src/common.js`) runs the prompt through `settings.promptModules` in order. The
default (`src/settings.js`, mirrored by `core/engine.js`'s `DEFAULT_ORDER`):

```
prompt → expansion → dynamic-prompt → expansion → dynamic-prompt → prompt-salt → list → cleanup
```

Expansion and dynamic-prompt run **twice** so a dynamic prompt can emit `<expansion>` tokens (and vice
versa) and still get resolved. Lists resolve **last** (after salt) so list randomization sees the final
keyword skeleton. Each stage is a `(prompt, settings, imageSettings, upscaleSettings) => prompt`
function loaded by config-driven path from `src/prompt-modules/`.

## The four sigils

| Sigil | Stage | Source | Meaning |
|-------|-------|--------|---------|
| `<name>` | `expansion.js` | `data/expansions/**/name.txt` | Splice the file's text in verbatim. |
| `{#name}` | `dynamicPrompt.js` | `data/dynamic-prompts/v2/<cat>/name.js` | Call the generator's `default(settings, imageSettings, upscaleSettings)`; insert its returned string. (`{#any}` = a random generator; `{#name-v1}` = frozen v1.) |
| `{name}` | `list.js` | `data/lists/**/name.txt` | Pull one random line, then maybe randomize it (emphasis/editing/alternating). |
| `{salt}` / `[1234567890]` | `prompt-salt.js` | — | Inject a random or incrementing seed-salt number. |

### `<expansion>` — recursive text macros

`expansion.js` re-expands up to **10 passes** while any `<...>` remains, so expansions can nest. The one
subtlety is **LoRA safety**: AUTOMATIC1111's `<lora:name:weight>` shares the `<...>` syntax, so before
each pass the stage renames `<lora:` → `%%lora:` (a sentinel that the `<...>` regex won't match) and
restores it at the end. This lets LoRA tags live inside expansions, even deeply nested, without being
treated as expansion names.

### `{#name}` — JS generator scripts

The dynamic-prompt stage (`src/core/stages/dynamicPrompt.js`) re-expands up to **10 passes** while any
`{#…}` remains. The sigil is **brace-delimited** (`{#name}`, uniform with `{list}` / `<expansion>`, and
able to carry `/` paths like `{#scene/beach}`); a bare `#` in plain text is never touched. Each generator
is a tiny JS module that returns a prompt fragment, usually itself full of `{list}` / `{#other}` /
`<expansion>` tokens — e.g. `city.js` returns `"city, streetview, {city}, …, {#nature}, {#weather}, …"`.
`{#name}` resolves by **path suffix** against the v2 catalog (so the category folder is invisible);
folders are organization only — there is **no** `{#folder}` "random member" group (a generator is a
script with specific behavior, not a word pool). Conventions:

- **`export default function (...) { return "…" }`** — required.
- **`export const full = true`** — this prompt is a complete scene (vs. a partial fragment). Drives
  `promptSuggestion()` and the web UI sections (see the dynamic-prompt classification section below).
- **`export const suggestion_exclude = true`** — valid prompt, but keep it out of random suggestions.
- **Variant namespaces / aliases:** `{#name-v1}` loads from `data/dynamic-prompts/v1/` (an older, frozen
  generation — always treated as `full`, and forces `autoAddFx`/`autoAddArtists` off because v1 bakes
  those in). `{#user-foo}` is a back-compat alias for `data/dynamic-prompts/v2/user/foo.js` (community
  contributions, always `full`). `{#any}` is a reserved wildcard — run one random generator from the whole
  v2 catalog.
- **Gating:** a generator whose name carries an `nsfw` token is hidden (resolves to "") unless
  `includeAdult` is on — the same automatic name-token rule lists/expansions use (`isGatedDynPrompt`).
- **Auto-append:** after expansion, if `settings.autoAddFx` and the prompt didn't already pull `{#fx}`,
  one is appended; same for `{#artists}` via `autoAddArtists`. The "already included" check also trips on
  any literal `artist` substring or the per-batch `autoIncludedFx/Artists` flags (which exist to stop
  fx/artists being appended to *every* image in a batch — see the `delete` at the end of
  `processBatch`).
- **Danbooru substitution:** when an anime/danbooru keyword dict is active (`keywordsFilename` is
  `danbooru` or starts with `d-`), a trailing `, Person` is rewritten to `{d-person}` so the
  anime-tag character list is used instead of the generic person list.
- `imageSettings.origPostPrompt` is snapshotted here — the prompt after `#`/`<>` expansion but before
  lists resolve — which reroll/variation reuse.

### `{list}` — random line pull + randomization

`list.js` replaces each `{name}` with a random line from the list, via the in-memory store in
`src/helpers/listFiles.js`:

- **Aliases:** `{keyword}` resolves to `settings.keywordsFilename`, `{artist}` to
  `settings.artistFilename`. If that filename is `false`, a *random* list (or random artist list) is
  chosen instead. `--animeWords`/`--danbooruWords` flip the dict pair to `d-artist`/`d-keyword`.
- **Once-only depletion:** with `listEntriesUsedOnce`, a pulled line is spliced out so it can't repeat;
  when a list empties it is reloaded from disk. `reloadListsOnPromptChange` controls whether lists
  refresh between prompts (pointless, and auto-disabled, when duplicates are allowed).
- **Artist gating:** any list whose name is the artist file or contains `artist` is suppressed entirely
  when `includeArtist` is false, and is *never* run through emphasis (artists go in plain).
- **Emphasis dispatch:** for non-artist keywords, if `keywordEmphasis` is on and a `emphasisChance` roll
  passes, the keyword is run through **exactly one** of the randomization helpers — drawn without
  replacement from a per-engine shuffled set, refilled when exhausted:
  - StableDiffusion: `{ randomEmphasis, randomEditing, randomAlternating }`
  - NovelAI / Midjourney: `{ randomEmphasis, randomAlternating }` (no editing)

  Any `{...}` the helper leaves behind is then resolved against the store, and for NovelAI the SD
  `()`/`[]` emphasis is rewritten to `{}`-style.

### `{salt}` / `[number]` — the seed-salt

`prompt-salt.js` supports an explicit `{salt}` token or a literal `[1234567890]`, and (when
`settings.promptSalt`) auto-appends one if absent. A salt is either a fresh random
`[1000000000–9999999999]` or, when `promptSaltStart >= 0`, an **incrementing** counter (used so each
animation frame gets a deterministic, marching salt). The bare number is recorded in
`imageSettings.usedSalt`. This is the project's lightweight stand-in for subseed variation — nudging the
generation without changing the meaningful prompt.

## The randomization math

All three helpers live in `src/helpers/` and are reused unchanged by the browser engine.

**`randomEmphasis.js`** — gated by `keywordEmphasis`; a `deEmphasisChance` roll decides emphasis vs
de-emphasis. Level count starts at 1 and keeps incrementing while an `emphasisLevelChance` roll passes,
capped at `emphasisMaxLevels`. Per engine:

| Mode | Emphasis | De-emphasis |
|------|----------|-------------|
| StableDiffusion | `(((kw)))` (n parens) | `[[[kw]]]` (n brackets) |
| NovelAI | `(((kw)))` then `()`→`{}` later in `list.js` | `[[[kw]]]` |
| Midjourney | `kw::factor`, `factor = 1.05·n` | `kw::factor`, `factor = 1 / (1.05·n)` |

**`randomEditing.js`** (StableDiffusion only) — picks one of three prompt-editing forms, with
`n = random(keywordEditingMin, keywordEditingMax)`:

- edit-**in**: `[kw:n]` (kw appears after step n)
- **swap**: `[a:b:n]` (here `a==b==kw`, i.e. re-assert at step n)
- edit-**out**: `[kw::n]` (kw drops at step n)

**`randomAlternating.js`** (not Midjourney) — builds an alternation `kw|kw|…`, adding terms while an
`emphasisLevelChance` roll passes up to `keywordAlternatingMaxLevels`; StableDiffusion wraps the whole
thing in `[...]`.

**`chaos` (CLI `--chaos <pct>`, `applyArgs.js`)** scales the whole randomization envelope at once:
multiplies `emphasisChance`, `emphasisLevelChance`, `emphasisMaxLevels`, and
`keywordAlternatingMaxLevels`, and nudges `deEmphasisChance` (clamped to 0.25–0.5).

**`keywordRepeater.js`** (`keywordRepeater` / `artistRepeater`, named exports) — helpers a dynamic
prompt can call to emit a *variable count* of `{keyword}` / `{artist}` tokens:
`random(keywordCount, keywordMaxCount)` copies; artists additionally gated by `includeArtist` and a 50%
coin flip, `random(minArtist, maxArtist)` copies.

## `cleanup` — the final tidy

`cleanup.js` runs last: collapse runs of spaces, drop the space before `)`, delete empty `()`, split on
commas and rejoin dropping empty segments, and fix `AND,` → `AND` (a recurring offender from
AND-composition in suggestions). Output is the finished AUTOMATIC1111 prompt string.

## Dynamic-prompt classification and `{#random}`

`src/promptFilesAndSuggestions.js` is loader-injected (fs loader in Node, Vite-glob loader in the
browser). It reads every dynamic-prompt key and splits them into **full** vs **partial** (by the `full`
export), tracks `suggestion_exclude`, and special-cases the `v1/` and `user-submitted/` namespaces. From
those buckets it builds:

- **`promptSuggestion(full)`** — the engine behind `{#random}`. Optionally prepends a `prePrompt`
  (random `<expansion>`, `{#partial}`, `{list}` garnish at ~25% each) and composes 1–3 full prompts,
  sometimes AND-weighted (`… :0.75 AND … :1.1 AND … :0.50`) for blended scenes.
- The web UI's **file pickers** (`/api/files/dynamic-prompts|expansions|lists|presets`) and the
  building-blocks cloud.

## Where each piece lives

| Concern | File |
|---------|------|
| Pipeline driver (active) | `src/core/engine.js` (`createEngine`); `src/common.js` `processBatch` is legacy |
| Stages (active) | `src/core/stages/{expansion,dynamicPrompt,list}.js` + `prompt-salt.js`/`cleanup.js`; `src/prompt-modules/*` is frozen legacy reference |
| List store (in-memory, depletion, aliases) | `src/core/listStore.js`; `src/helpers/listFiles.js` (legacy) |
| Randomization | `src/helpers/random{Emphasis,Editing,Alternating}.js`, `keywordRepeater.js` |
| Generators | `data/dynamic-prompts/v2/<cat>/*.js` (+ `v1/` frozen) |
| Content | `data/lists/**/*.txt`, `data/expansions/**/*.txt`, `data/presets/*.json` |
| Classification / suggestions | `src/promptFilesAndSuggestions.js` |
| Resolution manifests | `src/listManifest.js`, `src/dynPromptManifest.js`, `src/gatedLists.js` |
