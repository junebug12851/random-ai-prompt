---
date: 2026-07-19
procedure: adopting-updates
node: random-ai-prompt
outcome: completed
hub_version: 0.20.2
hub_commit: 697bc5c
---

# Process Report — adopting-updates, 2026-07-19

> A full, honest account of running a fairyfox system procedure. The point is to
> improve the system — so say what was rough even if the run succeeded. Voice: direct,
> matter-of-fact, no hype. Standard: `hub/standards/process-reports.md`.

## Outcome in one line

Adopted the **six new-and-applicable hub standards** (`engineering-quality`, `planning`,
`research-capture`, `working-rhythm`, `self-hosted-assets`, `agent-tooling`) into this node as
`notes/reference/*.md` adoption notes + CLAUDE.md/compliance/README wiring (notes-only). A **same-run
follow-up** (see the Correction below) then shipped the **coins** counter on the docs chrome — executable
`coins.js` **vendored verbatim** + `coins.css` + a `fairyfox-docs.js` loader — verified in a built docs
site. No `VERSION` bump (docs/notes + docs-theme only). Continues the same-day
`2026-07-19-check-for-updates.md` run.

## What was done

1. Ran the check first (see the sibling check-for-updates report): mirror 0.14.3 → **0.20.2**,
   `authorizations.yml` standing `adopt-standards-by-default` confirmed. Reported the six-standard
   adoptable set; owner's scope call: **adopt all, phased to do it well.**
2. Read the full text of the six hub standards + RAP's `working-agreements.md`, `compliance.md`, and a
   sample reference note for house-style. Verified two asserted facts against the tree: `.gitattributes`
   already carries `* text=auto eol=lf` (agent-tooling compliant), fonts already self-hosted
   (self-hosted-assets compliant).
3. Authored `notes/reference/{engineering-quality,planning,research-capture,working-rhythm,
   self-hosted-assets,agent-tooling}.md`. Each: the rule set in plain English, a pointer to the hub
   canonical, and cross-links to where RAP already lives the rule — written as **adoption notes**, not
   verbatim copies of the project-agnostic standard.
4. Wiring: `CLAUDE.md` Default Workflow **step 0 (plan-before-execute)** + an agent-tooling cross-ref on
   the PowerShell bullet; a compliance-audit-matrix row per standard (→ each note's `## Verify`);
   `notes/README.md` index + folder-map entries under the fairyfox-mesh group.
5. Verification floor (before/after): `npm run check:docs` → 461 links resolve; `prettier --check` on
   every touched file → clean; `npm run smoke` → module graph + all blocks load. The **six-standard
   adoption** was notes-only (no app-code gate to exercise). The **coins follow-up** DID touch executable
   code, so it additionally ran `npm run docs` (site builds; coins files install byte-identical) + a
   browser runtime check on the built site (coin button renders beside "Aa", `+1` on first view, panel
   opens, `FairyFoxCoins` API live, **no console errors**) + `npm run lint` (0 errors). `check:committed`
   + `check:tidy` green on each commit.
6. Changelog entry (`notes/version/2026-07.md`, no-bump `docs` entry) + session log
   (`notes/sessions/2026-07/2026-07-19.md`) written in the same change.

Applied under the standing authorization (skipped only the redundant report-then-wait pause); every
other safety step ran — copy-not-clobber (all six are new files; the CLAUDE.md/README/compliance edits
are additive), full verification before and after, reviewable commit, this report.

### Correction (same run): coins was NOT out of scope

The initial pass filed `coins` under "out of scope for this node" — **wrong**, caught by the owner.
Coins ships as part of the shared docs-site **chrome** (a counter beside the reader "Aa" button), and
RAP's docs site is same-origin under `fairyfox.io/<key>/`, so it shares the hub wallet. RAP had adopted
the chrome/reader at hub 0.14.3 but never included coins; chrome bundle is now 2.2.1. Added it:
`assets/docs-theme/modules/coins.js` (master `coins.js` **vendored verbatim**, byte-identical), injected
after `initReader()` in `fairyfox-docs.js`; `theme/coins.css` on the project tokens; `notes/reference/coins.md`
+ compliance row. Verified the rest of the chrome was already current at 2.2.1 (reader constants + nav
match the master) — coins was the only gap. This is the lesson for the runbook below.

## What went well

The standing `adopt-standards-by-default` grant made the posture unambiguous — no second-guessing
whether adoption needed a fresh go-ahead. Because RAP co-authored much of the standards corpus, the six
mapped cleanly onto existing `working-agreements.md` sections, so the adoption notes could be genuine
"here's how we already satisfy this" rather than aspirational. `check:docs` caught nothing because links
were kept relative from the start.

## What went wrong / friction

- **The six standards were all already lived, just not filed.** Adoption here was documentation +
  cross-referencing, not behaviour change — which is good, but it means the "adopt" act for a
  standards-bearing node is mostly *making the existing compliance legible*, and the runbook doesn't
  distinguish "adopt a new practice" from "file a practice you already follow."
- **Fuzzy diff anchor across a 6-version jump** (carried over from the check report): the shallow mirror
  can't `git diff` 0.12→0.20, and RAP already held content newer than its last check anchor, so
  new-vs-already-held was judged by presence/absence + reading intros, not a mechanical diff.
- **`compliance.md` matrix was already partial** (missing several already-adopted standards, e.g.
  repo-hygiene/testing/dependencies). I added rows for the six new ones but did not backfill the older
  gaps this pass, to keep scope tight — flagging it so a later compliance pass closes them.

## Suggestions / feedback

- A per-standard `since:`/`updated:` stamp (or a `standards/CHANGELOG`) would let a node tell *new* from
  *materially-changed* without a full-tree object diff the shallow mirror can't provide.
- `adopting-updates.md` could note the **"already-practiced, now-filed"** case explicitly: for a
  standards-bearing node, adopting a standard distilled *from its own notes* is a filing/cross-ref act,
  and the report should say so rather than implying a behaviour change that didn't happen.

## Environment

Windows + PowerShell (per `agent-tooling.md` / working-agreements §A1 — no bash sandbox). File tools for
edits. RAP on `dev` at 2.60.1; reference clone read-only + git-ignored at `assets/references/fairyfox.io/`.
Interactive run; scope confirmed by the owner ("adopt all, phased").
