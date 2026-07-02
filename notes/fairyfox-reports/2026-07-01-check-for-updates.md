---
date: 2026-07-01
procedure: check-only
node: random-ai-prompt
outcome: checked-only
hub_version: 0.11.0
hub_commit: 2ffe455
---

# Process Report — check-for-updates (check-only), 2026-07-01

> A full, honest account of running a fairyfox system procedure. The point is to
> improve the system — so say what was rough even if the run succeeded. Voice: direct,
> matter-of-fact, no hype. Standard: `hub/standards/process-reports.md`.

## Outcome in one line

Scheduled check-only run: the hub jumped 0.9.14 → **0.11.0** (the `feature/one-site-frontend`
merge). Most commits are hub-website/registry content, but this span **does** change the
shared standards — **two brand-new standards (`deployment`, `planning`)** plus wording
changes across `adopting-updates`, `cross-project-sync`, `compliance`, `ai-context`,
`process-reports`, the docs-site set, and the `templates/CLAUDE.md` + `project.gitignore`
templates. Nothing applied (scheduled check → report-and-wait regardless of the ledger).

## What was done

1. Refreshed the read-only hub mirror with the runbook's step-1 command as CLAUDE.md
   still specifies it: `git -C assets/references/fairyfox.io pull --depth 1 --ff-only
   origin dev`. It aborted with `Not possible to fast-forward` /
   `+ 0fb30be...2ffe455 dev (forced update)`.
2. Recovered per the project CLAUDE.md fallback: `git fetch --depth 1 origin dev` +
   `git reset --hard origin/dev` on the **git-ignored reference clone only**. Mirror
   advanced 0fb30be → 2ffe455 (HEAD "Merge feature/one-site-frontend into dev (0.11.0)").
3. Diffed `0fb30be..2ffe455` scoped to `hub/standards/` and `hub/templates/`, then
   read the full contents of the two new standards and the diffs of every changed
   standard/template a node reconciles.
4. Read `hub/authorizations.yml` (one active standing entry — `express-authorization-rollout`,
   covers cross-project-sync + adopting-updates + authorizations.yml + templates/CLAUDE.md
   mesh block) and `hub/.last-seen.yml` for context.
5. Assessed what adoption would touch by grepping this repo's own `CLAUDE.md` and
   `notes/` for plan-before-execute, the deployment policy, and the sync-fallback wording.
6. Glanced at this repo's own working tree (guardrail for check-only runs): on `dev`,
   clean except two untracked prior-run report files (2026-06-29, 2026-06-30); the hub
   mirror is confirmed git-ignored. **Nothing applied, nothing committed.**

## What changed in the hub (0.9.14 → 0.11.0), node-facing only

New standards:
- **`deployment.md`** — static content → GitHub Pages on the shared domain
  (`fairyfox.io/<key>/`); built/runnable apps → Netlify on their own host. **Random AI
  Prompt is named as the Netlify-app example.** Includes the fairyfox-games Pages
  exception and a `## Verify`.
- **`planning.md`** — plan-before-execute: for non-trivial work, write a short
  structured plan in `notes/plans/` first, then execute. Trivial one-step changes exempt.

Changed standards/templates:
- **`adopting-updates.md` / `cross-project-sync.md`** — drop the "full-history vs
  shallow" framing; the mirror is now "an ordinary single-branch clone." The old
  `reset --hard` / `--unshallow` recovery is **removed** and replaced by "just delete
  and re-clone the disposable mirror."
- **`ai-context.md` / `templates/CLAUDE.md`** — the Default Workflow now opens with
  plan-before-execute (links the new planning standard).
- **`templates/project.gitignore`** — comment changed "shallow clones" → "clones."
- **`compliance.md`** — audit matrix gains **deployment** and **planning** rows.
- **`process-reports.md`** — inbound refresh wording simplified (ordinary clone;
  delete + re-clone on failure).
- **`docs-site/*`** (01, 04, 05, 06, 08, 11, reference README/main.css, new
  `reference/chrome.html`) — the "one seamless site" model: shared chrome, submenu,
  brand/Home as way-home. Relevant only if RAP re-themes its JSDoc doc-site.

## What went well

- The diff scoped cleanly to `hub/standards/` + `hub/templates/`; the version-tagged
  merge commit made the span obvious.
- The reference clone stayed git-ignored throughout; the recovery touched only the
  disposable mirror. Own repo history never touched.

## What went wrong / friction

- **Force-push abort, second run running.** CLAUDE.md's step-1 command still uses
  `--depth 1` and `--ff-only`, which aborted with a `(forced update)` on the shallow
  mirror. I recovered with `reset --hard` per the project's current adopted wording —
  but the **hub has now moved the standard twice past that**: 0.11.0 says the mirror
  should be an ordinary full-history clone AND that the recovery is delete + re-clone,
  not `reset --hard`. So this repo's adopted sync wording (and the `--depth 1` command
  in CLAUDE.md) is now two revisions stale, and the friction reproduces every run.
- The project already has a `notes/reference/deployment.md`, but it's the project's own
  CI/release note, **not** the new shared deployment standard — a name collision to
  resolve when adopting (reconcile vs. add a separate note).

## Suggestions / feedback

- **Owner directive: there should be NO force-pushing on any repo in the system —
  including the hub.** This run observed the hub (`junebug12851.github.io`) `dev` being
  force-pushed again (`0fb30be...2ffe455 dev (forced update)`), which directly violates
  the mesh's own hard rule that `dev` is append-only and nothing force-pushes it
  (`git-workflow.md`, restated in the 0.11.0 sync standards). The node handled it safely
  (recovery hit only the git-ignored mirror), but the root cause is hub-side: the hub's
  `dev` must stop being force-pushed. **This is a change for the owner to make at the hub
  — not in this repo.** Until it stops, every scheduled check here trips the same abort.
- When the owner green-lights adoption, fold the sync correction **first**: replace the
  `--depth 1` step-1 command and the `reset --hard` fallback in both `CLAUDE.md` and
  `notes/reference/cross-project-sync.md` with the ordinary-clone + delete/re-clone
  model. That removes the recurring force-push friction.
- The two new standards land naturally: planning → add a plan-before-execute line to the
  Default Workflow (CLAUDE.md already keeps plans under `notes/plans/`); deployment →
  reconcile the shared policy into a note and confirm the registry URL, noting RAP is
  the canonical Netlify example.

## What adopting would touch (for the owner — not yet applied)

- `engine-v3/CLAUDE.md` (root) — Default Workflow: add plan-before-execute; fix the
  step-1 mirror command and the `reset --hard` fallback wording.
- `notes/reference/cross-project-sync.md` — ordinary-clone + delete/re-clone rewrite.
- A planning note under `notes/plans/` (or a short reference) + a `notes/` deployment
  reconciliation (distinct from the existing CI `deployment.md`).
- Possibly `notes/reference/documentation.md` / the JSDoc theming if RAP adopts the
  docs-site "one seamless site" changes (larger, lower urgency).
- **Hub-side (report only, do NOT edit):** confirm RAP's `registry.yml` / `_data/projects.yml`
  URL matches the deployment standard — that's a change for the owner to make at the hub.

## Environment

Windows / PowerShell (per project rule — no bash sandbox). Node 24 repo, engine-v3
active. Own repo on `dev`, clean but for two untracked prior fairyfox reports. Hub mirror
`assets/references/fairyfox.io` git-ignored; `dev` force-pushed again this run (recovered
on the mirror only). This is a scheduled/unattended run: applies nothing regardless of the
express-authorization ledger.
