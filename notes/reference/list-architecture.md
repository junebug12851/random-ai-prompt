# Keyword lists — architecture, content safety, and group files

How `data/lists/` is structured after the 2.1.0 cleanup, and the three systems that govern it.

## Lists and group files

A **list** is a `data/lists/<name>.txt` file, one keyword per line, referenced in a prompt as `{name}`.

A **group** is a `<name>.group` file: each non-comment line is itself a list reference (resolved like any
`{name}`), and the group resolves to the de-duplicated union of those lists. This is how the project
"collapses lists into others" — the big duplicated files the build scripts used to emit are gone, computed
on demand from their atomic parts. Groups are first-class files (can live anywhere) and are referenced and
gated exactly like lists. Groups are pure unions — there is no runtime content filtering. SFW/NSFW are kept
as EXCLUSIVE lists: when a list genuinely mixes both it is split into `<name>-sfw` + `<name>-nsfw`, plus a
`<name>.group` importing both — so plain `{name}` = both, `{name-sfw}` = SFW-only, `{name-nsfw}` = NSFW-only
(e.g. `danbooru/d/general-sfw`, `danbooru/d/general-nsfw`, `danbooru/d/general.group`). Lists entirely one
type are left whole. The CSV build script writes the `-sfw`/`-nsfw` general files. Groups may include groups up to `MAX_GROUP_DEPTH` (3) levels with a cycle guard. Groups live in their
folders like any list: `danbooru/danbooru.group` (all `d/*`), `danbooru/d-character.group`,
`danbooru/d-keyword.group`, `danbooru/danbooru-sfw.group` (`@filter sfw`), `artist/artist.group`,
`artist/artist-digipa.group`, `name/name.group` — referenced terse as `{danbooru}`, `{artist}`, etc. via
suffix resolution. (Curated + dictionary POS lists were merged into one list each, so the former `*-all`
virtuals are gone.)

### The loader seam

Three consumers resolve lists, all via `resolveListLines(name, readers)` from `listManifest.js`: the two
engine loaders [`src/core/nodeLoader.js`](../../src/core/nodeLoader.js) (fs) and
[`src/core/browserLoader.js`](../../src/core/browserLoader.js) (Vite glob), and the classic runtime store
[`src/helpers/listFiles.js`](../../src/helpers/listFiles.js). `readers` (`{ names, readListFile,
readGroupFile }`) is injected per environment, so `listManifest.js` stays browser-safe (no Node imports),
like `gatedLists.js`. `listNames()` returns list + group names, so groups are suggestible and gateable like
any list.

## Folder organization & name resolution

Lists live in folders under `data/lists/` (danbooru, artist, word, name, place, lore,
nature, look, style, scene, brand, keyword) — see `data/lists/README.md`. The danbooru
group keeps a `d/` short-code subfolder so old `d-general` → `danbooru/d/general`,
referenced terse as `{d/general}`.

References resolve by **path suffix** via `resolveName()` (listManifest.js): exact match
wins, else any name ending `/<ref>`, choosing the **shallowest** path (folders act as
defaults), ties broken by `compareNames()` — a guaranteed natural order (symbols, then
numeric-order numbers, then letters) so users can force a default by prefixing a name.
All three loaders walk `data/lists` recursively and resolve through this, so bare
filenames, partial paths, and full paths all work and folders can nest arbitrarily.
Basenames were kept unique during the move so the ~78 existing `{name}` references in
dynamic prompts still resolve; only the danbooru `d-*` string references were updated.

## Content safety

[`../../src/contentSafety.js`](../../src/contentSafety.js) (also browser-safe) is the single source of the
safety vocabulary:

- **Removal blocklist** — `classifyRemoval(line, {listType})` returns a category (`slur`,
  `minor-sexual`, `slur-ambiguous`, `extreme`) or null. Matching is whole-word on a normalized,
  space-separated form (so `cockpit` never matches `cock`). On **content** lists it token-matches the full
  set; on **proper-noun** lists it matches EXACT whole entries only (so `Coon Rapids`, the hamlet `Dyke`,
  `Rio Negro` survive while a bare slur entry does not). A `WHITELIST` covers remaining false positives.
- **NSFW lexicon** — `isNsfw(line)` flags ordinary adult/nudity terms. This is **not** a removal set; it
  drives the `sfw`/`nsfw` filter on virtual lists (e.g. `danbooru-sfw`). It is a lexicon, not a guarantee
  — tightening `danbooru-sfw` means adding terms here.

The filter is applied in two places: the CSV build scripts (`data/process-danbooru-csv.js`,
`data/process-artists-csv.js`) skip disallowed keywords so **regeneration stays clean**, and the one-time
cleanup tooling under `scripts/list-cleanup/` purged the already-committed lists. Policy (owner, 2026-06-20):
remove slurs + minor-sexualizing + extreme shock/gore/non-con; keep ordinary adult content, NSFW-gated.

### What "good/complete" means here

A denylist is never provably complete. What makes this one trustworthy: it is **plain, reviewable data**
(every term is visible and editable in one file); every purge is **auditable** (`scan.mjs` reports all
matches before `purge.mjs` deletes, which is how the place-name/artist-handle false positives were
caught); and the corpus is **finite and fixed**, so the contents can be audited directly rather than
trusting the denylist to anticipate arbitrary input. A periodic completeness audit — extract the distinct
tokens and review anything the denylist missed — is the way to raise confidence over time.

## Gating

[`../../src/gatedLists.js`](../../src/gatedLists.js) lists names only drawn when `includeAdult` is on:
`danbooru`, `d-general`, `d-keyword`, `artist-nudity`, `keyword-adult`. `danbooru-sfw` is intentionally
**not** gated. Gating is by name, so it applies to virtual lists too.

## The dictionary reorg

`keyword.txt` was a 48,750-line SCOWL English-dictionary dump. `scripts/list-cleanup/pos-dictionary.mjs`
sorts it **authoritatively by looking each word up in WordNet** (the `wordpos` / `wordnet-db` dev
dependency — index files read directly): a word is added to the `dict-*` list(s) for the part(s) of speech
the dictionary assigns it, so `bond` lands in both `dict-noun` and `dict-verb`. Rules:

- a word WordNet knows → its real POS list(s);
- a **capitalized** word WordNet knows *only* as a noun → kept in `keyword.txt` (it is almost certainly a
  proper noun WordNet happens to list, e.g. *America*, *Paris*, *December*);
- a capitalized word WordNet doesn't know → `keyword.txt` (proper noun);
- a lowercase word WordNet doesn't know → `dict-misc` (obscure / function words, and `-ally` adverbs WordNet
  doesn't index — a known WordNet gap);
- demonyms (compromise `#Demonym`) → `demonym.txt`;
- junk (possessives, non-alphabetic, redundant inflected forms) → dropped.

Conservation: 31,840 classified + 8,859 proper + 124 demonym + 5,451 misc + 2,476 dropped = 48,750. This
replaced an earlier `compromise` guess-from-spelling pass that mislabeled isolated words (e.g. treated any
`-ly` ending as an adverb); WordNet lookup is ground truth, not a guess.

## Proper-noun categorization

WordNet doesn't know proper nouns, so the ~8,859 names it left in `keyword.txt` were split further:

1. An automatic first pass (`split-proper.mjs`, using `compromise` + `city.txt` membership) pulled out
   `given-name`, `place`, `organization`, and de-duplicated confirmed cities into `city.txt`.
2. The remaining ~4,422 were then **hand-classified individually** (AI world-knowledge, in batches under
   `scripts/list-cleanup/cat/`, distributed by `build-categories.mjs`) into `person`, `place`,
   `organization`, `mythology`, `astronomy`, `people-group`, `religion`, `history`, and `work`. This is the
   one place individual judgment beats both dictionaries and POS rules — there is no lookup table that
   knows *Achernar* is a star or *Accenture* a company. `build-categories.mjs` enforces a coverage check
   (moved + remainder == base) so nothing is ever lost; anything not confidently classified stays in
   `keyword.txt` (now ~593 abbreviations / fragments). `keyword.txt` went 8,859 → 593.

Slurs surfaced during this pass (`Jap`, `Negress`, `Negroid`) were added to `contentSafety.js` and purged
rather than categorized.
