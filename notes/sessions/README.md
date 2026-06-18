# Session Logs

The running history of the project — **what changed each working session and why.** One file per
calendar day, grouped into **month folders**: `sessions/YYYY-MM/YYYY-MM-DD.md` (e.g.
`sessions/2026-06/2026-06-18.md`).

[`../status.md`](../status.md) holds the *current* state (health, open issues). These files hold the
*story* of how it got there. Reusable lessons live in [`../reference/`](../reference/) and
[`../decisions/`](../decisions/); the session logs are the narrative and the pointer.

## The system (how to keep this updated)

**Each working day gets one file: `sessions/YYYY-MM/YYYY-MM-DD.md`.** When you do work worth recording,
append an entry to *today's* file (create it — and the `YYYY-MM/` month folder, if it's a new month —
if it's the day's first entry). Within a day, newest entry on top.

Day file skeleton:

```markdown
# 2026-06-18 — Session Log

## <short title of the change> — <one-line outcome>

What changed, the root cause if it was a bug, the files touched, the verification result, and any
follow-up. Keep the technical specifics — those are the valuable part. Plain English, no diff noise.
```

### Conventions

- **One file per day**, `YYYY-MM-DD.md`, inside a **`YYYY-MM/` month folder**.
- **Newest entry on top** within a day; newest day is the highest-numbered file in the newest month.
- **Cross-link, don't duplicate.** Reusable depth → `../reference/`; current health → `../status.md`.
- When a fix or pattern is worth reusing, also add it to the right reference file — the session log
  records *that it happened*, the reference file records *the reusable lesson*.

### Relationship to the changelog

The [changelog](../version.md) (`version/YYYY-MM.md`) is **one entry per git commit**, written *inside*
the commit. The session log is **one entry per working session**, broader than any single commit.
