# Repo hygiene — keeping the project from rotting

This page is the standing defense against three failure modes that accumulate quietly across sessions:
**(1)** useful files written but never committed, **(2)** stale/broken references left behind after a
rename or removal, and **(3)** merged branches littering the remote. Each now has a **mechanical guard**
so it can't silently pile up again — plus the rules the guards enforce.

## The guards (what runs automatically)

| Guard | What it catches | Where it runs |
|-------|-----------------|---------------|
| `npm run check:docs` (`scripts/check-links.mjs`) | Broken **relative links** in any tracked `.md` — which is exactly what a rename/move/removal produces when a doc still points at the old path. | In **`npm test`** and in **CI** (`ci.yml` → the `check` job). A broken link **fails the build.** |
| `npm run check:tidy` (`scripts/check-tidy.mjs`) | **Untracked, non-ignored** files (`git status` `??` entries) — almost always notes/docs/reports someone wrote but never committed. | Run **before finishing a work session** (it's not in CI — a fresh checkout has none, and untracked WIP mid-session is normal). |
| GitHub **auto-delete head branches** | Merged PR branches lingering as litter. | Repo setting `delete_branch_on_merge = true` — every merged PR branch is deleted automatically. |

Run everything at once before handing off: **`npm test && npm run check:tidy`**.

> **One interaction to know.** `delete_branch_on_merge` deletes the merged PR's _head_ branch — and for a
> `dev → main` PR the head is **`dev` itself**. So `dev` carries a **deletion-only** branch protection:
> it blocks deletion + force-push but requires **no** PR / review / status checks, so you and CI still
> `git push origin dev` exactly as before. GitHub skips auto-deleting protected branches, so `dev`
> survives every `dev → main` merge while spent **feature** branches still auto-clean. (`main` keeps its
> full protection; see [`git-workflow.md`](git-workflow.md).)

## The rules the guards back up

- **Nothing useful is ever left uncommitted.** The notes are a living document — commit as you go. The
  changelog entry goes **in the same commit** as its change (see [`git-workflow.md`](git-workflow.md)).
  **Every fairyfox run writes a report** to `notes/fairyfox-reports/` and it gets **committed** (its own
  commit is fine) — reports are never left as untracked files. The **only** things deliberately
  uncommitted are gitignored machine junk: `/_*.bat` · `/_*.log` · `/_*.sh` · `*-private*` · `output/` ·
  `node_modules/` · coverage / build artifacts. If a file isn't one of those, it belongs in a commit —
  `check:tidy` will remind you.

- **Rename/move/remove a file or feature → sweep the docs in the _same_ change.** Before committing,
  grep the notes for the old name and update or de-link every reference. `check:docs` catches broken
  **links** for free; for prose mentions of removed things, grep (e.g. `git grep -n "old-name" -- "*.md"`)
  and fix current-state docs. Genuinely historical records (dated `sessions/`, `version/`,
  `fairyfox-reports/`, `decisions/`, and pages explicitly banner-marked *historical* like
  `systems/cli.md` / `systems/server.md`) are left intact — that's correct record-keeping, not drift.

- **Delete spent branches.** With auto-delete on, PR merges clean themselves up. For a branch merged
  outside a PR, delete it (local + remote) as the end of the merge. A healthy remote has **only** `dev`,
  `main`, and any genuinely-active work branch — verify with `git ls-remote --heads origin`. (Check
  merge status with the **full** ref name, e.g. `git merge-base --is-ancestor origin/feature/x
  origin/main` — not the bare name, or the check silently reports "not merged".)

## Periodic health check

Not on a timer — run this when things feel cluttered, or before a release:

```
npm test                     # includes check:docs (broken links fail here)
npm run check:tidy           # nothing uncommitted that should be tracked
git ls-remote --heads origin # only dev, main, + active work?
gh pr list ; gh issue list   # anything open to triage?
git grep -n "<removed-name>" -- "*.md"   # prose references to anything you removed
```

See also [`git-workflow.md`](git-workflow.md) (branch model + safety rules),
[`documentation.md`](documentation.md) (the doc-site + note house-style), and the "Maintaining the Notes"
standing instruction in the root `CLAUDE.md`.
