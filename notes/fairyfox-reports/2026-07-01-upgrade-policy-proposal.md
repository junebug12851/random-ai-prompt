# Fairyfox process report — proposed hub standard: aggressive dependency upgrades

- **Date:** 2026-07-01
- **Procedure:** propose a new cross-project standard to the fairyfox hub (owner-directed)
- **Node:** random-ai-prompt
- **Scope of this report:** a policy the owner wants **all** fairyfox projects to follow. Per the
  anti-recursion guardrail this report only *proposes* the standard — the owner (or a hub maintainer)
  adds it to `hub/standards/` on the hub repo; nothing here edits the hub.

## The policy

> **Upgrade aggressively. Keep dependencies current, apply updates promptly — including majors — and
> when an upgrade breaks something, FIX it. Fixing an upgrade is cheaper than deferring it.**

Rationale:

- **Deferral compounds.** Skipped majors turn into painful big-bang migrations later; staying current
  keeps each jump small and reviewable.
- **Security + support.** Current deps get security patches and upstream support; stale ones accrue
  silent risk and drop out of support windows.
- **A good test suite makes majors a non-event.** The point of the test gate is exactly this: a major
  bump becomes "run the gate, see what actually breaks," not a leap of faith.

## Evidence (this node, same day)

Ran `npm-check-updates -u` across the whole project and took every dep to latest, including majors:
**react-intl 7 → 10**, **eslint 9 → 10**, **eslint-plugin-formatjs 5 → 6**, **babel-plugin-formatjs 10 → 11**,
vite 8.1, prettier 3.9, playwright, `@formatjs/cli`, etc. The **entire** suite — lint, smoke, 271 unit/web
tests, format check, SPA build, i18n extract/compile, E2E + visual-regression + accessibility, and the
bundle-size budget — passed with **zero breakage**; the only code change required was a one-line reformat.
A 3-major runtime bump (react-intl) landed as routine because the tests proved rendering + behavior held.

## Proposed standard — concrete practices for every node

1. **Dependabot on**, grouped minor/patch, weekly, **targeting the working branch** (e.g. `dev`), so
   update PRs match the project's branch flow instead of piling onto the default branch.
2. **A full, locally-runnable test gate** (lint + unit + integration + build + E2E/visual + perf budget)
   — the thing that makes upgrades verifiable. "Testable locally" is a first-class requirement: CI mirrors
   the local gate, it is not the first place a breakage is discovered.
3. **Apply updates promptly.** Merge Dependabot PRs on the regular cadence; periodically run a full
   `ncu -u` (including majors) and fix whatever the gate flags.
4. **Fix, don't pin-and-forget.** Deferring/pinning an upgrade is allowed **only with a documented
   reason** (e.g. a known-broken upstream release) and a revisit note — never as the silent default.
5. **Bump the version** when an upgrade changes the shipped artifact (PATCH for a routine dep refresh).

## How it went (process honesty)

Smooth. The one rough edge is unrelated to the policy: this repo has no `.gitattributes`, so the Windows
working tree shows large CRLF-only "modified" noise after any formatter run — diagnosed via
`git diff --ignore-space-at-eol --numstat` (5 real-change files out of ~182) and staged only the real
ones. A candidate follow-up hub standard: **add a `.gitattributes` with `* text=auto eol=lf`** to every
node to kill the CRLF noise at the source.

## Recommendation to the hub

Adopt the policy above as a hub standard (`hub/standards/`), and consider the `.gitattributes` normalization
as a companion standard. Owner to carry these to the hub repo — this node cannot and does not edit it.
