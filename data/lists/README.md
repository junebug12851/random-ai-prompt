# Keyword lists

Each `.txt` here is one keyword per line. Lists are organized into folders, but you
almost never type the folder — see "How references resolve" below.

## How to reference a list in a prompt

Write `{name}` in a prompt. The name is resolved against the cached index of every
list by **path suffix**, so all of these work:

- **Bare filename** — `{color}` → `look/color`, `{adjective}` → `word/adjective`
- **Short / partial path** — `{d/general}` → `danbooru/d/general`
- **Full path** — `{danbooru/d/general}`

Resolution rules (deterministic):

1. An exact match (full path or a virtual-list name) wins.
2. Otherwise any list whose path ends with `/<your-ref>` matches.
3. Among matches, the **shallowest** path wins — so a file higher in the tree acts
   as the default for that name.
4. Ties break by a **guaranteed natural order**: symbols first, then numbers in
   true numeric order (`2` before `10`), then letters alphabetically. You can force
   a default by prefixing a filename with a symbol or number (e.g. `_pick-me`).

Folders can be nested as deep as you like; the suffix lookup keeps references short.

## Short codes

Groups that had a prefix in the old flat scheme keep it as a short subfolder, so the
terse form still works and old names translate 1:1:

- old `d-general` → file `danbooru/d/general` → reference `{d/general}`

## Virtual lists (composites)

Defined in `../../src/listManifest.js`, not files on disk — unions of other lists
with de-duplication and an optional sfw/nsfw filter. Reference them by their short
name:

- `danbooru` — all danbooru tags (`d/*`); `d-character`, `d-keyword` — danbooru subsets
- `danbooru-sfw` — danbooru with NSFW-lexicon lines filtered out
- `artist` — all artist styles; `artist-digipa` — the three digipa lists
- `name` — given-name + person
- `adjective-all` / `noun-all` / `verb-all` / `adverb-all` — curated + dictionary (+ demonym)

## Content safety & gating

Slurs, minor-sexualizing, and extreme shock/gore content are filtered by
`../../src/contentSafety.js`. Adult content is kept but **gated** behind the
`includeAdult` setting (see `../../src/gatedLists.js`); artist lists are gated behind
`includeArtist`.

## Folders

| Folder | What's in it |
|--------|--------------|
| `danbooru/d/` | Danbooru tags: general, artist, character-c, character-nc, meta, person |
| `artist/` | Stable-Diffusion artist styles: anime, bw, cartoon, dhigh/dmed/dlow, fareast, fineart, nudity, scribbles, special, ukioe, weird, secondary |
| `word/` | Parts of speech — curated (adjective, adverb, noun, verb, preposition, interjection) and dictionary-derived (`dict-*`); `adult` (gated sexual terms moved out of the SFW word lists) |
| `name/` | given-name, person, demonym, anime-name |
| `place/` | city, place (countries/regions/landmarks) |
| `lore/` | mythology, astronomy, religion, history, work, people-group |
| `nature/` | animal, flower, tree, planet, mythological-creature |
| `look/` | color, size, hair, clothes, weather, time, mood, emotion, view, image-effect, instrument, expression; `clothes-adult` (gated lingerie/fetish) |
| `style/` | art-movement, art-technique, general-style, construct-style, building-style |
| `scene/` | room, school-room, shed-type, ship-type, store-type, vehicle-type |
| `brand/` | organization |
| `keyword/` | keyword (uncategorized leftover), keyword-adult (gated) |

See `../../notes/reference/list-architecture.md` for the full design, and
`../../list-help.md` for a per-file description.
