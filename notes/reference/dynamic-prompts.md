# Reference — The dynamic-prompt catalog & data-build pipeline

The `{#name}` generators in `engine/data/dynamic-prompts/` are where most of the original creative effort went:
~113 little plugins that each return a prompt fragment, composed through the DSL
([prompt-dsl.md](prompt-dsl.md)). This page is the **catalog and authoring idiom** — how the generators
are built, how they compose, the v1→v2 story, and how the word-lists they pull from are generated from
raw sources. For the sigil mechanics see [prompt-dsl.md](prompt-dsl.md); for the engine see
[../systems/core-engine.md](../systems/core-engine.md).

As of **2.3.0** the v2 generators are sorted into category folders under `engine/data/dynamic-prompts/v2/`
(`scene` / `subject` / `fragment` / `style` / `prompt` / `user`), `v1/` stays frozen, and `{#name}` resolves
by **path suffix** (shared `resolveName`) so every reference stays short and category-independent. The full
parity design (sidecars, `_force-prefix`, the verification seam) is in
[dynamic-prompts-architecture.md](dynamic-prompts-architecture.md).

## The authoring idiom

A generator is `export default function (settings, imageSettings, upscaleSettings) { … return string }`,
plus optional `export const full` / `export const suggestion_exclude`. The house style is **probabilistic
accretion**: start from a base phrase, then append fragments under independent coin-flips, mixing literal
text with nested DSL tokens. E.g. `city.js`:

```js
let prompt = "city, streetview, {city}";
if (_.random(0.0, 1.0, true) < 0.5) prompt += ", {building-style}";
if (_.random(0.0, 1.0, true) < 0.5) prompt += ", cityscape";
prompt += ", {#nature}, {#weather}, reflective street, wide shot";
return prompt;            // export const full = true
```

Because the output is re-fed through the pipeline (expansion/dynamic-prompt run twice, then list), a
generator freely emits `{#other-prompt}`, `{list}`, and `<expansion>` tokens and lets the engine resolve
them. This is the composition backbone: **full** scene prompts pull in **partial** helpers. (The sigil is
brace-delimited `{#name}` as of 2.4.0 — see [dynamic-prompts-architecture.md](dynamic-prompts-architecture.md).)

## Full vs partial (the classification that drives everything)

`export const full = true` marks a prompt that stands alone as a complete scene; its absence marks a
**partial** fragment meant to garnish other prompts. `promptFilesAndSuggestions.js` reads this flag to
split the catalog, and it drives both `{#random}`-style suggestions and the web Generate page's grouped
token picker ("Full Dynamic Prompts" vs "Partial Dynamic Prompts"). `suggestion_exclude` keeps a valid
prompt out of random suggestions.

- **Full scene generators** (≈full): `landscape`, `city`, `castle`, `cave`, `mountains`, `space`,
  `ship`, `vehicle`, `ruins`, `room`, `school-room`, `store-interior`, `storefront`, `house`,
  `log-cabin`, `great-tree`, `great-bridge`, `beach`, `park`, `zoo`, `underwaterscape`, `knight`,
  `futuristic`, the `portrait-*` family, `retro-poster`, `vibrant-art`, and the publicprompts.art set.
- **Partial fragment helpers** (no `full`): `color`, `glow`, `neon`, `eerie`, `mystical`, `nature`,
  `weather`, `water`, `wildlife`, `fx`, `expressive`, `general-state`, `room-state`, `ice`, `lava`,
  `crystal`, `settlement`, `spaceship`, `portrait`. These return `, fragment` strings and are the
  building blocks fulls compose from (and the garnish `prePrompt()` sprinkles into suggestions).

The proposed **textual DPL** for authoring these generators without JS — both `assets/mockup/` revisions,
the start/middle/end layering, and the open design questions — is analyzed in
[`dpl-language.md`](dpl-language.md).

## The entity polymorphism

`entity.js` is a small type system: it picks one of {animal, danbooru character, colored flower,
instrument, mythological creature, tree, person} and optionally adds emotion/hair/clothes for humanlike
results, gated by an entity-class filter. Thin wrappers specialize it: `animal.js` (`"animal"`),
`person.js` (`"human"`), `living-entity.js` (`"living"`), `entity-name.js` (name-only). The
publicprompts.art templates embed `{#entity}` / `{#person}` / `{#living-entity}` / `{#entity-name}` as their
"`<name>`" slot, so one template yields wildly different subjects each run.

## The random prompt generators

These live in the **`v2/prompt/`** category (force-prefixed, so they show/insert as `{#prompt/…}`).

| Token | File | Behavior |
|-------|------|----------|
| `{#prompt/random-words}` (the default `settings.prompt`) | `v2/prompt/random-words.js` | A pile of random `{keyword}` pulls via `keywordRepeater` — the "completely random keywords" mode. |
| `{#prompt/random}` (composite) | `v2/prompt/random.js` | Calls the suggestion builder `promptSuggestion(true)` (full, AND-weighted blends); stores `settings.randomPrompt`. |
| `{#prompt/simple-random}` | `v2/prompt/simple-random.js` | `promptSuggestion()` (single full prompt, lighter garnish). |
| `{#prompt/extra-random}` | `v2/prompt/extra-random.js` | Forces `keywordsFilename`/`artistFilename = false` then runs `random` — any list, maximum chaos. |

`v2/prompt/artists.js` and `v2/prompt/fx.js` are the two prompts the pipeline **auto-appends** (`{#artists}`,
`{#fx}`) when `autoAddArtists` / `autoAddFx` are on (resolved by suffix, so the force-prefix is display-only);
`v2/prompt/d.js` composes danbooru anime tag streams (`{d-general}` + `{d-character}` + `{d-meta}`). (Renamed
from the old `engine/` folder in 2.5.0: `danbooru`→`d`, `random`→`random-words`, and `*-prompt`→`*`.)

## v1 vs v2 — the decomposition story

`engine/data/dynamic-prompts/v1/` (33 frozen modules, addressed as `{#name-v1}`, always treated as `full`, and
they force `autoAddFx`/`autoAddArtists` off because they bake those in) are the **original monolithic**
generators. They inline private helpers like `maybeAddColor()`, `multiColor()`, and
`entityBasicKeywords()` and hard-bake color/weather/time (several import the shared `entityBasicKeywords`
from `../v2/subject/entity.js`). The categorized `v2/` set is the **refactor**: the
same scenes re-expressed by *extracting* those into shared composable sub-prompts (`{#color}`, `{#weather}`,
`{#nature}`, `{#general-state}`, `{#room-state}`, the `entity` family). v1 is kept verbatim so old looks stay
reproducible — reading a v1/v2 pair side by side is the clearest window into the project's "compose from
building blocks" design turn (Jan 2023; see [../context/history.md](../context/history.md)).

`v2/user/` holds community contributions (addressed `{#user-name}`, always `full`) — currently
`beach-merk.js` by Merk, which notably composes siblings as **direct function imports**
(`${city()}` from `../scene/city.js`, `${nature()}` from `../fragment/nature.js`) rather than `{#city}`
tokens, an alternative to token-based composition.

Provenance worth preserving: the `3d-*`, `comic`, `sticker`, `funko-3d-print`, `fluffy-animal`,
`needle-felt`, `silhouette`, `psychedelic`, `space-hologram`, `gold-pendant`, `lowpoly-3d-isometric`,
`sports-logo`, `anime-irl` templates are credited "taken from publicprompts.art and modified to be more
dynamic" — the original swapped their fixed `<name>` subject for the `{#entity}` system. Keep these credits
(also in `list-credits.md`).

## The data-build pipeline (lists from raw sources)

The `{list}` word-lists in `engine/data/lists/*.txt` are **generated**, not hand-maintained, by one-off scripts
in `data/` from large raw sources (kept under version control as the inputs):

| Script | Source | Output | Notes |
|--------|--------|--------|-------|
| `process-artists-csv.js` | `artists.csv` (AUTOMATIC1111 artist-score CSV) | `artist.txt` + `artist-{anime,bw,cartoon,dlow,dmed,dhigh,digipa,fareast,fineart,nudity,scribbles,special,ukioe,weird}.txt` | Filters by `minScore = 0.4`; buckets by category; `artist.txt` is the union. |
| `process-danbooru-csv.js` | `danbooru.csv` (tag,type,count) | `d-general/d-artist/d-character{,-c,-nc}/d-meta/d-keyword/danbooru.txt` | Filters `count >= 500`; buckets by type; cleans `_`/`/`/parens; combined lists for character & keyword. |
| `process-nai-tag-expirement.js` | `nai-tag-expirement.json` (NovelAI tag categories) | `artist2.txt`, `image-effect.txt`, `anime-name.txt`, and many category lists | kebab-cases keys, merges `artist*`→`artist2`, skips danbooru, de-pluralizes, renames `photo-effect`→`image-effect` and `anime`→`anime-name`, appends a few custom effects. |

These run manually (they `process.chdir` to the repo root and write into `settings.listFiles`); they are
not part of normal generation. The raw sources and their licenses are credited in `list-credits.md`. The
hand-authored lists (cities, building styles, rooms, clothes, etc.) live alongside the generated ones in
`engine/data/lists/`.

## Expansions (`<name>`) the generators rely on

`data/expansions/` holds the text macros generators splice in (now nested into category folders, referenced
by bare name via path-suffix resolution): `dap` (`deviantart, art station, pixiv`), `detail/legacy`
(`masterpiece, highres, … HDR`; `detail/` is force-prefixed), `rays` (`god ray, light shaft, volumetric
lighting`), `detail/legacy-person`, `pixelart`, `candlelight`, `coffecup`, `flower-pic` (itself
`{flower}, {flower}, {artist}`), and `underwater-anime-irl` (which nests `{#anime-irl}`) — proof that
expansions can themselves contain lists and dynamic prompts. See
[`expansions-architecture.md`](expansions-architecture.md).
