# Git Workflow

This project follows the fairyfox system's **git-flow** standard (the branching model, not the
`git flow` CLI — plain `git` carries it). These are procedures the AI upholds by judgement, not
automation. Canonical source: `hub/standards/git-workflow.md` in the system clone.

## Branch model

git-flow runs **two long-lived branches** and **three kinds of short-lived support branch**.

- **`main`** — production. Every commit on `main` is a **tagged release**, reached only by `--no-ff`
  merge. **Never commit directly.** It advances at a release: a **PATCH** goes directly from `dev`; a
  **MINOR/MAJOR** goes through a `release/*` branch; an urgent fix goes through a `hotfix/*` branch.
  `main` is the repo's stable branch and default branch. (`master` was renamed to `main` on
  2026-06-25 to adopt the system standard — `master` is no longer used.)
- **`dev`** — the integration branch (git-flow's `develop` role, kept under the shorter name). All
  finished work lands here first. **This is the branch the hub tracks for sync** (the registry
  `branch:` field).
- **`feature/<name>`** — the normal unit of work. Branch from `dev`, build, merge **back into `dev`**
  with `--no-ff`, then delete. Never branch a feature off `main`.
- **`release/<x.y.0>`** — the mechanism for a **MINOR or MAJOR** release. Branch from `dev` to bake the
  release (final polish, `VERSION` bump, changelog), merge **into `main`** + tag **and** back into
  `dev` (`--no-ff` both), then delete.
- **`hotfix/<x.y.z>`** — an urgent production fix. Branch from `main`, fix, merge **into `main`** + tag
  **and** back into `dev` (`--no-ff` both), then delete.

Support-branch names use a `type/` prefix plus a short kebab-case description.

## Developing a feature

```sh
git checkout dev
git checkout -b feature/<name>
# … commit work on the feature branch, push it to back it up …
git checkout dev
git merge --no-ff feature/<name>     # keeps the feature as one revertible unit
git branch -d feature/<name>
git push origin dev
```

The `--no-ff` merge commit groups the feature's commits under one parent — legible in history and
revertible in one move (`git revert -m 1 <merge>`).

**Solo / small-project latitude:** a genuinely **trivial** change (a typo, a one-line doc fix) may be
committed directly on `dev` rather than via a `feature/*` branch. Anything that is really "a feature,"
or is large/risky, still gets its own branch. The release path below is **not** latitude — it is fixed
by the SemVer level.

## Cutting a release

The release path is set by the SemVer level (see [`versioning.md`](versioning.md)):

> **⚠ Local correction (pending hub adoption).** The upstream (hub) form of both flows below merged
> into `main` but never brought `main` back to `dev`, so **every release left a merge commit on `main`
> that `dev` never received** — `dev` drifts behind `main`, one commit per release, and any commit made
> directly on `main` (which must never happen anyway) is stranded there. Observed live: `dev` was 32
> commits behind `main`. **Invariant to hold: after every release, `dev` must CONTAIN `main`** — so the
> release ends by fast-forwarding `dev` up to `main`. The corrected commands below do this. This fix is
> proposed back to the hub standard in `notes/fairyfox-reports/2026-07-01-propose-git-workflow-backmerge.md`;
> a scheduled `branch-sync` workflow guards the invariant.

- **PATCH** (the default — fixes, docs, ordinary changes): release **directly** `dev → main`.

  ```sh
  git checkout main
  git merge --no-ff dev
  git push origin main                 # CI (release.yml) derives + creates the vX.Y.Z tag — do NOT tag by hand
  git checkout dev
  git merge --ff-only main             # REQUIRED: catch dev up to main (fast-forward) so dev ⊇ main
  git push origin dev
  ```

- **MINOR / MAJOR** (a milestone): go through a **`release/X.Y.0`** branch. (MAJOR → `1.0.0` etc. is the
  owner's call only.)

  ```sh
  git checkout dev
  git checkout -b release/X.Y.0
  # … finalize: bump VERSION, finish the changelog entry, last polish …
  git checkout main
  git merge --no-ff release/X.Y.0
  git branch -d release/X.Y.0
  git checkout dev
  git merge --ff-only main              # REQUIRED: fast-forward dev up to main (== the release merge)
  git push origin main dev              # CI creates the vX.Y.0 tag — do NOT tag by hand
  ```

  (The old form merged the release branch into `dev` separately, creating a *different* merge commit
  on `dev` than on `main` — leaving `main` one commit ahead of `dev`. Fast-forwarding `dev` to `main`
  instead gives one shared merge commit and `dev == main` after the release.)

A push to `main` that bumped `VERSION` cuts a GitHub Release (`release.yml`, tag-gated) and refreshes
the Pages docs (`pages.yml`). See [`deployment.md`](deployment.md).

## Who creates the tag — CI, not by hand (this repo)

The branch commands above **push `main` without tagging.** This project's
[`release.yml`](deployment.md) derives `v<VERSION>` and creates the tag itself on the `main` push, and
**gates the release on that tag not already existing.** So a tag pushed by hand makes the gated workflow
find the tag present and **skip itself — a silent no-op release.** The rule for this repo is therefore:

- **The merge to `main` is the release act; CI applies the tag.** Never run `git tag` / `git push
  --tags` for a release here.
- The invariant still holds — every commit on `main` ends up carrying its matching `vX.Y.Z` tag — the
  question is only *which actor* applies it, and here it's CI.

(This is a deliberate, recorded divergence from the hub's hand-tag example commands, which assume a
project whose `release.yml` does *not* tag. The hub documents exactly this CI-vs-hand fork.)

## Hotfixes

```sh
git checkout main
git checkout -b hotfix/X.Y.Z
# … fix, bump VERSION (patch), changelog …
git checkout main
git merge --no-ff hotfix/X.Y.Z
git checkout dev
git merge --no-ff hotfix/X.Y.Z
git branch -d hotfix/X.Y.Z
git push origin main dev              # CI creates the vX.Y.Z tag — do NOT tag by hand
```

## Commit style

- Focused, present-tense `type: summary` messages (e.g. `build: migrate to ES modules + Node 24`,
  `chore: add eslint + prettier`, `docs: add notes system`).
- **Stage specific files** (`git add <paths>`), never `git add -A` / `git add .`.
- The changelog entry for a substantive change rides **inside the same commit** (top of
  `notes/version/YYYY-MM.md`) — see [`../version.md`](../version.md).
- Keep `VERSION` **and** `package.json` current as part of the release — bumped on `dev` for a PATCH,
  or on the `release/*` / `hotfix/*` branch for a milestone/hotfix; the release tag on `main` matches
  it. See [`versioning.md`](versioning.md).

## Merging — `--no-ff`, never rewrite

git-flow merges with `--no-ff` (features into `dev`; `release/`/`hotfix/` into both `main` and `dev`;
a PATCH release `dev → main`), each creating a merge commit so the grouping stays legible and revertible.
**Every merge into `main` is a tagged release.** This is all **additive** — it never rewrites history.

## Hard safety rules (absolute)

- Never `git push --force` / `--force-with-lease` / rewrite pushed history. (git-flow's `--no-ff` merge
  commits are additive and allowed — they are not a rewrite.)
- Never `git reset --hard`, `rebase`, `clean -fd`, or delete a **long-lived** branch (`main`/`dev`)
  without an explicit request. Spent `feature/`/`release/`/`hotfix/` branches are deleted as the normal
  end of their merge.
- Inspect `git status` **before and after** every git operation.
- Don't commit user data / runtime artifacts: `user-settings.json`, `results.json`, `output/`,
  `node_modules/` (all gitignored).

## Verify (is it being followed?)

The check that catches a violation — run on request, report `done`/`partial`/`missing`
(the per-standard slice the [compliance audit](compliance.md) aggregates):

| Passes only when… | How to check |
|-------------------|--------------|
| Stable branch is **`main`**, not `master` | `git branch -a` |
| Every commit on `main` is a `--no-ff` **release merge** carrying a matching `vX.Y.Z` tag — no direct commits | `git log --first-parent --oneline main`; `git tag` |
| Pushed history is intact — no force-push / rebase / reset of published commits | history stable across fetches; no `--force` in reflog |
| Spent `feature/`/`release/`/`hotfix/` branches deleted; `main`/`dev` intact | `git branch -a` |
| Each release to `main` rode a green build/test checkpoint | release followed a green CI run |
