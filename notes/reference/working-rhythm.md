# Working Rhythm — how an agent collaborates

The shared working agreements for AI-driven work: how to track it, when to stay out of the owner's way
and when to put something in front of them, and — the one that has cost real rework — **not building
past the brief.** This standard was distilled in part **from this project's own
[`working-agreements.md`](working-agreements.md)** (and pokered-save-editor-2's collaboration notes),
so most of it is already lived here; this note is the mesh-shared framing.

Canonical, project-agnostic source: `assets/references/fairyfox.io/hub/standards/working-rhythm.md`.
Complements [`planning.md`](planning.md) (plan the *what*) and [`agent-tooling.md`](agent-tooling.md)
(PowerShell + file tools, execute-don't-hand-off). Planning is the *what*; this is the *rhythm*.

## The rules (and where this project already lives them)

1. **Track the work with tasks — early, comprehensively, live.** Open a task list at the **start** of
   anything with more than one step (not retroactively), break it down properly, keep statuses live
   (`in_progress` when you start, `completed` the moment it's done), add tasks the instant new work
   surfaces. The task list carries the in-flight trail; it does **not** replace the durable
   [`notes/`](research-capture.md).
2. **Work in the background; foreground the moment it's worth a look.** Agent-driven builds, tests,
   runs, captures, and git run **hidden/headless** — this is CLAUDE.md's "start dev servers / builds in
   the BACKGROUND by default" and [`working-agreements.md`](working-agreements.md) §D (detached **and**
   hidden via `ShowWindow = 0`). The other half is binding too: when it's ready to look at, **put it in
   front of the owner** — already on the right screen — rather than "it's ready for your review".
3. **Adjacency is not a brief — don't build what wasn't asked for.** A feature gets **its own brief
   first**, then research, then design, then code; a phase does not absorb a neighbouring feature
   because the data sits next to it or it'd be "easy while we're here". When a briefed feature needs an
   un-briefed one, it **reads** it — it doesn't build UI or scope for it. This is
   [`working-agreements.md`](working-agreements.md) §A5 (don't cut scope; don't presume the owner's
   stance) from the build-side.
4. **When in doubt, ask before building, not after.** A short question up front is cheaper than undoing
   work built on a guess. Surface the ambiguity (and any hacky-only path — see
   [`engineering-quality.md`](engineering-quality.md)) rather than committing a direction. Scope /
   product / preference calls are the owner's; a *technical* fix is not offloaded
   ([`working-agreements.md`](working-agreements.md) §A2).

## Verify (is it being followed?)

- Multi-step work was **task-tracked** with a real breakdown, kept live (check the task trail / session
  log).
- Agent-driven runs stay **background/headless**; finished results are **surfaced** to look at (the
  workflow/CLAUDE.md names both halves).
- Features were **briefed before built** — recent features trace back to a brief/plan, not adjacency.
- Ambiguity was **raised up front**, not resolved by a guess later undone (no large redo-because-
  unbriefed churn).
