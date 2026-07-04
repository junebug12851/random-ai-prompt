---
date: 2026-07-04
procedure: propose-standard (node → hub suggestion)
node: random-ai-prompt
outcome: proposal-only (hub NOT modified)
---

# Proposal to the fairyfox system — make regression testing a default standard for all projects

> A **node-originated suggestion** for the hub to adopt, written here for the owner to carry upstream.
> Per the anti-recursion / stay-inside-this-repo rules, **the hub repo was not touched.** Acting on this
> at the hub is the owner's separate, manual step.

## One-line ask

Every fairyfox project should have regression testing **set up by default**, and **every bug/issue fix
must ship with a regression test** in the same change — one that fails on the old behavior and passes on
the fix.

## Why (the trigger)

Working on `random-ai-prompt`, the owner asked for a regression test on a UI stacking bug (a mobile
settings-menu backdrop painting over its own menu), then generalized it: *"remember to add regression
tests to every fixed issue,"* *"regression tests should be set up by default,"* and *"include this in a
report to fairyfox system as a recommendation for all projects."*

The value is concrete and repeatable across nodes:

1. **Fixes stay fixed.** A bug with no guard silently returns on the next refactor. A test that
   reproduces the exact symptom makes regressions loud instead of silent.
2. **The test documents the bug.** A `regression: <symptom>` test is the clearest record of what was
   wrong and why the fix matters — better than a changelog line alone.
3. **It generalizes.** Nothing here is `random-ai-prompt`-specific; any node benefits from a standing
   "prove the fix, lock it in" habit. Encoding it once at the hub means each node inherits it instead of
   rediscovering it per-repo (this repo already had the norm in a test-file header, but only because it
   was hand-added).

## Proposed standard (sketch — for the hub to refine)

Suggested name: `hub/standards/regression-testing.md` (or a section in an existing testing/quality
standard). Rough shape:

1. **Default-on infrastructure.** Every project scaffolds a regression home from day one: a dedicated
   suite for logic/unit regressions and, where the project has a UI, an end-to-end lane for
   behavioral/layout/stacking regressions. New repos get this in the template, not as an afterthought.
2. **Every fix ships a test.** Fixing a bug is not "done" until a regression test exists in the **same
   change**. The test must **fail on the pre-fix behavior and pass on the fix** — and that should be
   *demonstrated* (temporarily revert the fix, watch it fail, restore), not assumed.
3. **Right home for the kind of bug.** Logic/data bugs → the unit/regression suite. UI/layout/z-order
   bugs → the E2E suite, written **functionally** (e.g. hit-test with `document.elementFromPoint` for
   stacking order) rather than as brittle pixel baselines where a behavioral assertion will do.
4. **One-liner symptom note.** Each regression test carries a short comment: the original symptom + the
   date/version fixed, so the guard is self-documenting.
5. **Skip the truly trivial.** A one-off cosmetic tweak with no behavior to assert doesn't need a
   contrived test — judgment applies. The rule targets *defects*, not every whitespace change.
6. **Backfill on touch.** When working near an area with a historically-fixed bug that lacks a guard,
   add the missing regression test opportunistically (a full retroactive audit is optional per project).

## Reference implementation (in this repo)

- Logic regressions: `tests/regression/bugRegressions.test.js` — its header already states the rule
  ("When you fix a new bug, add a regression test here…").
- UI/behavioral regressions: `tests/e2e/responsive.spec.js` — inline `test.describe` guards, e.g. the
  palette-scrim click regression and (2026-07-04) the composer settings-gear stacking guard, which was
  proven to fail pre-fix / pass post-fix.
- Agent memory: `regression-test-every-fix` (the standing rule + where each kind of test lives).
- This node is also running a **retroactive audit** to backfill guards for substantive past fixes
  (skipping trivial tweaks) — evidence that the standard is actionable on an existing codebase.

## Guardrails honored

On-request only; no hub pull/push; reference clone untouched; no edit to any other repo. This is a
report for the owner to take to the hub manually.
