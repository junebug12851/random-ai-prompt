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

This matrix aims to list **every standard this project has adopted**. Run every row; report each
`done` / `partial` / `missing` with the specific gap named. The detailed pass/fail lives in each
standard's `## Verify` section where it has one; a few standards are enforced by CI config or a
`CLAUDE.md` standing instruction rather than a note (their row says where).

| Standard | Enforced by (the check) |
|----------|-------------------------|
| git-workflow | [`git-workflow.md` → Verify](git-workflow.md#verify-is-it-being-followed) — `main` is `--no-ff` tagged releases only; no `master`; history intact |
| versioning | [`versioning.md` → Verify](versioning.md#verify-is-it-being-followed) — `VERSION` is one SemVer line = newest `main` tag; nothing hardcoded |
| notes-system | [`../README.md`](../README.md) — core `notes/` tree present; [`status.md`](../status.md) current; inline changelog in `version/` |
| ai-context | [`../../CLAUDE.md`](../../CLAUDE.md) — has identity · start-here→`status.md` · landmines · build/run · default workflow · notes-maintenance table; workflow matches git-flow |
| cross-project-sync | [`cross-project-sync.md` → anti-recursion checklist](cross-project-sync.md#anti-recursion-checklist) — pulls on-request, read-only, git-ignored, copy-not-link; the `authorizations.yml` ledger is read-only and only skips a redundant prompt (never lets the hub act on this node) |
| process-reports | [`process-reports.md` → Verify](process-reports.md#verify) — a real report per fairyfox run in `notes/fairyfox-reports/` |
| docs-site | the hub's docs-site compliance checklist — themed site at `fairyfox.io/<key>/` + "← Back to Fairy Fox" way-home link |
| agent-tooling | [`agent-tooling.md` → Verify](agent-tooling.md#verify-is-it-being-followed) — `CLAUDE.md` names PowerShell + file tools & forbids the bash sandbox; root `.gitattributes` `* text=auto eol=lf`; no CRLF phantom-diff noise |
| engineering-quality | [`engineering-quality.md` → Verify](engineering-quality.md#verify-is-it-being-followed) — no hacks/temp-fixes shipped; features land finished; doc-comments + current docs; refactors carry test updates; user-data fidelity |
| planning | [`planning.md` → Verify](planning.md#verify-is-it-being-followed) — substantive work has a written plan (task list / `notes/plans/`) that predates execution; `CLAUDE.md` Default Workflow states plan-first |
| research-capture | [`research-capture.md` → Verify](research-capture.md#verify-is-it-being-followed) — non-trivial findings get a plain-English `reference/` note; load-bearing conclusions verified with the probe committed; wired into map/status/session/plan |
| working-rhythm | [`working-rhythm.md` → Verify](working-rhythm.md#verify-is-it-being-followed) — multi-step work task-tracked live; runs stay background then surfaced; features briefed before built; ambiguity surfaced up front |
| self-hosted-assets | [`self-hosted-assets.md` → Verify](self-hosted-assets.md#verify-is-it-being-followed) — fonts self-hosted (no `googleapis`/`gstatic`/CDN hot-links in built output); off-origin presentation requests absent; exceptions disclosed in the legal pages |
| coins | [`coins.md` → Verify](coins.md#verify-is-it-being-followed) — docs-site `coins.js` vendored **verbatim** from master (byte-identical), loaded after `reader.js`; gates nothing; store read-merged not reset; `fairyfox:coins:a` disclosed via the same-origin hub `/legal/coins/` |
| dependencies | [`dependencies.md`](dependencies.md) — every runtime/dev dep justified, current majors tracked with breaking-change notes; Dependabot bumps triaged |
| deployment | [`deployment.md`](deployment.md) — CI/Pages/release pipelines match reality (`ci.yml` · `pages.yml` · `release.yml`); tag is CI-derived, not hand-pushed |
| repo-hygiene | [`repo-hygiene.md`](repo-hygiene.md) — `check:docs` (no broken links) · `check:tidy` (nothing untracked) · `check:committed` (tree == HEAD); no branch/PR litter |
| maintenance-sweep | [`maintenance-sweep.md`](maintenance-sweep.md) — the periodic whole-repo cleanup composes git-workflow + repo-hygiene + versioning; run on "full maintenance" |
| testing | [`../plans/testing.md`](../plans/testing.md) — Vitest (Node + jsdom) + Playwright suites green; every fix ships a regression test ([`working-agreements.md`](working-agreements.md) §B1) |
| supply-chain-hardening | CI config, not a note — Scorecard/CodeQL/SonarCloud/Dependabot workflows + `main` branch protection; quality metrics hold or rise ([`working-agreements.md`](working-agreements.md) §B5/§F) |
| legal-docs | `CLAUDE.md` "Keep the Legal Docs Accurate" + [`working-agreements.md`](working-agreements.md) §F — the three self-hosted pages under `targets/web/public/legal/` stay code-accurate; "Last updated" bumped on data-practice changes |
| badges | the README badge block (shields.io + Codecov) reflects the live CI/coverage/security state |

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
