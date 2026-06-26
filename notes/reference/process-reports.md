# Process Reports — the fairyfox feedback loop

This project is a **node in the fairyfox system**. Every time it runs a fairyfox
system procedure — checking for / adopting hub updates (and, in principle, setup or
onboarding) — it ends the run by writing a **process report**: an honest account of
how the run went, what was rough, and what would make the procedure better. The hub
reads those reports (read-only, on request) and uses them to improve the shared
standards. This page is the project-side record; the canonical, project-agnostic
standard lives in the hub clone at
`assets/references/fairyfox.io/hub/standards/process-reports.md`.

See also [`cross-project-sync.md`](cross-project-sync.md) (the read-only, on-request
model these reports ride) and [`compliance.md`](compliance.md) (the audit a report can
also conclude).

## The one rule

**A report is just a note in this repo. It travels the same git-only, read-only,
on-request inbound flow as everything else — this node never pushes a report to the
hub.** The hub *reads* reports out of the read-only shallow clone it keeps of this
repo, exactly when a human or AI asks it to. Writing a report reaches across no repos,
so it triggers nothing downstream — the anti-recursion guarantee is preserved.

```
this node runs a procedure ──> writes report into notes/fairyfox-reports/  (local commit)
                                          │
              (hub pulls this repo's dev into its own assets/references — read-only, on request)
                                          ▼
hub review pass ──> reads new reports ──> improves hub/standards/ on the hub side  (on go-ahead)
```

## When to write one

**Any fairyfox system interaction ends with a report** — including a
**check-and-report-only** run ("I checked the fairyfox system for updates, here's what
I found and where the diff was painful" is exactly the feedback the loop wants, even
when nothing was applied). One run, one report; don't split a procedure across files,
and don't pad a report into existence when there was nothing to run.

For this project the live triggers are the **adopting-updates** / **check-for-updates**
runs (see [`cross-project-sync.md`](cross-project-sync.md)); setup and onboarding
already happened.

## Where reports live and how they're named

In this repo's own tree (committed here, unlike the git-ignored `assets/references/`
clones):

```
notes/
  fairyfox-reports/
    README.md                        ← what this folder is
    YYYY-MM-DD-<procedure>.md        ← one file per run, newest by date
```

Name by **date + procedure**: `2026-06-26-adopting-updates.md`, `…-onboarding.md`,
`…-setup.md`, `…-check-only.md`. Two runs of the same procedure in one day → suffix
`-2`.

## What goes in a report

Start from the template — `assets/references/fairyfox.io/hub/templates/fairyfox-report.md`.
The shape, in short:

- **Header / front matter** — date, the procedure run, the node, the outcome in one
  line (`completed` · `partial` · `checked-only` · `aborted`), and the hub
  version/commit the run was against.
- **What was done** — the actual path taken, at a useful grain; note any deviation
  from the runbook and why.
- **What went well** — what was clear and worked first try (so it doesn't get
  "improved" away).
- **What went wrong / friction** — the heart of the report: ambiguous steps, dead
  ends, commands that failed, places the standard didn't match this repo. Be specific;
  a vague report can't be acted on.
- **Suggestions / feedback** — concrete proposed changes to the procedure, standard,
  template, or wording, tied to a friction point.
- **Environment** — anything about this repo/run that shaped the experience (stack,
  OS/shell, hand-authored vs generated docs, branch model on arrival).

Write it in the notes voice: direct, matter-of-fact, honest over flattering.

## How the hub consumes reports

The **inbound** side runs from the hub, on explicit request only: it refreshes its
read-only clone of this repo, reads reports written since its last review, looks across
nodes for **patterns**, reports findings, and — only on go-ahead — improves the
**hub's own** `hub/standards/`. The hub never edits this node to "close out" a report;
this node picks up improvements later through ordinary adoption.

## Verify

- This repo has a `notes/fairyfox-reports/` folder and each run's report is in it,
  committed to this tree (not left in `assets/references/`).
- Each report names the procedure, the outcome, and the hub version/commit it ran
  against, and its friction/suggestions sections are real (not "all good").
