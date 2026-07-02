---
date: 2026-06-30
procedure: adopting-updates
node: random-ai-prompt
outcome: checked-only
hub_version: 0.9.14
hub_commit: 0fb30be
---

# Process Report — adopting-updates (check-only), 2026-06-30

> A full, honest account of running a fairyfox system procedure. The point is to
> improve the system — so say what was rough even if the run succeeded. Voice: direct,
> matter-of-fact, no hype. Standard: `hub/standards/process-reports.md`.

## Outcome in one line

Check-only scheduled run: the hub moved 0.9.9 → 0.9.14, but **every commit is
website/registry content** (registering a new `fairyfox-games` node, a `/games/` nav
redirect, a blog post, reconciling node rows) — **no `hub/standards/` or
`hub/templates/` file changed**, so there is nothing new to adopt. The pre-existing,
still-unadopted 0.9.6 force-push/shallow-mirror correction (flagged 06-28/06-29)
remains outstanding. Nothing applied.

## What was done

1. Refreshed the read-only hub mirror with the runbook's step-1 command as CLAUDE.md
   still specifies it: `git -C assets/references/fairyfox.io pull --depth 1 --ff-only
   origin dev`. It aborted (`Not possible to fast-forward`, `+ bbf9b70...0fb30be dev
   (forced update)`) — the same stale-shallow-mirror false signal as the last several
   runs. Per the current CLAUDE.md fallback, ran `git fetch --depth 1 origin dev` +
   `git reset --hard origin/dev` on the reference clone only. Mirror is now at
   `0fb30be` (0.9.14).
2. To diff precisely (the shallow mirror had dropped the 06-29 baseline `bbf9b70`),
   deepened the mirror read-only with `git fetch --depth 50 origin dev`, which made
   `bbf9b70` reachable again. This is a read of the far side, no write.
3. `git diff --name-status bbf9b70 0fb30be -- hub/standards hub/templates` → **empty**.
   Widened to the whole tree: 19 files changed, all hub-internal site/registry content.
4. Anchored "last adopted/seen" on the newest prior report:
   `2026-06-29-adopting-updates.md` records `hub_version: 0.9.9` / `bbf9b70`. The span
   is exactly the five commits 0.9.10 → 0.9.14.
5. Glanced at the node's own working tree (0.9.9 check step): branch `dev`, no
   mid-merge / detached HEAD, no CRLF noise. One untracked file — see friction.
6. Wrote this report. Applied nothing — scheduled checks report and wait regardless of
   the authorization ledger.

## What changed in the hub (0.9.9 → 0.9.14)

All website/hub-internal — none of it is an adopted standard or template:

- `e84a6ce` (0.9.10) register **Fairy Fox Games** as an integrated project.
- `fd025f2` (0.9.11) fairyfox-games `adopts_hub -> true`, version bump.
- `35aab6b` (0.9.12) bring `fairyfox-games` in as a tracked node (ref clone +
  last-seen), `/fun/ -> /games/`.
- `e09684d` (0.9.13) reconcile node rows to **Random AI Prompt 2.28.18** + Fairy Fox
  Games 0.4.0, blog the 29th.
- `0fb30be` (0.9.14) add a **Games** link to nav → `/games/` redirect.

Changed files: `VERSION`, `_data/projects.yml`, `_data/pulse.yml`,
`_docs/fairyfox-games.md` (new), `_docs/overview.md`, `_includes/header.html`,
`_posts/2026-06-29-…md` (new), `_projects/fairyfox-games.md` (new),
`_projects/random-ai-prompt.md`, `about.md`, `games.html` (new), `hub/.last-seen.yml`,
`hub/registry.yml`, `index.html`, `notes/…`, `projects.md`. **Zero** under
`hub/standards/` or `hub/templates/`.

## What adopting would touch in this repo

**Nothing this cycle** — the adopted surface (`hub/standards/`, `hub/templates/`) did
not move between 0.9.9 and 0.9.14.

Two notes, neither an action for this repo:

- **Hub-side records about this node** (`_data/projects.yml`,
  `_projects/random-ai-prompt.md`, `hub/registry.yml`, `hub/.last-seen.yml`) were
  reconciled to "Random AI Prompt 2.28.18." These live in the hub repo; this node never
  edits them. Informational only — if the recorded version looks wrong, the fix is
  reported to the owner to make in the hub, not here.
- **Still outstanding (carried, not new): the 0.9.6 force-push/shallow-mirror
  correction** remains unadopted in this repo. CLAUDE.md (~L246–247) and
  `notes/reference/cross-project-sync.md` still say `pull --depth 1 --ff-only` with a
  `reset --hard origin/dev` fallback; the standard since 0.9.6 wants a full-history
  single-branch mirror refreshed by `fetch` + `merge --ff-only`, with `--unshallow`/
  re-clone (not `reset --hard`) on abort. This run again exercised the deprecated path.
  Adopting it would also one-time deepen/re-clone the git-ignored mirror so future
  `--ff-only` refreshes stop aborting. Unchanged from 06-28/06-29 — for the owner.

## What went well

The diff was cheap and unambiguous: deepening the mirror restored the baseline commit,
so a SHA-to-SHA path-scoped diff settled "did any standard/template change?" in one
command — answer no. A whole-mesh version jump (five commits) collapsed to "nothing to
adopt" quickly. The working-tree glance was trivial.

## What went wrong / friction

- **Same deprecated refresh path as every recent run.** CLAUDE.md step 1 still
  hard-codes `pull --depth 1 --ff-only`; it aborts because the mirror is shallow; the
  documented fallback is the `reset --hard` the standard has warned against since 0.9.6.
  The run "worked" but only by the discouraged route. This is the one real carry-over
  item and it compounds each cycle.
- **Yesterday's report was never committed.** `notes/fairyfox-reports/2026-06-29-
  adopting-updates.md` is sitting untracked in the working tree. Process reports are
  meant to be committed as a reviewable act (and the hub reads them inbound). A string
  of scheduled check-only runs is producing reports that pile up uncommitted — worth the
  owner committing the backlog (06-29, and this 06-30 file) on `dev`.

## Suggestions / feedback

- Adopt the 0.9.6 correction and run the one-time mirror deepen
  (`git -C assets/references/fairyfox.io fetch --unshallow`, or re-clone single-branch)
  so the `--ff-only` refresh stops aborting and the `reset --hard` fallback is retired.
- Consider committing the accumulating check-only reports so the inbound hub read sees
  them.

## Environment

Windows, PowerShell via `Windows-MCP` (per project rule: no bash sandbox — false-
truncation risk; PowerShell + file tools only). Node 24 ESM project (`engine-v3/`).
Reference mirror at `assets/references/fairyfox.io/` is git-ignored, read-only, and was
a `--depth 1` shallow clone (deepened read-only to `--depth 50` this run only to restore
the diff baseline). Project on branch `dev`; working tree clean apart from the untracked
06-29 report. Unattended scheduled run: reported and stopped; applied nothing regardless
of the authorization ledger.
