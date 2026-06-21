# Keyword lists — architecture, content safety, and group files

How `data/lists/` is structured after the 2.1.0 cleanup, and the three systems that govern it.

## Lists and group files

A **list** is a `data/lists/<name>.txt` file, one keyword per line, referenced in a prompt as `{name}`.

A **group** is a `<name>.group` file: each non-comment line is itself a list reference (resolved like any
`{name}`), and the group resolves to the de-duplicated union of those lists. This is how the project
"collapses lists into others" — the big duplicated files the build scripts used to emit are gone, computed
on demand from their atomic parts. Groups are first-class files (can live anywhere) and are referenced and
gated exactly like lists. Groups may include groups up to `MAX_GROUP_DEPTH` (3) levels with a cycle guard.
Current groups: `danbooru/d/d.group` (all `d/*`, ref `{d}`), `danbooru/d/keyword.group` (danbooru minus
artists, `{d/keyword}`), `danbooru/d/character.group` (`{d/character}`), `artist/artist.group`,
`artist/artist-digipa.group`, `name/name.group` — referenced terse as `{d}`, `{artist}`, etc. via suffix
resolution. The danbooru groups live inside the `d/` folder to match the `{d/...}` reference convention. (Curated + dictionary POS lists
were merged into one list each, so the former `*-all` virtuals are gone.)

**SFW/NSFW is keyed off the filename and resolved by mode — no runtime content filtering, no group files.**
Any name with an `nsfw` token (a word delimited by `/`, `-`, `.`, `_`, or string ends — e.g.
`d/general-nsfw`, `clothes-nsfw`) is adult content; while `includeAdult` is off the app treats those files
as nonexistent (not listed, not suggested, resolve to nothing). A list that mixes is stored as two files —
`<name>-sfw.txt` (SFW lines) + `<name>-nsfw.txt` (NSFW-only lines), with **no `<name>.txt`**; the bare
`{name}` is implicit. `logicalListNames()` derives the reference set the app sees: for each `-sfw`/`-nsfw`
pair it exposes `{name}`, `{name-sfw}`, `{name-nsfw}`. **Safety rule:** a plain `<name>.txt` is honored
only when it has NO `<name>-nsfw.txt` sibling; if such a sibling exists the plain file is ignored entirely
(not listed, not loaded — `readSfwBase` and `logicalListNames` both enforce this), so SFW content can never
leak from a misnamed file and a lone `<name>.txt` + `<name>-nsfw.txt` is treated as NSFW-only. The resolver combines them by mode: `{name}` = SFW (off) / SFW+NSFW (on); `{name-sfw}` =
SFW-only always; `{name-nsfw}` = nothing (off) / SFW+NSFW (on, the SFW base auto-tacked on, so no combined
file is ever stored). `resolveListLines` takes `includeAdult`, re-resolves the suffix-stripped base, and
propagates the resolved variant into group members — so one `d.group` (`{d}`) is SFW when off and
NSFW-inclusive when on, and `{d-sfw}` / `{d-nsfw}` force a variant on the whole group. A
fully-adult list is just a single `-nsfw` file (`artist/nudity-nsfw`, `word/adult-nsfw`,
`keyword/keyword-nsfw`, `look/clothes-nsfw`), reachable only by its gated name. The CSV build script writes
`general-sfw.txt` + `general-nsfw.txt` via the `isNsfw` lexicon.

### The loader seam

Three consumers resolve lists, all via `resolveListLines(name, readers)` from `listManifest.js`: the two
engine loaders [`src/core/nodeLoader.js`](../../src/core/nodeLoader.js) (fs) and
[`src/core/browserLoader.js`](../../src/core/browserLoader.js) (Vite glob), and the classic runtime store
[`src/helpers/listFiles.js`](../../src/helpers/listFiles.js). `readers` (`{ names, readListFile,
readGroupFile }`) is injected per environment, so `listManifest.js` stays browser-safe (no Node imports),
like `gatedLists.js`. `listNames()` returns list + group names, so groups are suggestible and gateable like
any list.

## Editor button names (`computeButtonNames` + `.force-prefix`)

The editor shows the shortest unambiguous token per list, not the full path.
`computeButtonNames(names, forcedDirs)` (in `listManifest.js`) does this in two stages:
**manual** — any list under a folder marked with an empty `.force-prefix` file shows
its path from the highest such ancestor down (so `danbooru/d/general` → `{d/general}`),
and these are excluded from the auto stage so they never push prefixes onto others;
**auto** — every other list starts at its bare filename and only grows a folder
segment when two collide, both stepping out until distinct. A final pass guarantees
each token `resolveName()`s back to its own canonical name. The loaders expose
`forcedPrefixDirs()` (nodeLoader walks for `.force-prefix`; browserLoader globs
`**/.force-prefix` — Vite bundles the dotfile). The SPA's `getBlocks` uses this for the
"Lists" token cloud. It is display-only; resolution is unchanged. Only `danbooru/d` is
forced today (the `d/` short-code convention); everything else shows a bare filename.

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
- **NSFW lexicon** — `isNsfw(line)` flags ordinary adult/nudity terms. This is **not** a removal set; the
  CSV build script uses it once to split a mixed list into the `<name>-sfw.txt` and `<name>-nsfw.txt` files
  (no runtime filtering). It is a lexicon, not a guarantee — tightening the SFW split means adding terms
  here and rerunning the build.

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

[`../../src/gatedLists.js`](../../src/gatedLists.js) gates adult content **automatically by name**:
`isGatedList(name)` is true iff the name carries an `nsfw` token (`NSFW_TOKEN` — a word delimited by `/`,
`-`, `.`, `_`, or string ends). So `d/general-nsfw`, `artist/nudity-nsfw`, `word/adult-nsfw` are gated while
the plain/SFW names (`d/general`, `d/general-sfw`, `danbooru`, `color`) are not — no hardcoded list to keep
in sync. When adult is off, gated names are dropped from the suggestion pool, hidden from the picker
(`pickerListNames`), and `pull()` returns "" if one is referenced directly. `gatedDynPrompts` is now empty
(`#danbooru` draws the mode-aware `d/general`, SFW when adult is off, so it needs no gating).

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
   (moved + remainder == base) so nothing is ever lost; anything not confidently classified stayed in
   `keyword.txt`. `keyword.txt` went 8,859 → 593.

Slurs surfaced during this pass (`Jap`, `Negress`, `Negroid`) were added to `contentSafety.js` and purged
rather than categorized.

### Second keyword pass (2026-06-20)

The ~593 remainder was still a grab-bag (gods, dinosaurs, dog/cattle breeds, wines, cheeses, languages,
geologic eras, chemical symbols, month/day abbreviations, inflected junk). A second hand-classification
(`scripts/list-cleanup/reclassify-keyword.mjs`, explicit decision per entry + coverage assertion) relocated
354 entries to their proper lists (nature/animal, lore/mythology|astronomy|history|religion|people-group,
place/place, name/person|given-name, style/art-movement, brand/organization, nature/flower|mythological-creature,
look/hair|time|clothes-sfw, word/noun|adjective|verb), **dropped 219** junk entries (element symbols,
abbreviations, inflected tech artifacts, fragments, units), and **kept 20** (languages/writing systems).
So `keyword-sfw.txt` went 593 → 20.

### `keyword` is now a reserved wildcard

After the second pass, `keyword` was promoted to a **reserved name** (`RESERVED_WILDCARD` in
`listManifest.js`) — it is not a file. `{keyword}` resolves to a random word drawn from ALL loaded
vocabulary, mode-aware (SFW when adult off, +NSFW on); `{keyword-sfw}` is always SFW; `{keyword-nsfw}` is
the full set (gated). It excludes the specialized `artist/*` and `danbooru/*` namespaces. `resolveName`
short-circuits the reserved name (so it never suffix-matches `danbooru/d/keyword`), and `resolveListLines`
builds the union. The name always supersedes any file literally named `keyword`, silently. The 20 leftover
languages moved to `word/language.txt`; the old `keyword-nsfw.txt` adult vocab merged into
`word/adult-nsfw.txt`; the `keyword/` folder was deleted. `keyword` remains the default `keywordsFilename`,
so the default generator now draws from the whole vocabulary.
