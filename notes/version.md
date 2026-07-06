# Changelog (Version History)

A plain-English history of the project, **one entry per commit, newest first**. Each entry expands the
commit message into a short narrative of what actually changed and why — the kind of summary you'd want
when skimming the project's evolution, with the raw diff left out.

> **Not to be confused with [`reference/versioning.md`](reference/versioning.md).** *This* file (and
> `version/`) is the **changelog** — the narrative of what changed, per commit. `versioning.md` is the
> **version-number scheme** (SemVer, the `VERSION` file). One is the story; the other is the label.

The changelog is **split by month** under [`version/`](version/2026-06.md) so no single page gets
unwieldy. This file is the index; pick a month below (newest first).

## Months

| Month | Notes |
|-------|-------|
| [June 2026](version/2026-06.md) | Revival: the 2.0.0 ES-module + Node 24 modernization, the React + Vite SPA migration, and the full JSDoc doc-site. |
| [April 2023](version/2023-04.md) | Last activity before a ~3-year dormancy (legacy detail wording, 2:1 presets). |
| [March 2023](version/2023-03.md) | LoRA support, image-size/wallpaper presets, repo hygiene. |
| [January 2023](version/2023-01.md) | Peak month: the Generate tab, animations, ImageMagick, nested blocks. |
| [December 2022](version/2022-12.md) | The original build — the randomization engine, the list library, the web gallery, JSON settings, the 2.0 refactor. |

> **Two eras.** The **2022–2023 months are reconstructed retrospectively** from the git log and grouped
> by theme (they predate the inline rule below). The **June 2026 month and onward follow the per-commit
> inline rule** — one entry per commit, written in the same commit.

## How this is kept updated (the inline rule)

**Write each entry as part of the commit it describes — before committing, not after.** When you make
a change, add its entry to the top of the current month's file under `version/` and stage it in the
**same commit** as the change. One commit = the work plus its own changelog entry. There is no separate
"update the changelog" commit (documenting the documentation is exactly the recursion this avoids).

A commit cannot contain its own hash, so inline entries carry **no hash marker**. To find the commit
for an entry, `git blame` the entry's line.

Inline entry format (newest on top; create `version/YYYY-MM.md` and add a row to the table above when
the month rolls over):

```
### YYYY-MM-DD — Short human title

One or two paragraphs in plain English. More for big/meaningful commits, a sentence or two for trivial
ones. No diff noise.
```

## Relationship to the session logs

The changelog is **one entry per git commit**; the [session logs](sessions/README.md) are **one entry
per working day**, broader than any single commit. They overlap but serve different readers.
