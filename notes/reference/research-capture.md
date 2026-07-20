# Research Capture — understanding lands in the notes

The most perishable thing this project produces is **understanding** — what a DPL construct really
does, how a provider's dialect actually behaves, a content-safety edge case, a loader resolution rule
that isn't obvious from the code. Code can be rewritten from notes; notes cannot be rewritten from
code. So: **if you understood something you didn't understand before, write it down — in `notes/`, in
the same session, without being asked.**

Canonical, project-agnostic source: `assets/references/fairyfox.io/hub/standards/research-capture.md`.
It sits on top of the notes system ([`../README.md`](../README.md)) and feeds
[`engineering-quality.md`](engineering-quality.md) (build on verified understanding, not a guess). It
is the same commitment [`working-agreements.md`](working-agreements.md) §A0 makes ("write them back in
the same change") stated as a research discipline.

## The rules

**When:** by default, in every session — not "if it seems important", not "at the end". A new or
expanded understanding is captured the moment it's gained.

**The shape of a research pass (none of these steps is optional):**

1. **Go to the primary source** — the upstream spec / real system / actual provider behaviour, not
   memory, not a previous version, not what a thing is *called*.
2. **Verify when it's load-bearing.** If real work will be built on a conclusion, **prove it** (a probe,
   a test, a golden output) and **commit the probe**. A careful reading of the code has been wrong here
   before — this is [`working-agreements.md`](working-agreements.md) §B1/§B4 (regression-test and prove;
   verify with the real tool) and [`../plans/testing.md`](../plans/testing.md).
3. **Write the reference note** — `notes/reference/<topic>.md`: the real names, ranges, who writes it,
   who reads it, what the system does with edge/hack values, the traps. **Plain English**, teachable to
   someone who doesn't already know the domain. (This project's `dpl-*.md`, `*-architecture.md`,
   `*-design.md`, [`esm-patterns.md`](esm-patterns.md) and [`fix-patterns.md`](fix-patterns.md) are the
   model.)
4. **Say what it means for the code.** A research pass usually turns up real bugs in the current model —
   list them and fix them **before** building anything new on the corrected understanding.
5. **Wire it up** — a row in the notes map, a line in [`../status.md`](../status.md), an entry in
   today's session log, and a link from the plan it feeds, so the knowledge is reachable, not stranded.

**Static co-location is a lead, never evidence.** Two things sitting next to each other prove nothing
about how they interact — adjudicate on the real system before asserting.

## Verify (is it being followed?)

- Non-trivial findings have a **reference note** in `notes/reference/`, not only a session-log mention.
- Load-bearing conclusions were **verified against the real system**, with the probe committed.
- Reference notes are **plain-English and teachable**, with the traps named.
- A research pass that found a model bug **fixed it before building on top**.
- New notes are **wired in** (map row, status, session log, plan link).
