---
date: 2026-07-01
procedure: roundup
node: random-ai-prompt
outcome: completed
hub_version: 0.11.0
hub_commit: 2ffe455
---

# Process Report — git-workflow standard defect (release omits main→dev back-merge), 2026-07-01

> A standard-bug report + proposed fix, raised from a live release. The defect is in the
> hub `git-workflow` standard itself, so it affects every node in the mesh, not just this repo.

## Outcome in one line

The release flow in `hub/standards/git-workflow.md` never brings `main` back to `dev`, so `dev` drifts
behind `main` one commit per release; found live (dev 32 behind main), root-caused, corrected locally,
and proposing the standard fix here.

## What was done

Shipped a MINOR release (2.37.0, a large CSS-overhaul + theming feature) from a `feature/*` branch. On
prepping the release I found `dev` was **32 commits behind `main`** (`git rev-list --count
origin/dev..origin/main` = 32; `dev` was a strict ancestor of `main`). Before touching `main` I:
dry-ran the merge (`git merge-tree --write-tree` → clean, exit 0), confirmed no open issues/PRs, merged
`feature → dev`, waited for **dev CI to go green** (CI only runs on `dev`/`main`, so feature branches
are never tested), then released via `release/2.37.0 → main`. To repair the drift I **fast-forwarded
`dev` up to `main`** so they realigned. The release tag + GitHub Release + Netlify deploy all succeeded.

Then, root-cause: `git log --graph main` shows every `Release X.Y.Z` is a `--no-ff` merge commit that
lives on the `main` rail only, and the first-parent spine of `main` also carries many commits authored
**directly on `main`** (docs, badges, CI, lockfiles, visual baselines). Neither ever returned to `dev`.

Local corrections made (this repo): fixed the release procedure in `CLAUDE.md` and
`notes/reference/git-workflow.md` (added the mandatory `dev` fast-forward), and added a scheduled
`.github/workflows/branch-sync.yml` that fails if `main` has commits not in `dev`.

## What went well

- `git merge-tree --write-tree` gave a reliable conflict pre-check before touching `main`.
- The SemVer-path rule (PATCH direct, MINOR via `release/`) and the "CI applies the tag, don't tag by
  hand" guidance were clear and correct.
- `gh run list/view` made the "confirm dev CI green before main" gate easy to honor.

## What went wrong / friction

- **The standard's release flow leaves `dev` behind `main`.** Two variants of the same bug:
  - **PATCH:** `checkout main; merge --no-ff dev; push main; checkout dev` — the `--no-ff` merge commit
    lands on `main` and is never merged back, so `dev` is 1 behind after each PATCH release.
  - **MINOR/MAJOR:** merges the `release/` branch into `main` **and separately** into `dev`, creating
    two *different* merge commits — `main` still has a commit `dev` lacks.
  Over many releases this compounded to `dev` 32 behind `main`.
- **Real content, not just merge commits, was stranded on `main`.** Because commits were also authored
  directly on `main` during release polish (README badges, deploy notes, CI), `dev`'s README/docs were
  silently stale — a separate discipline lapse the "never commit on `main` directly" rule is supposed to
  prevent, but nothing enforced it.
- **A stale-based release almost shipped unnoticed.** My feature branched off the stale `dev`; without
  the pre-merge check I could have merged a 32-commits-behind base onto `main`.
- **Feature branches get zero CI** (CI triggers only on `dev`/`main`), so the first real test of a
  change is the `dev` merge — fine, but worth stating explicitly in the release runbook.

## Suggestions / feedback

Concrete `git-workflow` standard changes (proposed; applied locally already):

1. **End every release by fast-forwarding `dev` to `main`.** Add the invariant *"after any release,
   `dev` must contain `main`."*
   - PATCH: append `git checkout dev && git merge --ff-only main && git push origin dev`.
   - MINOR/MAJOR: after `main` merges the `release/` branch, **replace** the separate
     `git merge --no-ff release/X.Y.0` into `dev` with `git checkout dev && git merge --ff-only main`
     (one shared merge commit; `dev == main` after).
2. **Reinforce "never commit on `main`"** with a concrete note that even release-time docs/badge/CI
   fixes go on `dev` and reach `main` only via the release merge.
3. **Ship a `branch-sync` CI guard as a mesh template** (`git rev-list --count origin/dev..origin/main`
   must be 0; scheduled + `workflow_dispatch`). This catches a skipped back-merge within a day instead of
   at the next release. A copy is now in this repo.
4. Add a one-line note to the release runbook that **feature branches are not CI-tested**; the `dev`
   merge is the first gate, so confirm `dev` CI green before `main` (already implied, worth making
   explicit).

Owner action: apply 1–3 to `hub/standards/git-workflow.md` (and consider a `branch-sync.yml` template in
`hub/templates/`) so the whole mesh gets the fix; I can't push to the hub. The local corrections here are
flagged as "pending hub adoption" and will reconcile on the next sync.

## Environment

Solo maintainer (junebug12851), Windows + PowerShell + git 2.52, GitHub Actions CI (jobs run only on
`dev`/`main`). On arrival `dev` was 32 commits behind `main` (a strict ancestor), the accumulated result
of the release flow above across the 2.6.0 → 2.35.3 releases. `main` is the default + protected-by-
convention branch; `release.yml` derives the tag from `VERSION` on the `main` push.
