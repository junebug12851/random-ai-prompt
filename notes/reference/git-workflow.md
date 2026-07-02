# Git Workflow

This project follows the fairyfox system's **git-flow** standard (the branching model, not the
`git flow` CLI — plain `git` carries it). These are procedures the AI upholds by judgement, not
automation. Canonical source: `hub/standards/git-workflow.md` in the system clone.

## Branch model

git-flow runs **two long-lived branches** and **three kinds of short-lived support branch**.

- **`main`** — production. Every commit on `main` is a **tagged release**, reached only by a **merge
  commit** (the `--no-ff` equivalent). **Never commit directly** — as of 2026-07-02 `main` is
  **branch-protected** and only accepts changes through a **pull request** (see "`main` is
  branch-protected" below), so the release path runs through a PR rather than a local push. It advances
  at a release: a **PATCH** goes from `dev`; a **MINOR/MAJOR** goes through a `release/*` branch; an
  urgent fix goes through a `hotfix/*` branch. `main` is the repo's stable branch and default branch.
  (`master` was renamed to `main` on 2026-06-25 to adopt the system standard — `master` is no longer
  used.)
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

## `main` is branch-protected (as of 2026-07-02)

`main` carries a GitHub branch-protection rule, so releases run **through a pull request**, not a local
`git push origin main`. The rule:

- **Require a pull request before merging**, with **0 required approvals** — this is a solo project, so
  there's no second reviewer; you open the PR and merge it yourself once checks pass. (GitHub won't let
  you approve your own PR, so requiring ≥1 approval would deadlock — hence 0.)
- **Require status checks to pass**, **strict** (branch up to date): `Lint, format, smoke & unit tests`
  and `Build & unit-test the SPA` (the two core CI jobs; the heavier E2E/perf jobs are intentionally
  not gating, so a flake there never blocks a release).
- **Enforce for administrators** — the owner is **not** exempt (a rule you can bypass isn't protection).
- **Block force-pushes and branch deletion**; **require conversation resolution**.
- **Linear history is OFF** on purpose, so the `--no-ff`-style **merge commits** each release creates
  are allowed.

Managed via `gh api PUT /repos/junebug12851/random-ai-prompt/branches/main/protection`; fully
reversible from **Settings → Branches**. `dev` is **unprotected** (day-to-day work + the release
back-merge push land there directly). This is a local divergence from the hub git-workflow standard,
proposed back in `notes/fairyfox-reports/2026-07-02-propose-scorecard-hardening.md`.

## Cutting a release

The release path is set by the SemVer level (see [`versioning.md`](versioning.md)). Because `main` is
branch-protected, each path lands on `main` via a **PR merge** (`gh pr merge … --merge`, which creates
the release merge commit) instead of a direct push.

> **⚠ Local correction (pending hub adoption).** The upstream (hub) form of these flows merged into
> `main` but never brought `main` back to `dev`, so **every release left a merge commit on `main` that
> `dev` never received** — `dev` drifts behind `main`, one commit per release. Observed live: `dev` was
> 32 commits behind `main`. **Invariant to hold: after every release, `dev` must CONTAIN `main`** — so
> the release ends by fast-forwarding `dev` up to `main`. The corrected commands below do this. Proposed
> back to the hub in `notes/fairyfox-reports/2026-07-01-propose-git-workflow-backmerge.md`; a scheduled
> `branch-sync` workflow guards the invariant.

- **PATCH** (the default — fixes, docs, ordinary changes): release `dev → main` via a PR.

  ```sh
  gh pr create --base main --head dev --title "Release vX.Y.Z" --fill
  gh pr checks <#> --watch             # the required CI checks must go green
  gh pr merge  <#> --merge             # merge commit == the release act; CI (release.yml) tags vX.Y.Z — do NOT tag by hand
  git fetch origin
  git switch dev
  git merge --ff-only origin/main      # REQUIRED: catch dev up to main so dev ⊇ main
  git push origin dev                  # dev is unprotected — this push is fine
  ```

- **MINOR / MAJOR** (a milestone): go through a **`release/X.Y.0`** branch. (MAJOR → `1.0.0` etc. is the
  owner's call only.)

  ```sh
  git switch dev
  git switch -c release/X.Y.0
  # … finalize: bump VERSION, finish the changelog entry, last polish …
  git push origin release/X.Y.0
  gh pr create --base main --head release/X.Y.0 --title "Release vX.Y.0" --fill
  gh pr checks <#> --watch
  gh pr merge  <#> --merge --delete-branch   # merge commit tags vX.Y.0; deletes the release branch
  git fetch origin
  git switch dev
  git merge --ff-only origin/main            # REQUIRED: fast-forward dev up to main (== the release merge)
  git push origin dev
  ```

  (Fast-forwarding `dev` to `main` gives one shared merge commit and `dev == main` after the release —
  never merge the release branch into `dev` separately.)

Merging the release PR into `main` after a `VERSION` bump cuts a GitHub Release (`release.yml`,
tag-gated) and refreshes the Pages docs (`pages.yml`). See [`deployment.md`](deployment.md).

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
git fetch origin
git switch -c hotfix/X.Y.Z origin/main   # branch from main's tip
# … fix, bump VERSION (patch), changelog …
git push origin hotfix/X.Y.Z
gh pr create --base main --head hotfix/X.Y.Z --title "Hotfix vX.Y.Z" --fill
gh pr checks <#> --watch
gh pr merge  <#> --merge --delete-branch  # merge commit tags vX.Y.Z — do NOT tag by hand
git fetch origin
git switch dev
git merge --ff-only origin/main           # catch dev up to main (carries the hotfix) so dev ⊇ main
git push origin dev
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

git-flow merges create a **merge commit** (the `--no-ff` effect): features merge `--no-ff` into `dev`
locally; every landing on `main` (a PATCH `dev → main`, or a `release/`/`hotfix/` branch) goes through a
**PR merged with `gh pr merge --merge`**, then `dev` fast-forwards up to `main`. Each keeps the grouping
legible and revertible. **Every merge into `main` is a tagged release.** This is all **additive** — it
never rewrites history (and force-pushes to `main` are now blocked by branch protection).

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
