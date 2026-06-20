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

1. An exact match (full path, or a group name) wins.
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

## Group files (`.group`) — composites

A `<name>.group` file is a composite list: each line is itself a list reference
(resolved exactly like a `{name}` — bare, partial, or full path), and the group
resolves to the de-duplicated union of all those lists. Reference a group by name
just like a list (`{danbooru}`). Groups can live anywhere in the tree.

- Lines starting with `#` are comments.
- Groups are pure unions, but the resolver is **mode-aware** (see SFW/NSFW below):
  a group's members resolve SFW-only or NSFW-inclusive following the same rule as a
  bare reference, so one group covers both modes.

Current groups: `danbooru` (all `d/*`), `d-keyword` (danbooru minus artists),
`d-character`, `artist` (all artist styles), `artist-digipa`, `name` (given-name +
person). Groups may include other groups up to **3 levels deep** (recursion cutoff +
cycle guard).

## SFW / NSFW

NSFW is keyed entirely off the filename — **any list whose name contains `nsfw` as a
word** (e.g. `clothes-nsfw`, `d/general-nsfw`) is adult content. While adult mode is
off the app behaves as if those files don't exist: they are never listed, never
suggested, and resolve to nothing if referenced.

A list that mixes both is stored as **two** files: `<name>-sfw.txt` (the SFW lines)
and `<name>-nsfw.txt` (only the NSFW lines). There is **no `<name>.txt`** — the bare
`{name}` is an implicit name the resolver synthesizes by combining them per mode (a
plain `<name>.txt` is still honored if you prefer that layout):

- `{name}` → SFW when adult is off; SFW + NSFW when on.
- `{name-sfw}` → the SFW lines only (always; the explicit safe reference).
- `{name-nsfw}` → nothing when adult is off; SFW + NSFW when on (the SFW base is
  auto-tacked on, so you never store a combined file).

Example: `danbooru/d/general-sfw.txt` + `danbooru/d/general-nsfw.txt` →
`{d/general}` / `{d/general-sfw}` / `{d/general-nsfw}`. The same `-sfw`/`-nsfw`
suffixes work on a group too (`{danbooru-sfw}`, `{danbooru-nsfw}`). A list that is
entirely adult (e.g. `artist/nudity-nsfw`, `word/adult-nsfw`) is just one `-nsfw` file.

## Content safety & gating

Slurs, minor-sexualizing, and extreme shock/gore content are removed by
`../../src/contentSafety.js`. Ordinary adult content is kept but **gated** behind the
`includeAdult` setting — automatically, by the `nsfw` name-token (see
`../../src/gatedLists.js`). Artist lists are additionally gated behind `includeArtist`.

## Folders

| Folder | What's in it |
|--------|--------------|
| `danbooru/d/` | Danbooru tags: general-sfw + general-nsfw (implicit `{d/general}`), artist, character-c, character-nc, meta, person |
| `artist/` | Stable-Diffusion artist styles: anime, bw, cartoon, dhigh/dmed/dlow, fareast, fineart, nudity-nsfw, scribbles, special, ukioe, weird, secondary |
| `word/` | Parts of speech, one list each: adjective, adverb, noun, verb, preposition, interjection; plus `misc` (function/uncategorized words) and `adult-nsfw` (gated sexual terms). Curated + dictionary merged. |
| `name/` | given-name, person, demonym, anime-name |
| `place/` | city, place (countries/regions/landmarks) |
| `lore/` | mythology, astronomy, religion, history, work, people-group |
| `nature/` | animal, flower, tree, planet, mythological-creature |
| `look/` | color, size, hair, clothes, weather, time, mood, emotion, view, image-effect, instrument, expression (faces), action (poses/activities); `clothes-nsfw` (gated lingerie/fetish) |
| `style/` | art-movement, art-technique, general-style, construct-style, building-style |
| `scene/` | room, school-room, shed-type, ship-type, store-type, vehicle-type |
| `brand/` | organization |
| `keyword/` | keyword (uncategorized leftover), keyword-nsfw (gated) |

See `../../notes/reference/list-architecture.md` for the full design, and
`../../list-help.md` for a per-file description.
