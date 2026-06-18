# Project Notes — random-ai-prompt

Living documentation for the codebase and project, written during development so that anyone picking
it up — a human or an AI opening the repo cold — can orient fast and avoid re-learning things the hard
way. The goal: **no knowledge trapped in one person's head, and nothing lost between sessions.**

This file describes the **system** — where everything lives and how it's kept current. Read
[`status.md`](status.md) first for the actual current state.

---

## How to find things

| Folder / File | What's in it |
|---------------|-------------|
| **[`status.md`](status.md)** | **Start here.** Current state only — build/run health, open issues, what's next. No history. |
| [`sessions/`](sessions/README.md) | **The history.** One file per day in month folders (`YYYY-MM/YYYY-MM-DD.md`): what changed each session and why. |
| [`version.md`](version.md) | **The changelog** — plain-English, one entry per commit, newest first (index; months under `version/`). |
| `context/` | Background that changes rarely: [`project.md`](context/project.md) (what it is + goals), [`architecture.md`](context/architecture.md) (layout + entry points + pipeline), [`principles.md`](context/principles.md) (philosophy), [`history.md`](context/history.md) (origins + the 2026 ESM modernization). |
| `systems/` | **System map** — [`overview.md`](systems/overview.md): the machine end-to-end (CLI vs server, settings, the prompt-module pipeline, dynamic prompts, the image index). |
| `reference/` | Quick lookup, no story: [`esm-patterns.md`](reference/esm-patterns.md) (Node/ESM landmines), [`dependencies.md`](reference/dependencies.md) (deps + breaking-change notes), [`fix-patterns.md`](reference/fix-patterns.md) (error→fix), [`git-workflow.md`](reference/git-workflow.md), [`versioning.md`](reference/versioning.md) (the version-number scheme). |
| `decisions/` | Rationale: [`architecture.md`](decisions/architecture.md) (choices + why), [`rejected.md`](decisions/rejected.md) (things tried/considered that were rejected). |
| `plans/` | What's next: [`next-steps.md`](plans/next-steps.md) (ordered tasks), [`testing.md`](plans/testing.md) (the testing reality), [`future.md`](plans/future.md) (longer-term vision). |

> **`version.md` vs `versioning.md`** — easy to confuse. `version.md` (+ `version/`) is the
> **changelog** (the narrative of what changed). `reference/versioning.md` is the **version-number
> scheme** (SemVer, the `VERSION` file). One is the story; the other is the label.

---

## How the system is kept current (the maintenance loop)

The notes are a **living document** — updated as work happens, by default, not on request. Each piece
has one home and one trigger:

| When this happens | Write it here |
|-------------------|---------------|
| You did work worth recording this session | Append to today's `sessions/YYYY-MM/YYYY-MM-DD.md` (newest on top; create it if it's the day's first entry) |
| You made a substantive commit | Its plain-English changelog entry rides **inside that commit**, at the top of `version/YYYY-MM.md` |
| Build/run health or open issues changed | Update [`status.md`](status.md) (keep it current-state only) |
| Fixed an error | Add a row to [`reference/fix-patterns.md`](reference/fix-patterns.md) |
| Hit a CJS→ESM / Node landmine | Add to [`reference/esm-patterns.md`](reference/esm-patterns.md) |
| Changed a dependency | Update [`reference/dependencies.md`](reference/dependencies.md) |
| Made / rejected a structural decision | [`decisions/architecture.md`](decisions/architecture.md) / [`decisions/rejected.md`](decisions/rejected.md) |

The structure is meant to **grow**. If something doesn't fit an existing file, make a new one in the
right folder rather than stuffing it somewhere wrong. (The fuller, AI-facing version of this loop is in
`../CLAUDE.md` → "Maintaining the Notes".)

---

## How to write here

- **Direct.** These are notes, not marketing. Short is better. No cheerful intros/outros.
- **Code blocks for code.** Show it, don't describe it.
- **Tables for lookups.** error→fix, old→new.
- **Date** when timing matters (`2026-06-18`); session files are named by date.
- **Cross-link** related files with relative links; don't restate another file's content.

---

## Folder structure

```
notes/
  README.md              ← this file (the system)
  status.md              ← current state only (health + open issues, no history)
  version.md             ← changelog index (plain-English, per commit)
  version/               ← changelog, one file per month (YYYY-MM.md)
  sessions/              ← the history, one file per day in month folders
    README.md            ← how the per-day log system works
    YYYY-MM/YYYY-MM-DD.md← what changed that day and why (newest on top)
  context/               ← background that changes rarely
    project.md  architecture.md  principles.md  history.md
  systems/               ← the system map
    overview.md
  reference/             ← quick lookup, no story
    esm-patterns.md  dependencies.md  fix-patterns.md  git-workflow.md  versioning.md
  decisions/             ← rationale for choices
    architecture.md  rejected.md
  plans/                 ← what comes next
    next-steps.md  testing.md  future.md
```
