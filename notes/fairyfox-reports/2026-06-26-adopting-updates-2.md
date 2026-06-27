---
date: 2026-06-26
procedure: adopting-updates
node: random-ai-prompt
outcome: completed
hub_version: 0.9.2
hub_commit: 42b6ea4
---

# Process Report — adopting-updates, 2026-06-26 (run 2)

> Combined check-and-adopt run. Started as the scheduled "check for updates" flow,
> then the owner green-lit adoption in the same session — so this is **one combined
> report**, not a separate check report plus an adopt report (per the
> process-reports standard adopted in this very run). Second adopting-updates run of
> the day; the earlier `2026-06-26-adopting-updates.md` covered the 2.7.0 split +
> the first process-reports/compliance adoption.

## What was done

1. **Refreshed the hub mirror.** `git pull --ff-only origin dev` aborted (hub `dev`
   force-pushed — the routine case). Used the sanctioned fallback on the
   **git-ignored mirror only**: `git fetch` + `git reset --hard origin/dev`. Mirror
   `42263fe → 42b6ea4`, hub `VERSION 0.9.2`.
2. **Scoped the delta** from the hub `notes/version/2026-06.md` changelog across
   `0.9.0 → 0.9.2` (express authorizations; standards tightened from node feedback;
   a hub-side data/blog pass). Confirmed specific passages with a file diff only
   where needed.
3. **Reported, then waited.** The scheduled check applied nothing and surfaced the
   delta plus two flags (release-tagging conflict; the new pre-authorization).
4. **Owner authorized.** Green-lit adoption and explicitly asked to fix the
   release-tagging flag ("we don't need issues with stuff like this nor … force
   pushing"). The hub's `authorizations.yml` also carries an active standing entry
   (`express-authorization-rollout`) covering the express-auth change set.
5. **Adopted (this run).** See below. Then ran the default verify loop and committed
   on `dev`. No `VERSION` bump — notes/`CLAUDE.md`-only.

## What was adopted

- **Release tagging fixed (flag 1) — the highest-value change.** This repo's
  `release.yml` derives `v<VERSION>` and creates the tag itself, gated on the tag not
  already existing; `deployment.md` already documented that. But `CLAUDE.md` and
  `git-workflow.md` hand-tagged (`git tag … && git push --tags`) in all three release
  paths — which would make the gated workflow find the tag present and **skip the
  release (silent no-op)**. Removed every hand-tag from the PATCH, MINOR/MAJOR, and
  hotfix commands (push `main`/`dev` without `--tags`); added a "Who creates the tag —
  CI, not by hand" section recording it as a deliberate divergence from the hub's
  hand-tag example.
- **Express-authorization ledger** (`adopting-updates` + `cross-project-sync` +
  `templates/CLAUDE.md`): added the pre-authorized-adoption carve-out to `CLAUDE.md`
  and `notes/reference/cross-project-sync.md` (skip *only* the redundant pause; keep
  every other safety step; unattended/scheduled checks still apply nothing), plus the
  anti-recursion bullet and the guardrail rewording.
- **process-reports**: combined-report rule (check→adopt = one report), the
  check-only-on-not-yet-adopted-node inline exception, and the **real-`hub_version`
  anchor** rule (this report uses `0.9.2`, fixing the prior run's placeholder).
- **compliance**: cross-project-sync row reworded to include the ledger read.
- Force-push refresh + VERSION-anchoring were already present in this repo's notes
  from the earlier run; left as-is.

## Files touched

- `CLAUDE.md` — release step 5 (no hand-tag); express-auth exception; guardrail ledger note.
- `notes/reference/git-workflow.md` — three release paths de-tagged; new CI-vs-hand section.
- `notes/reference/cross-project-sync.md` — ledger-read section + anti-recursion bullet.
- `notes/reference/process-reports.md` — combined/inline rules + real-`hub_version` anchor.
- `notes/reference/compliance.md` — cross-project-sync row.
- `notes/fairyfox-reports/` — this report; removed the interim `2026-06-26-check-only.md`
  (folded in here, per the combined-report rule).

## Not adopted / deliberately skipped

- `hub/authorizations.yml` is **not** copied into the tree — it's read-only from the
  clone by design.
- The hub-side `0.9.2` data/blog changes (`_data/*`, `_projects/*`, `_posts/*`,
  `about.md`) are hub bookkeeping, not node standards — nothing to adopt.

## What went well

- The force-push fallback worked first try; the changelog-first scoping made the delta
  clear without wading through noisy file diffs.
- `deployment.md` already describing CI-owned tagging made flag 1 an unambiguous
  doc-consistency fix rather than a judgment call.

## Friction / suggestions for the hub

- **The tagging fork bit this repo.** The hub's hand-tag example commands are wrong for
  any project whose `release.yml` owns the tag — which is this repo's whole design. The
  new CI-vs-hand note is good; consider making the CI-owns-tag path the *primary*
  example (or a prominent callout) since tag-gated release workflows are common, rather
  than a caveat after the hand-tag commands.
- The prior run's placeholder `hub_version` ("see VERSION at run time") is exactly the
  anti-pattern the new rule forbids — it left this run's "last adopted" anchor as a
  force-push-fragile SHA. The new real-number rule is the right fix; worth a one-line
  migration note for nodes carrying an old placeholder.

## Environment

Windows, PowerShell + file tools (per repo rule: no bash sandbox). Node 24. Adoption is
notes/`CLAUDE.md`-only → no `VERSION` bump, PATCH-class docs change, committed on `dev`.
