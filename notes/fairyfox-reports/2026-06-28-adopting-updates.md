---
date: 2026-06-28
procedure: adopting-updates
node: random-ai-prompt
outcome: checked-only
hub_version: 0.9.6
hub_commit: 300b8ab
---

# Process Report — adopting-updates (check-only), 2026-06-28

> A full, honest account of running a fairyfox system procedure. The point is to
> improve the system — so say what was rough even if the run succeeded. Voice: direct,
> matter-of-fact, no hype. Standard: `hub/standards/process-reports.md`.

## Outcome in one line

Check-only scheduled run: the hub moved 0.9.5 → 0.9.6 (one merge,
`feature/no-force-push-shallow-mirror-fix`) abolishing force-pushed `dev` and the
shallow-mirror/`reset --hard` refresh model — reported what adopting would touch
(CLAUDE.md, `notes/reference/cross-project-sync.md`, `notes/reference/process-reports.md`,
and the mirror clone itself); nothing applied, awaiting owner go-ahead.

## What was done

1. Refreshed the read-only hub mirror. Ran the runbook's step-1 command as this
   project's CLAUDE.md still specifies it:
   `git -C assets/references/fairyfox.io pull --depth 1 --ff-only origin dev`.
   It aborted with `Not possible to fast-forward` and reported a forced update
   (`+ 316ed8a...300b8ab dev (forced update)`). Per the current CLAUDE.md fallback,
   recovered with `git fetch --depth 1 origin dev` + `git reset --hard origin/dev`.
   Mirror moved 316ed8a → 300b8ab. (Note: the new 0.9.6 standard says this very
   "forced update" signal was actually the stale shallow mirror's missing merge base,
   and the correct recovery is now `--unshallow`, not `reset --hard` — see friction.)
2. Confirmed the old commit object (316ed8a) was still present, so diffed precisely
   rather than relying on the changelog-version span alone.
   `git diff --name-status 316ed8a 300b8ab` → 16 files; the adopted surface is
   `hub/standards/` (6 files) + `hub/templates/` (2 files). The rest are hub-internal
   (VERSION, `.last-seen.yml`, hub README, hub's own notes) and not adopted here.
3. Read the full diffs for all 8 changed standard/template files.
4. Anchored "last adopted" on the newest report: `2026-06-27-adopting-updates.md`
   records `hub_version: 0.9.5` / `316ed8a`. Current hub VERSION is `0.9.6`. Span is
   exactly the one merge above.
5. Located where this project's own tree carries the now-outdated language (grep,
   excluding the git-ignored mirror, `node_modules`, generated `tmp/jsdoc-tutorials/`,
   and prompt-data files that match "shallow" coincidentally).
6. Wrote this report. Applied nothing — scheduled checks report and wait regardless of
   the authorization ledger.

### What changed in the hub (0.9.5 → 0.9.6)

One coherent theme: **`dev` is now append-only across the whole mesh — nothing
force-pushes it** (a hard `git-workflow` safety rule). That retires the old assumption
that hub `dev` is force-pushed routinely, and with it the shallow-clone +
`reset --hard` refresh dance.

- **`adopting-updates.md`** (biggest change, step 1 rewritten): refresh is now a plain
  fast-forward (`git fetch origin dev` + `git merge --ff-only origin/dev`) of a
  single-branch **full-history** clone. "Expect this to abort" is gone. If `--ff-only`
  aborts it's almost always a *stale `--depth 1` shallow mirror* (no merge base →
  `refusing to merge unrelated histories`), recovered by `git fetch --unshallow` or a
  fresh single-branch re-clone — **not** `reset --hard`. A full-history mirror that
  still won't ff means a genuine rewrite → stop and investigate. Step 2's anchor
  rationale softened (version is the sturdier anchor, but a SHA would now survive too).
  Verify + close-out wording updated to drop the routine-`reset --hard` framing.
- **`cross-project-sync.md`**: both inbound (hub reads projects) and outbound (project
  reads hub) flows switched from `--depth 1` + `reset --hard` to single-branch
  full-history + `merge --ff-only`; "why not submodules" line updated.
- **`process-reports.md`**: "shallow clone" → "clone"; anchor rationale reworded
  (SHA is "fragile," not "erased by force-push").
- **`compliance.md`**: target-pick step references the deepen/re-clone recovery instead
  of a force-push re-clone fallback.
- **`new-project-setup.md`** and **`onboarding-existing-project.md`**: clone command
  changed to `clone --branch dev --single-branch` (full history), with a note on why
  not `--depth 1`.
- **`templates/README.md`**: one-time adoption clone command updated to single-branch.
- **`templates/fairyfox-report.md`**: `hub_commit` comment reworded (SHA can drift on
  re-clone; version is the durable anchor).

### What adopting it would touch in this repo (not done — for the owner)

- **`CLAUDE.md`** (L246–247, "Cross-project standards" section): the inline refresh
  instruction still says `pull --depth 1 --ff-only` with a `git fetch` + `reset --hard
  origin/dev` force-push fallback, and the surrounding prose frames hub `dev` as
  force-pushed. Reword to the fetch + `merge --ff-only` model with `--unshallow`/re-clone
  recovery, and drop the "force-pushed routinely" framing.
- **`notes/reference/cross-project-sync.md`** (the adopted copy; L20, 39, 42, 52, 65–67,
  113): the main reconcile target — same `--depth 1` / `--ff-only` / `reset --hard` /
  "shallow clone" / "force-pushed" language as the hub standard that changed.
- **`notes/reference/process-reports.md`** (L20, L83): minor wording — "shallow clone"
  and "force-push may have erased."
- **The mirror clone itself** (`assets/references/fairyfox.io/`): currently a `--depth 1`
  shallow clone. To comply going forward and make future `--ff-only` refreshes succeed
  cleanly, it wants `git fetch --unshallow` (or delete + re-clone single-branch). This is
  a git-ignored disposable mirror, so this is safe and produces no commit — but it's a
  one-time deepen the owner should green-light.
- **`notes/reference/git-workflow.md`**: already consistent (it already states pushed
  history is intact, no force-push) — no change needed; the hub's `git-workflow.md`
  wasn't in this changeset.

## What went well

- The diff was exact and cheap: the pre-refresh HEAD (316ed8a) survived in the mirror,
  so a SHA-to-SHA `git diff` cleanly scoped the adopted surface instead of leaning on
  the changelog span. (Ironically only possible *because* `dev` wasn't actually
  force-pushed — the old commit was still reachable.)
- The change is a single, self-contained theme, easy to summarize and easy to map onto
  this project's three carrier files.
- Version anchoring worked exactly as designed: the previous report's `hub_version: 0.9.5`
  bounded "what changed since" with no marker file.

## What went wrong / friction

- **The runbook this project currently follows produced the exact false signal the new
  standard fixes.** CLAUDE.md (and `notes/reference/cross-project-sync.md`) told me to
  `pull --depth 1 --ff-only`; it aborted; the documented fallback was `reset --hard
  origin/dev`, so that's what I did. The 0.9.6 standard says that abort was the stale
  shallow mirror's missing merge base, and the right move is `--unshallow`. So the run
  is a live demonstration of the bug being retired — but it also means a check-only run
  is mechanically forced into the deprecated path until the project adopts the update.
  There's a chicken-and-egg wrinkle: the mirror is still shallow, so even after adopting
  the doc changes, the *first* `--ff-only` refresh will still abort until someone runs
  `--unshallow` once.
- The new standard says "`dev` is append-only, nothing force-pushes it," yet my fetch
  output literally read `(forced update)`. That's because the local mirror is still
  shallow — but the wording could trip up an operator who sees a real "forced update"
  line and concludes the safety rule was violated. A one-line note in step 1 ("a
  `(forced update)` line on a *shallow* mirror is the missing-merge-base artifact, not a
  real rewrite") would preempt the confusion.

## Suggestions / feedback

- In `adopting-updates.md` step 1, add an explicit note that on a not-yet-deepened
  shallow mirror, `git fetch` may still print `(forced update)` / `+ <old>...<new>` —
  and that this is the same false signal, resolved by `--unshallow`, not evidence of a
  real force-push.
- Consider calling out the one-time migration explicitly: existing nodes have shallow
  `--depth 1` mirrors on disk, so adopting 0.9.6 isn't just a doc edit — each node must
  run `git fetch --unshallow` once (or re-clone single-branch) for the new fast-forward
  refresh to actually work. Worth a sentence in the "what adopting touches" framing so
  nodes don't adopt the prose and still hit the abort next time.

## Environment

Windows, PowerShell (per project rule: no bash sandbox — false-truncation risk;
`Windows-MCP` PowerShell + file tools used throughout). Unattended scheduled run, owner
absent. random-ai-prompt is a Node 24 ESM project; the fairyfox node lives at repo root
with the read-only mirror under `assets/references/fairyfox.io/` (git-ignored, still a
`--depth 1` shallow clone from an earlier onboarding). Branch on arrival: working tree as
left by prior sessions; no branch switch or commit made this run. Last adopting run was
2026-06-27 (check-only, 0.9.5). Per the scheduled-check rule, nothing was applied and the
authorization ledger was not used to shortcut anything — a scheduled check reports and waits.
