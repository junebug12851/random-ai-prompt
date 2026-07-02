---
date: 2026-06-29
procedure: adopting-updates
node: random-ai-prompt
outcome: checked-only
hub_version: 0.9.9
hub_commit: bbf9b70
---

# Process Report — adopting-updates (check-only), 2026-06-29

> A full, honest account of running a fairyfox system procedure. The point is to
> improve the system — so say what was rough even if the run succeeded. Voice: direct,
> matter-of-fact, no hype. Standard: `hub/standards/process-reports.md`.

## Outcome in one line

Check-only scheduled run: the hub moved 0.9.6 → 0.9.9 with refinements to three
standards (`adopting-updates.md`, `git-workflow.md`, `process-reports.md`); reported
what adopting would touch and stopped. Nothing applied. The still-unadopted 0.9.6
force-push/shallow-mirror correction (flagged 2026-06-28) remains outstanding and is
now reinforced by the 0.9.9 wording.

## What was done

1. Refreshed the read-only hub mirror with the runbook's step-1 command as CLAUDE.md
   still specifies it: `git -C assets/references/fairyfox.io pull --depth 1 --ff-only
   origin dev`. It aborted (`Not possible to fast-forward`, `+ 300b8ab...bbf9b70 dev
   (forced update)`). Per the current CLAUDE.md fallback, ran `git fetch --depth 1
   origin dev` + `git reset --hard origin/dev` on the reference clone only. Mirror is
   now at `bbf9b70` (0.9.9). (See friction — this fallback is the very thing 0.9.6+
   now says is the wrong diagnosis.)
2. Diffed `hub/standards/` and `hub/templates/` 300b8ab→bbf9b70. Only three standards
   files changed; no template changed.
3. Grepped the project's adopted mirrors of those standards (CLAUDE.md,
   `notes/reference/cross-project-sync.md`, `git-workflow.md`, `process-reports.md`,
   `compliance.md`) to determine what is already present vs. what adopting would add.
4. Glanced at the node's own working tree (new 0.9.9 check step): branch `dev`, clean
   (`git status -s` empty), no mid-merge / detached HEAD / unpushed divergence. The
   long-standing CRLF working-tree noise was not present this run.
5. Wrote this report. Applied nothing — awaiting owner go-ahead.

## What changed in the hub (0.9.6 → 0.9.9)

- **`adopting-updates.md`** — (a) adds a new check-flow step "Glance at the node's own
  working tree" to catch trouble unrelated to the hub (mid-merge, conflicts, detached
  HEAD, large unpushed divergence), surfaced in the report but never acted on; steps
  renumbered to 5. (b) Adds a "Carrying pre-0.9.6 wording?" callout telling nodes whose
  adopted runbook still says `dev` is force-pushed and to `reset --hard` every refresh
  to re-adopt the corrected step (plain `fetch` + `--ff-only`; treat an abort as a
  stale shallow clone to `--unshallow`/re-clone, not a force-push to bulldoze). (c)
  Adds a compliance-checklist line for the working-tree glance on check-only runs.
- **`git-workflow.md`** — adds a callout: before using the by-hand `git tag` lines,
  check `release.yml`; if CI creates the version tag on the `main` push (tag-gated),
  do not hand-tag (a hand tag makes the gated run skip itself — a silent no-op
  release).
- **`process-reports.md`** — adds: if an earlier report left a version placeholder,
  backfill the real number (read off the hub changelog) so the next adoption has a
  stable anchor.

## What adopting would touch in this repo

- **CLAUDE.md (lines ~246–247) — the real item.** Still carries the pre-0.9.6
  shallow-mirror misread: "if hub `dev` was force-pushed and `--ff-only` aborts,
  `git fetch` + `git reset --hard origin/dev`." 0.9.6 corrected this and 0.9.9
  reinforces it. Adopting means rewriting this to: plain `fetch` + `--ff-only`, and on
  abort `--unshallow`/re-clone the (shallow, `--depth 1`) mirror rather than
  `reset --hard`. This is unchanged from the 06-28 finding — still unadopted.
- **`notes/reference/cross-project-sync.md`** — has no working-tree-glance content
  (0 matches). Adopting the 0.9.9 `adopting-updates` change adds the new check step
  and the renumbered flow here.
- **`notes/reference/compliance.md`** — would gain the new check-only working-tree
  checklist item.
- **`notes/reference/process-reports.md`** — already says "record a real version
  number, not a placeholder"; adopting adds the small "backfill an earlier
  placeholder from the hub changelog" clause.
- **`notes/reference/git-workflow.md` — likely no change.** The tag-gated/`release.yml`
  by-hand-tag rule is already covered here (5 matches) and in CLAUDE.md step 5
  ("Do not tag by hand … `release.yml` derives the tag"). The hub callout is new
  wording, not new policy for this node.

No `hub/templates/` change this cycle, so no CLAUDE.md/skeleton/gitignore template
reconciliation is implied beyond the standards above.

## What went well

The diff was tiny and self-contained (three standards, no templates). The new
"glance at the working tree" step was trivial to satisfy and is a sensible addition to
a scheduled check. Grepping the adopted notes made the "already covered vs. new" call
fast and unambiguous.

## What went wrong / friction

- **The runbook and the project's CLAUDE.md disagree, and CLAUDE.md is the stale one.**
  Step 1 still hard-codes `pull --depth 1 --ff-only`, which aborts every time because
  the mirror is shallow (`--depth 1`) and has no merge base — exactly the stale-shallow
  case 0.9.6+ describes, not a force-push. The CLAUDE.md fallback then does the
  bulldozing `reset --hard` the new standard warns against. The run "worked" (mirror
  ended on the right commit) but by the discouraged path. This is the central thing to
  fix on adoption: correct CLAUDE.md and deepen/re-clone the mirror once so future
  refreshes fast-forward cleanly.
- Because the 0.9.6 correction was never adopted, the gap is cumulative: adopting now
  pulls in both the 0.9.6 force-push/shallow-mirror rewrite and the three 0.9.9
  refinements together.

## Suggestions / feedback

- When adopting, also run the one-time mirror fix the standard recommends:
  `git -C assets/references/fairyfox.io fetch --unshallow` (or re-clone) so the
  `--ff-only` refresh stops aborting and the `reset --hard` fallback is no longer
  exercised at all.
- The 0.9.9 "Carrying pre-0.9.6 wording?" callout is well aimed — it names this exact
  node's situation. Good signal that the hub's self-describing migration notes work.

## Environment

Windows, PowerShell (per project rule: no bash sandbox; PowerShell + file tools only).
Node 24 project (`engine-v3/`). Reference mirror at `assets/references/fairyfox.io/` is
git-ignored, read-only, and shallow (`--depth 1`) — the shallowness is what makes
step 1 abort. Project on branch `dev`, working tree clean this run (no CRLF noise).
Scheduled/unattended run: reported and stopped; applied nothing regardless of any
authorization ledger.
