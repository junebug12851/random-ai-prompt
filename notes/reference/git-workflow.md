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

- **PATCH** (the default — fixes, docs, ordinary changes): release **directly** `dev → main`.

  ```sh
  git checkout main
  git merge --no-ff dev
  git tag -a vX.Y.Z -m "vX.Y.Z"        # tag matches VERSION
  git push origin main --tags
  git checkout dev
  ```

- **MINOR / MAJOR** (a milestone): go through a **`release/X.Y.0`** branch. (MAJOR → `1.0.0` etc. is the
  owner's call only.)

  ```sh
  git checkout dev
  git checkout -b release/X.Y.0
  # … finalize: bump VERSION, finish the changelog entry, last polish …
  git checkout main
  git merge --no-ff release/X.Y.0
  git tag -a vX.Y.0 -m "vX.Y.0"
  git checkout dev
  git merge --no-ff release/X.Y.0       # carry the release finalizations back
  git branch -d release/X.Y.0
  git push origin main dev --tags
  ```

A push to `main` that bumped `VERSION` cuts a GitHub Release (`release.yml`, tag-gated) and refreshes
the Pages docs (`pages.yml`). See [`deployment.md`](deployment.md).

## Hotfixes

```sh
git checkout main
git checkout -b hotfix/X.Y.Z
# … fix, bump VERSION (patch), changelog …
git checkout main
git merge --no-ff hotfix/X.Y.Z
git tag -a vX.Y.Z -m "vX.Y.Z"
git checkout dev
git merge --no-ff hotfix/X.Y.Z
git branch -d hotfix/X.Y.Z
git push origin main dev --tags
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
