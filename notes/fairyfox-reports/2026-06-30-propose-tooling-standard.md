---
date: 2026-06-30
procedure: propose-standard (node → hub suggestion)
node: random-ai-prompt
outcome: proposal-only (hub NOT modified)
---

# Proposal to the fairyfox system — adopt an "agent tooling / execution" standard for all projects

> A **node-originated suggestion** for the hub to adopt, written here for the owner to carry upstream.
> Per the anti-recursion / stay-inside-this-repo rules, **the hub repo was not touched.** Acting on this
> at the hub is the owner's separate, manual step.

## One-line ask

Make the machine's tooling rule a shared, cross-project standard: **agents use PowerShell (the
`Windows-MCP` PowerShell tool) + the file tools, never the Cowork `mcp__workspace__bash` sandbox — and
they EXECUTE git/build/release work directly rather than handing the user a script.**

## Why (the trigger)

This came up repeatedly while working on `random-ai-prompt`. Two recurring failure modes, both
costly:

1. **Using the Cowork bash sandbox at all.** On this Windows machine the sandbox is actively broken,
   not just redundant: it serves stale/truncated file views (read a 42-line `package.json` as 36 lines),
   it can't reliably touch `.git` (`unable to unlink .git/objects/... Operation not permitted`), and it
   mangles line endings — once staging a 12-line changelog edit as 3,256 phantom CRLF-flip lines. Every
   slip risks a bad edit or a corrupted commit. (It happened again this session — bash used for "quick"
   repo reads — which is what prompted the owner to re-emphasize the rule.)
2. **Handing off instead of executing.** The agent has PowerShell + full git control on the machine **at
   all times**, but kept writing "here's a PowerShell script for you to run" for verify/commit/release.
   The owner's expectation is the opposite: when they say *ship* / *clean up and commit* / *verify*, the
   agent should run the gate, stage, commit, branch, merge, and release **itself** — pausing only for the
   confirmations the workflow actually requires (e.g. the go-ahead to release to `main`, which "ship"
   already grants).

Neither is specific to this project; any fairyfox node operated in this environment hits both. Hence a
shared standard rather than per-repo CLAUDE.md notes that each have to rediscover.

## Proposed standard (sketch — for the hub to refine)

Suggested name: `hub/standards/agent-tooling.md` (or a section in an existing operating-guidance
standard). Rough shape:

1. **Never use the Cowork bash sandbox** (`mcp__workspace__bash`) on this environment — zero exceptions,
   including "quick" reads. Use the file tools (Read/Edit/Write/Glob/Grep) for files and the
   `Windows-MCP` **PowerShell** tool for everything else (npm, git, node, builds, doxygen).
2. **Execute, don't hand off.** With PowerShell + git available continuously, the agent performs
   verify/commit/branch/merge/release directly. A handed-off "run this script yourself" is the wrong
   default; reserve user steps for genuine approvals.
3. **Known PowerShell gotcha to encode:** in-place edits via `Get-Content -Raw | Set-Content` (and
   positional `Set-Content`) can silently no-op on this machine; use
   `[System.IO.File]::ReadAllText/WriteAllText` for scripted bulk replaces (or the Read/Edit tools).
4. **Respect the repo's `core.autocrlf=true`** — PowerShell stages real diffs cleanly; the bash sandbox
   does not.

## Reference implementation (in this repo)

- Memory: `no-bash-use-powershell` (the rule + the "execute, don't hand off" point + the CRLF/.NET
  gotchas).
- Both local CLAUDE.md files already direct PowerShell + file tools over the sandbox; this proposal
  lifts that to the hub so every node inherits it.

## Guardrails honored

On-request only; no hub pull/push; reference clone untouched; no edit to any other repo. This is a
report for the owner to take to the hub manually.
