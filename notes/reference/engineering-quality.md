# Engineering Quality — the standing quality bar

The mesh's standing quality bar: clean, correct, **finished** work — documented and tested, with no
rough-in left for "later". "No hacks, no temporary fixes"; "do the long work"; "best craftsmanship,
always." This project already states the bar in its own words; adopting the standard makes it the
shared, checkable floor rather than folklore.

Canonical, project-agnostic source:
`assets/references/fairyfox.io/hub/standards/engineering-quality.md`. Its companion is proof —
[`../plans/testing.md`](../plans/testing.md) (the test suite) — this note is about the *bar*.

## The rules (and where this project already lives them)

1. **No hacks, no temporary fixes, no bad fallbacks.** Prefer the correct, clean solution even when
   it's the longer route; if the only path is hacky, **surface it and ask** (a stated blocker beats a
   silent workaround). This is [`working-agreements.md`](working-agreements.md) §A2 (build the solution,
   don't offload) applied to *how* the solution is built.
2. **Do the long work — phases, one finished body of work at a time.** A phase that is 90% done is not
   done; when work is deep, plan it across *more* phases, not fewer. Comprehensive-and-right outranks
   soon. Pairs with [`planning.md`](planning.md).
3. **Best craftsmanship, always — proportionate, never absent.** From the smallest DPL helper to the
   provider framework, the work is genuinely well made. Ties to the owner's standing
   [`working-agreements.md`](working-agreements.md) §A4 (prefer the higher-quality option, always).
4. **Clean, modern, modular, focused code.** Small units, clear boundaries, no needless duplication —
   the engine/target split ([`working-agreements.md`](working-agreements.md) §A3, "don't duplicate")
   and the floor-up modular decompositions (Home/SingleView/Manage/listManifest/contentSafety/DPL) are
   this rule in practice.
5. **Full documentation + doc-comments.** Public surfaces carry JSDoc; the notes explain how it's built.
   See [`documentation.md`](documentation.md) (the JSDoc house-style + doc-site) and
   [`docs-lifecycle.md` role in `repo-hygiene.md`](repo-hygiene.md).
6. **Fearless refactoring, behind the test gate** — and **update the tests with the refactor**. This is
   [`working-agreements.md`](working-agreements.md) §B1/§B5 (regression-test every change; don't regress
   quality metrics) plus [`../plans/testing.md`](../plans/testing.md).
7. **Fidelity to the source of truth.** Change only what the task requires. The sharpest case here is
   **never corrupt or lose a user's generated images or `user-settings.json`** (CLAUDE.md Project
   Preferences); the general principle is don't rewrite/normalize/reorder what you weren't asked to.
8. **UX is not negotiable where there's a user.** No clunky/janky/interrupting behaviour — the polished
   result is the bar. This is [`working-agreements.md`](working-agreements.md) §B3 (verify UI by looking)
   and the CLAUDE.md preference: "keep the app feeling like polished software, not a dev tool."

## Verify (is it being followed?)

The per-standard slice the [compliance audit](compliance.md) aggregates — `done`/`partial`/`missing`:

- No hacks / temp-fixes / bad-fallbacks shipped in place of the correct solution (read recent changes;
  no TODO-hack markers or silent workarounds).
- Features land **finished** — built + reviewed + tested + documented — not rough-in for "later".
- Code is clean/modern/modular/focused; public surfaces carry doc-comments; docs are current.
- Refactors came **with test updates**, not test rot.
- Source-of-truth fidelity respected: no incidental rewrites of user data / settings / images.
