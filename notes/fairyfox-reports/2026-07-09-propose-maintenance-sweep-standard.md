---
date: 2026-07-09
procedure: propose-standard (node → hub suggestion)
node: random-ai-prompt
outcome: proposal-only (hub NOT modified)
---

# Proposal to the fairyfox system — make the "maintenance sweep" a default standard for all projects

> A **node-originated suggestion** for the hub to adopt, written here for the owner to carry upstream.
> Per the anti-recursion / stay-inside-this-repo rules, **the hub repo was not touched.** Acting on this
> at the hub is the owner's separate, manual step.

## One-line ask

Every fairyfox project should have a documented, repeatable **maintenance sweep** — a periodic
whole-repo tidy that returns the repo to a clean shipped baseline (no stray branches, no PR limbo,
docs/notes/README matching the code, `dev` and `main` in sync and green) — set up as a hub standard so
each node inherits the same procedure and safety rules instead of improvising one per repo.

## Why (the trigger)

Working on `random-ai-prompt`, the owner asked for a broad cleanup: *"make sure all feature branches are
closed here and on GitHub, make sure dev is shipped to main and that both branches are up to date, do
full maintenance, make sure there aren't any docs or notes or code inconsistencies… full sweep type
thing,"* then generalized it: *"create a maintenance procedure thing and report it to fairyfox for a
hub-wide adoption."*

Running that sweep surfaced exactly the kind of drift a standing procedure prevents:

1. **Branch litter accreted.** Six local `feature/*` branches (all already merged) and two remote feature
   branches lingered after their PRs merged; a Dependabot PR sat open. With no routine, this only gets
   cleaned when someone notices.
2. **Current-state docs drifted badly.** `notes/status.md` still declared `Version: 2.46.0` (actual
   `2.51.1`), described shipped-and-merged branches as "pending review," and carried a stale build-health
   table (18 lint warnings, 128/60 test counts) that the real gate now reports as 0 warnings and 319/419
   tests. Nothing was *wrong with the code* — the **map had gone stale**, which is precisely what a
   periodic reconciliation catches.
3. **The steps are risky if improvised.** Deleting branches, merging PRs, and shipping to `main` are all
   destructive-adjacent. A written runbook with hard safety rules (verify-merged-before-delete,
   never-auto-act-on-PRs, back-merge-so-dev-contains-main) makes the sweep safe to repeat.
4. **It generalizes.** None of this is `random-ai-prompt`-specific. Any node with a `dev`/`main` model,
   a notes system, and CI benefits from the same "close the books" pass. Encoding it once at the hub
   means each node inherits it.

## Proposed standard (sketch — for the hub to refine)

Suggested name: `hub/standards/maintenance-sweep.md`. It should **compose existing standards, not
duplicate them** — it references git-workflow, repo-hygiene, versioning, and the notes/legal-docs
standing instructions rather than restating their rules. Rough shape:

1. **Audit read-only first.** Fetch/prune, then enumerate local + remote branches, `--no-merged` on both,
   open PRs/issues, and CI health — a complete picture before touching anything.
2. **Triage PRs/issues: surface, don't auto-act.** Every open item is a decision for the owner
   (merge/close/leave). Dependabot PRs included. Unattended runs report and wait.
3. **Close merged branches only.** `-d` (never `-D`) as the guard; confirm merged via `--no-merged`
   first. Target end state: only `main` + `dev` (plus deliberately-kept / in-flight release branches).
4. **Ship `dev` → `main` per the existing git-workflow standard** — including the SemVer gate (docs/notes/
   test/dev-dep-only changes don't move the version) and the mandatory **back-merge so `dev` contains
   `main`** afterward.
5. **Reconcile current-state docs with the code.** `status.md` (version line, "pending" phrasing,
   health/issue tables with *freshly-run* numbers), README, changelog/sessions, credits, legal pages,
   and a stale-reference grep + link check.
6. **Verify before and after.** The project's headless gate + a tidy check; record real pass numbers;
   only claim what was actually run this sweep.
7. **Record.** Focused commits with in-commit changelog entries, a session-log entry, and — when run as
   a fairyfox procedure — a process report.

### Safety rules to bake in

- Never delete a branch with unmerged commits (`-d` guard + `--no-merged` verification).
- Never merge/close/push a PR without explicit go-ahead.
- Never force-push, rewrite pushed history, `reset --hard`, or delete `main`/`dev`.
- Inspect `git status` before and after.

## Reference implementation (in this repo)

- Runbook: [`../reference/maintenance-sweep.md`](../reference/maintenance-sweep.md) — the full
  project-side procedure, cross-linked to git-workflow, repo-hygiene, versioning, and process-reports.
- First run of it (2026-07-09): merged Dependabot PR #43 (owner-approved), deleted 8 merged feature
  branches (6 local + 2 remote) down to `main` + `dev` on both ends, refreshed `notes/status.md`, and
  shipped `dev` → `main`. Documented in that day's session log and changelog.

## Guardrails honored

On-request only; no hub pull/push; reference clone untouched; no edit to any other repo. This is a
report for the owner to take to the hub manually.
