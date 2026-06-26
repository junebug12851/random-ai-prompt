# Cross-project sync — this project as a node in the fairyfox system

This repo is a **node in the fairyfox system** (the hub mesh at
[fairyfox.io](https://fairyfox.io)). It adopts shared standards — the git model, versioning,
the notes system, the AI-context shape, and the docs-site design — from the hub, and stays
aware of the hub **without entanglement**. This page is the project-side record of how that
link works; the canonical, project-agnostic standard lives in the read-only hub clone at
`assets/references/fairyfox.io/hub/standards/cross-project-sync.md` (re-read it there for the
authoritative version).

See also the `CLAUDE.md` section **"Cross-project standards & checking the fairyfox system for
updates"** (the standing instruction that drives the check-for-updates flow) and
[`git-workflow.md`](git-workflow.md) / [`versioning.md`](versioning.md) (two of the standards
adopted from the hub).

## The one rule

**Communication is git-only, one-directional per flow, and happens only on explicit request.**
No submodules, no package dependency, no build-time coupling, no webhooks, no cross-repo
automation. Each side *reads* a shallow clone of the other when a human or AI deliberately asks.
Both flows track the hub's **`dev`** branch (latest work). This prevents recursion: nothing on
one side automatically triggers a pull on the other.

> **This project never writes to another repo.** The sync is read-only on the far side. When a
> hub-side change is needed (for example correcting this project's row in `hub/registry.yml` or
> `_data/projects.yml`), that is **reported to the owner to apply in the hub repo** — this repo
> never edits or pushes `junebug12851.github.io`.

## The two flows

### Project reads the hub (the flow this repo uses)

The hub clone is kept read-only and **git-ignored** under `assets/references/fairyfox.io/`
(the folder's own `assets/references/.gitignore` ignores everything but itself, so the clone
produces no commit):

```sh
# first time
git -C assets/references clone --depth 1 --branch dev \
    https://github.com/junebug12851/junebug12851.github.io fairyfox.io
# refresh
git -C assets/references/fairyfox.io pull --depth 1 --ff-only origin dev
```

**Adopting a standard is a copy committed locally, not a live link.** What this project has
folded in from `hub/standards/` and `hub/templates/` (the `CLAUDE.md` mesh block, this note, the
git/version model, the notes system, the docs-site theme) lives in the repo's own tree; re-pull
later and merge changes by hand.

### Hub reads the project (the inbound flow, run from the hub side)

The hub keeps its own read-only shallow clone of this repo under its `assets/references/<key>/`
to track changes and blog about them. That happens in the hub repo, not here.

What the hub reads out of that clone is this project's history (for blog round-ups) **and** its
[`notes/fairyfox-reports/`](../fairyfox-reports/README.md) — the [process reports](process-reports.md)
this node writes after running a system procedure, which the hub reviews to improve the standards.
Both reuse the one read-only inbound flow; neither adds a connection between the repos.

## Check-for-updates flow (on request only)

When the owner asks to **check the fairyfox system for updates** (the request must carry the word
*fairyfox*), the default is **check → report → wait**:

1. Refresh the clone: `git -C assets/references/fairyfox.io pull --depth 1 --ff-only origin dev`.
   If the hub `dev` was **force-pushed**, `--ff-only` aborts — recover with `git fetch` then
   `git reset --hard origin/dev` on the **reference clone only** (it's a disposable, git-ignored
   mirror; this never touches project history).
2. Diff `hub/standards/` + `hub/templates/` against what this project has adopted.
3. **Report** what changed and what adopting it would touch — **then stop.** Apply nothing until
   the owner says go ahead; applying is a separate, confirmed act.
4. **Write a process report** in [`notes/fairyfox-reports/`](../fairyfox-reports/README.md) — a
   check-only run gets one too. See [`process-reports.md`](process-reports.md).

Full procedure: the `adopting-updates.md` runbook in the clone's `hub/standards/`. Whether the run
only checked or went on to adopt, it ends with a process report. The recurring whole-set check that
this project still follows every adopted standard is the [compliance audit](compliance.md).

### The express-authorization ledger (skipping a redundant prompt)

Alongside the standards, the project also reads the hub's **express-authorization ledger**
(`hub/authorizations.yml`) out of the same read-only clone. It records the go-aheads the system owner
makes **at the hub** for changes to roll out. When an **active** entry there `covers` a change this node
is adopting, the user already gave the go-ahead at the system, so the node treats it as **pre-authorized
and skips its redundant "check-and-report-then-wait" pause — but only that pause.** Every other adoption
safety step still runs: copy-not-clobber, **re-prompt before overwriting a deliberate local
divergence**, process report, reviewable commit, build-check. If nothing covers the change (or the entry
`expires`d), fall back to check-report-wait.

This is still a **read, on request** — it adds no automation and no hub→node push, so anti-recursion
holds. A pre-authorization lets a node skip a prompt; it never lets the hub act on the node. An
unattended/scheduled **check** still applies nothing regardless of the ledger.

## Anti-recursion checklist

- ✅ Pulls are manual / on request — never scheduled to chain across repos.
- ✅ Each flow is read-only on the far side — sync never pushes into the other repo.
- ✅ The reference clone is git-ignored — a pull produces no commit, so it triggers nothing.
- ✅ Adoption is a copy, not a runtime dependency.
- ✅ Process reports are local notes that ride the existing inbound read — writing one pushes
  nothing across repos and adds no new connection.
- ✅ The express-authorization ledger is **read-only on the far side** like every other artifact — a
  pre-authorization lets a node skip a prompt, never lets the hub act on the node. The node still
  adopts only when the user invokes the flow.

## Why `assets/references/`, not a submodule

A submodule pins a commit and couples the repos at clone/build time — the opposite of the goal.
A throwaway shallow clone in a git-ignored folder gives the content to read with zero coupling
and zero history weight. (The same folder also holds `og-pre-revival-2023-04-07-241a148/`, the
archived pre-revival snapshot — unrelated to the hub, same read-only-reference role.)
