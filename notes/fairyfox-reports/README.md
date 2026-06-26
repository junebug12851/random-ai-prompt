# fairyfox-reports/

Process reports for this node — one file per run of a **fairyfox system procedure**
(setup, onboarding, adopting updates, or a check-for-updates pass). Each report is a
full, honest account of how the run went: what was done, what went well, what was
rough, and concrete suggestions to improve the procedure.

These are this repo's **own** record — committed here, unlike the git-ignored
`assets/references/` clones. The hub reads them on request through its read-only
inbound clone and uses the feedback to improve the shared standards; this repo never
pushes anything to the hub.

- One file per run: `YYYY-MM-DD-<procedure>.md` (e.g. `2026-06-26-adopting-updates.md`;
  suffix `-2` if two runs of the same procedure land in one day).
- Start from the template in the hub clone: `hub/templates/fairyfox-report.md`.
- The standard, adopted into this project: [`../reference/process-reports.md`](../reference/process-reports.md)
  (canonical source: `hub/standards/process-reports.md` in the system clone).

Write reports in the notes voice — direct, matter-of-fact, honest over flattering. A
report that hides the rough parts defeats its only purpose.
