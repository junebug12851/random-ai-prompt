# Maintenance Sweep — the periodic full-repo cleanup runbook

A **maintenance sweep** is a periodic, whole-repo tidy that gets the project back to a clean,
consistent, shipped baseline: no stray branches, nothing waiting in PR limbo, docs/notes/README that
match the code, and a green release on `main`. It is the "close the books" pass you run after a burst of
feature work has left branches, PRs, and current-state docs drifting from reality.

This is a **project runbook** — it is the local, `random-ai-prompt`-specific record of a procedure this
node also **proposed to the fairyfox hub** for cross-project adoption
(see [`../fairyfox-reports/2026-07-09-propose-maintenance-sweep-standard.md`](../fairyfox-reports/2026-07-09-propose-maintenance-sweep-standard.md)).
It composes existing standards rather than inventing new rules: it leans on
[`git-workflow.md`](git-workflow.md) (branch model + ship path), [`repo-hygiene.md`](repo-hygiene.md)
(tidy/doc guards), [`versioning.md`](versioning.md), and the "Maintaining the Notes" +
"Keep the Legal Docs Accurate" standing instructions in `CLAUDE.md`.

## When to run it

- On request ("full maintenance / clean things up / full sweep").
- After merging several feature branches, when the branch list and current-state docs have drifted.
- Before or right after a release, to make sure `dev` and `main` are in sync and nothing is orphaned.
- On a cadence (e.g. monthly) as a standing hygiene pass.

It is **not** a substitute for the per-change discipline (each change still updates its own docs, notes,
and tests). The sweep catches what slipped through and reconciles the whole tree at once.

## The procedure

Run everything from the repo root. On this Windows machine, use **PowerShell** (not the Cowork bash
sandbox — it has reported false file truncations; see [`fix-patterns.md`](fix-patterns.md)).

### 1. Audit the git + GitHub state (read-only first)

```sh
git fetch --all --prune
git branch -vv                       # local branches + tracking
git branch -r                        # remote branches
git branch --no-merged dev           # LOCAL branches with unmerged work
git branch -r --no-merged origin/dev # REMOTE branches with unmerged work
gh pr list --state open
gh issue list --state open
gh run list --branch dev -L 3        # CI health
```

The goal is a complete picture **before touching anything**: which branches are fully merged (safe to
delete), which carry unmerged work (must be surfaced, never silently dropped), and what is open on
GitHub.

### 2. Triage open PRs and issues — surface, don't auto-act

Per the "GitHub Is Part of Default Management" standing instruction, **never** merge, close, or push to a
PR without an explicit go-ahead. For each open PR/issue, summarize it and ask what to do
(merge / close / leave). A Dependabot PR is still a decision: merging adopts new dependency versions;
closing discards them. Get the owner's call, then act on the answer. If unattended, report and wait.

### 3. Close merged feature branches (local + remote)

Only after confirming they are fully merged (step 1). Deleting a branch with unmerged commits loses work.

```sh
git branch -d <merged-branch> ...            # -d refuses an unmerged branch (safety)
git push origin --delete <merged-remote> ... # remote
```

Target end state: **only `main` and `dev` on both the local checkout and GitHub** (plus any branch the
owner explicitly wants to keep, and short-lived `release/*`/`hotfix/*` in flight).

### 4. Ship `dev` → `main` (if the owner wants a release)

Follow [`git-workflow.md`](git-workflow.md) exactly — this runbook does not replace it:

- Confirm `dev` is green (`gh run list --branch dev -L 1`).
- Keep `VERSION` + `package.json` in sync; bump per SemVer level **only if** the change warrants it.
  Docs/notes/test/CI-only changes (including a dev-dependency-only bump) **do not move the number** —
  in that case `main` simply advances with no new tag, which is correct.
- PATCH: PR `dev → main`; MINOR/MAJOR: via a `release/X.Y.0` branch. Merge with `gh pr merge <#> --merge`
  (a merge commit — never squash/rebase). Do **not** hand-tag; `release.yml` derives and applies the tag.
- **After the merge, back-merge so `dev` contains `main`:**
  `git fetch origin && git switch dev && git merge --ff-only origin/main && git push origin dev`.
  Skipping this is what once left `dev` many commits behind `main`.

### 5. Doc / notes / README consistency sweep

Reconcile every current-state surface with the code as it actually is now:

- **`notes/status.md`** — the biggest drift magnet. Fix the `VERSION` line, retire "pending
  review/release" phrasing for branches that have shipped, and refresh the Build/run-health and
  Open-issues tables with **real, just-run numbers** (don't copy stale ones).
- **`README.md`** — features, editions, install paths, and version-driven badges accurate.
- **Changelog / sessions** — confirm the feature history the sweep is trimming from `status.md` is
  preserved in `notes/version/YYYY-MM.md`; append a session entry for the sweep itself.
- **`list-credits.md`** and the three **legal pages** (`targets/web/public/legal/`) — per their standing
  instructions, update if any data practice or credited contribution changed (a pure cleanup usually
  touches neither — confirm rather than assume).
- **Renamed/removed refs** — `git grep -n "<old-name>" -- "*.md"` for stale prose;
  `npm run check:docs` for broken links.

### 6. Verify — before *and* after

```sh
npm test          # check:docs · lint · smoke · test:unit · test:web (the headless gate)
npm run check:tidy # no untracked, non-ignored files left behind
```

For deeper changes also run `npm run test:all` (adds Playwright E2E/visual/perf). Record the actual pass
numbers in `status.md`. Only claim a check passed if you ran it this sweep; mark CI-only checks as such.

### 7. Commit + record

- Stage explicit paths (never `git add -A`), focused `type: summary` commits, changelog entry in the
  **same commit** (per "Maintaining the Notes").
- Append a `notes/sessions/YYYY-MM/YYYY-MM-DD.md` entry for the sweep.
- If the sweep was run as a fairyfox procedure, write the process report
  (`notes/fairyfox-reports/`, per [`process-reports.md`](process-reports.md)).

## Safety rules (absolute)

- **Never delete a branch with unmerged commits.** `git branch -d` (not `-D`) is the guard; verify with
  `--no-merged` first.
- **Never auto-act on a PR/issue** (merge/close/push) without an explicit go-ahead.
- **Never** `push --force`, rewrite pushed history, `reset --hard`, or delete `main`/`dev`.
- Inspect `git status` before and after. Full standards: [`git-workflow.md`](git-workflow.md).

## Verify

- `git branch -r` and `git branch` show only `main`, `dev` (+ any deliberately-kept branch).
- `gh pr list --state open` is empty or every entry is one the owner chose to keep.
- `dev` contains `main` (`git merge --ff-only origin/main` on `dev` is a no-op).
- `npm test` and `npm run check:tidy` are green; `status.md` numbers match the run.
- `notes/status.md` `VERSION` line equals the repo-root `VERSION`.
