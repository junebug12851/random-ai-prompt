# Keyword lists — architecture, content safety, and virtual lists

How `data/lists/` is structured after the 2.1.0 cleanup, and the three systems that govern it.

## Physical vs virtual lists

A **physical list** is a `data/lists/<name>.txt` file, one keyword per line, referenced in a prompt as
`{name}`. A **virtual list** has no file — it is defined in [`../../src/listManifest.js`](../../src/listManifest.js)
as a union of other lists (physical or virtual), assembled on demand with cross-member de-duplication and
an optional `sfw`/`nsfw` filter. Virtual lists are how the project "collapses lists into others": the big
duplicated files the build scripts used to emit are gone, computed instead from their atomic parts.

Current virtual lists:

| Virtual | Built from | Notes |
|---------|-----------|-------|
| `d-character` | `d-character-nc` + `d-character-c` | |
| `d-keyword` | `d-general` + `d-character-c` + `d-character-nc` + `d-meta` | NSFW-gated |
| `danbooru` | the above + `d-artist` | NSFW-gated |
| `danbooru-sfw` | `danbooru`, filtered `sfw` | NSFW lexicon lines removed |
| `artist-digipa` | `artist-dhigh` + `artist-dmed` + `artist-dlow` | |
| `artist` | all `artist-*` category lists | |
| `adjective-all` | `adjective` + `dict-adjective` | curated + dictionary |
| `noun-all` / `verb-all` / `adverb-all` | curated + matching `dict-*` | |

### The loader seam

Three consumers resolve lists, all via `resolveListLines(name, readPhysical)` from `listManifest.js`:
the two engine loaders [`src/core/nodeLoader.js`](../../src/core/nodeLoader.js) (fs) and
[`src/core/browserLoader.js`](../../src/core/browserLoader.js) (Vite glob), and the classic runtime store
[`src/helpers/listFiles.js`](../../src/helpers/listFiles.js). `readPhysical` is injected per environment,
so `listManifest.js` itself stays browser-safe (no Node imports), like `gatedLists.js`. `listNames()`
returns physical + virtual names, so virtual lists are suggestible and gateable like any other.

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

`keyword.txt` was a 48,750-line SCOWL English-dictionary dump. `scripts/list-cleanup/classify-pos.mjs`
sorted it with `compromise`: capitalized entries stayed in `keyword.txt` (now ~10k proper nouns), lowercase
words were routed to `dict-adjective/noun/verb/adverb/misc`, and junk (possessives, redundant inflected
forms, non-alphabetic) was dropped. Conservation: 46,500 sorted + 2,250 dropped = 48,750. Isolated-word POS
tagging is best-effort; `dict-noun` is the catch-all for anything `compromise` didn't recognize.
