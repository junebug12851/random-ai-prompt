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
just like a list (`{d}`, `{artist}`). Groups can live anywhere in the tree.

- Lines starting with `#` are comments.
- Groups are pure unions, but the resolver is **mode-aware** (see SFW/NSFW below):
  a group's members resolve SFW-only or NSFW-inclusive following the same rule as a
  bare reference, so one group covers both modes.

### Implied groups (`.force-group-list`)

A folder containing an empty **`.force-group-list`** file *is* a group: `{<folder>}`
resolves to the union of every list under it (mode-aware), with no `.group` file to
maintain. `artist/`, `danbooru/d/`, and `name/` are marked, so `{artist}`, `{d}`, and
`{name}` are implied groups. Use an explicit `.group` file only for a **subset** that
isn't a whole folder — the remaining ones are `artist/digipa.group` (the 3 digital-
painting lists), `danbooru/d/character.group` (c + nc), and `danbooru/d/keyword.group`
(danbooru minus artists). Groups may nest up to **3 levels deep** (recursion cutoff +
cycle guard).

## SFW / NSFW

NSFW is keyed entirely off the filename — **any list whose name contains `nsfw` as a
word** (e.g. `clothes-nsfw`, `d/general-nsfw`) is adult content. While adult mode is
off the app behaves as if those files don't exist: they are never listed, never
suggested, and resolve to nothing if referenced.

A list that mixes both is stored as **two** files: `<name>-sfw.txt` (the SFW lines)
and `<name>-nsfw.txt` (only the NSFW lines). There is **no `<name>.txt`** — the bare
`{name}` is an implicit name the resolver synthesizes by combining them per mode.

**Safety rule:** a plain `<name>.txt` is honored only as a standalone SFW list with no
NSFW half. The moment a `<name>-nsfw.txt` exists, any `<name>.txt` beside it is
**ignored entirely** (never loaded, never listed) — the SFW half must be
`<name>-sfw.txt`. So a lone `<name>.txt` + `<name>-nsfw.txt` is treated as NSFW-only.
This enforces the split so SFW content can never accidentally leak from a misnamed file.

- `{name}` → SFW when adult is off; SFW + NSFW when on.
- `{name-sfw}` → the SFW lines only (always; the explicit safe reference).
- `{name-nsfw}` → nothing when adult is off; SFW + NSFW when on (the SFW base is
  auto-tacked on, so you never store a combined file).

Example: `danbooru/d/general-sfw.txt` + `danbooru/d/general-nsfw.txt` →
`{d/general}` / `{d/general-sfw}` / `{d/general-nsfw}`. The same `-sfw`/`-nsfw`
suffixes work on a group too (`{d-sfw}`, `{d-nsfw}`). A list that is
entirely adult (e.g. `artist/nudity-nsfw`, `word/adult-nsfw`) is just one `-nsfw` file.

## Editor button names & `.force-prefix`

In the editor, a list's button shows the **shortest unambiguous name** — just the
filename by default (`{color}`, `{noun}`), growing a folder prefix only when two
lists would otherwise collide (then both step out folder-by-folder until distinct).

A folder containing an empty **`.force-prefix`** file is exempt: its entries always
show the path from that folder down (e.g. `danbooru/d/` has one, so its lists show as
`{d/general}`, `{d/character}`). Forced entries are also left out of the auto-prefix
collision check, so they never push a prefix onto other lists. The marker inherits
downward — a `.force-prefix` in a parent folder forces more of the path on everything
beneath it. This is display-only; references still resolve by path suffix as usual.

## Reserved name: `keyword`

`keyword` is a **reserved wildcard**, not a file. `{keyword}` draws a random word from
**all loaded vocabulary** (every general list), mode-aware: SFW when adult is off,
SFW+NSFW when on. `{keyword-sfw}` is always SFW; `{keyword-nsfw}` is the full set and is
hidden when adult is off. It excludes the specialized `artist/*` and `danbooru/*`
namespaces (those have their own modes). The name always supersedes any list literally
called `keyword` — silently, no error. `keyword` is the default `keywordsFilename`.

## Content safety & gating

Slurs, minor-sexualizing, and extreme shock/gore content are removed by
`../../src/contentSafety.js`. Ordinary adult content is kept but **gated** behind the
`includeAdult` setting — automatically, by the `nsfw` name-token (see
`../../src/gatedLists.js`). Artist lists are additionally gated behind `includeArtist`.

## Folders

| Folder | What's in it |
|--------|--------------|
| `danbooru/d/` | Danbooru tags: general-sfw + general-nsfw (implicit `{d/general}`), artist, character-c, character-nc, meta, person. `.force-prefix` (→ `{d/...}`) + `.force-group-list` (→ `{d}` = all). Subset groups: `keyword` (no artists), `character` (c + nc) |
| `artist/` | Stable-Diffusion artist styles: anime, bw, cartoon, dhigh/dmed/dlow, fareast, fineart, nudity-nsfw, scribbles, special, ukioe, weird, secondary. `.force-prefix` (→ `{artist/...}`) + `.force-group-list` (→ `{artist}` = all). Subset group: `digipa` (dhigh+dmed+dlow) |
| `word/` | Parts of speech, one list each: adjective, adverb, noun, verb, preposition, interjection; plus `misc` (function/uncategorized words), `language` (languages/scripts), and `adult-nsfw` (gated sexual terms). Curated + dictionary merged. |
| `name/` | given, person, demonym, anime (implied group `{name}`) |
| `place/` | city, place (countries/regions/landmarks) |
| `lore/` | mythology, astronomy, religion, history, work, people-group |
| `nature/` | animal, flower, tree, planet, mythological-creature |
| `look/` | color, size, hair, clothes, weather, time, mood, emotion, view, image-effect, instrument, expression (faces), action (poses/activities); `clothes-nsfw` (gated lingerie/fetish) |
| `style/` | art-movement, art-technique, general, construct, building (folder is `.force-prefix` → `{style/building}` etc.) |
| `scene/` | room, school-room, shed, ship, store, vehicle (folder is `.force-prefix` → `{scene/ship}` etc.) |
| `brand/` | organization |

(`keyword` is no longer a folder — it's the reserved wildcard described above.)

See `../../notes/reference/list-architecture.md` for the full design, and
`../../list-help.md` for a per-file description.
