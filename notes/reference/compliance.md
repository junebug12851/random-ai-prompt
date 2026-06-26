# Standards Compliance Audit

How to check that this project **actually follows** the fairyfox standards it has
adopted — the enforcement layer. Each adopted standard says (in its own `## Verify`
section) how to tell whether the repo follows it; this audit is the **single
on-request pass that runs every one of those checks at once** and reports the result.
Canonical, project-agnostic source: `assets/references/fairyfox.io/hub/standards/compliance.md`.

See also [`cross-project-sync.md`](cross-project-sync.md) (the read-only, on-request
reads this reuses) and [`process-reports.md`](process-reports.md) (a run can end in a
report).

## Establishment vs. enforcement

- **Established** — the rule is written canonically in `hub/standards/` and *reflected*
  wherever it's used here (this project's `CLAUDE.md`, notes, templates). A standard
  that contradicts the artifacts that operationalize it is drift, not establishment.
- **Enforced** — there's a concrete check that *catches a violation*, run deliberately
  and reported honestly. A rule with no check is a suggestion.

## Relationship to the other checks

- The **onboarding completeness audit** (in the hub's `onboarding-existing-project.md`)
  is the **join-time** gate: is this repo *in the mesh* yet? This project passed it.
- **This audit** is the **recurring, whole-set** check: re-runnable anytime, covering
  *every* adopted standard via its `## Verify` section. "Is it *still* following
  everything?"

## The audit matrix (this project)

Run every row; report each `done` / `partial` / `missing` with the specific gap named.
The detailed pass/fail lives in each standard's `## Verify` section.

| Standard | Enforced by (the check) |
|----------|-------------------------|
| git-workflow | [`git-workflow.md` → Verify](git-workflow.md#verify-is-it-being-followed) — `main` is `--no-ff` tagged releases only; no `master`; history intact |
| versioning | [`versioning.md` → Verify](versioning.md#verify-is-it-being-followed) — `VERSION` is one SemVer line = newest `main` tag; nothing hardcoded |
| notes-system | [`../README.md`](../README.md) — core `notes/` tree present; [`status.md`](../status.md) current; inline changelog in `version/` |
| ai-context | [`../../CLAUDE.md`](../../CLAUDE.md) — has identity · start-here→`status.md` · landmines · build/run · default workflow · notes-maintenance table; workflow matches git-flow |
| cross-project-sync | [`cross-project-sync.md` → anti-recursion checklist](cross-project-sync.md#anti-recursion-checklist) — pulls on-request, read-only, git-ignored, copy-not-link |
| process-reports | [`process-reports.md` → Verify](process-reports.md#verify) — a real report per fairyfox run in `notes/fairyfox-reports/` |
| docs-site | the hub's docs-site compliance checklist — themed site at `fairyfox.io/<key>/` + "← Back to Fairy Fox" way-home link |

## How to run it (on request only)

Gated like every cross-repo read here: an explicit request paired with the intent —
"audit the fairyfox standards", "are the standards being followed", "run a compliance
pass". A bare "check things" doesn't qualify.

1. Run each matrix row against this repo, using that standard's `## Verify` check.
2. Report `done` / `partial` / `missing` per row, naming the exact gap for anything
   not `done`. One `missing` row means the repo is not fully compliant — say which.
3. **Report findings, then stop.** An audit changes nothing on disk.
4. Fix only on go-ahead. A *node* gap is closed here through ordinary work; **hub
   drift** is reported to the owner to fix in the hub repo — this repo never edits the
   hub. A run can end in a [process report](process-reports.md).
