# Working agreements — how the owner wants this project worked on

**This file is the system of record for the owner's standing preferences and hard rules.** It was created
2026-07-10 by **dumping the assistant's private AI memory into the repo**, at the owner's explicit
instruction: *"do not use your memory or the shared project memory — your memory is in fact... dump what
you have into notes."*

**Rule: private/AI/"project" memory is NOT to be used for this project.** Anything durable lives here (or
elsewhere in `notes/`), committed and reviewable. If something is worth remembering, it goes in the notes.
See [`repo-hygiene.md`](repo-hygiene.md) and the "Maintaining the Notes" section of `CLAUDE.md`.

---

## A. Hard rules (non-negotiable)

### A1. PowerShell is the shell — EXECUTE, never hand off. Never touch the bash sandbox.
`mcp__Windows-MCP__PowerShell` is a real shell on the owner's machine with full git / npm / node / build
access, available every turn.

- **Never say or imply "I can't run git/builds/tests."** It is false and the owner finds it maddening.
  *No bash ≠ no shell.* PowerShell is the shell.
- When the owner says ship / verify / commit / release → **do it**, don't write a script for them to paste.
  Handing over a script "for you to run" is the wrong default and a recurring mistake.
- **Never call the Cowork bash sandbox.** Not for a "quick" `ls`/`cat`/`grep`. It is actively broken here:
  stale/truncated file reads (read a 42-line file as 36), can't reliably touch `.git`, and mangles line
  endings (once staged a 12-line edit as 3,256 phantom CRLF lines).
- Files → Read/Edit/Write/Glob/Grep. Everything else → PowerShell.
- **PowerShell gotchas:** `Get-Content -Raw | Set-Content` (and positional `Set-Content`) can silently
  no-op on this machine — use `[IO.File]::ReadAllText/WriteAllText` for scripted bulk replaces. And those
  .NET calls resolve **relative paths against .NET's cwd, not PowerShell's** — always pass absolute paths.

### A2. Build the solution — don't offload the design decision.
When a defect/problem is found, **design and build the fix**. Do NOT use AskUserQuestion to ask *how* to
solve a technical problem — that reads as offloading. (The owner: *"that was your job… unprofessional and
embarrassing."*) AskUserQuestion is for genuine product/preference/scope calls, not architecture.

### A3. Don't duplicate — reuse/extract the shared piece.
Engine/prompt/provider logic lives in the engine (or a shared module); every target **thin-wraps** it,
never forks it. If a new target would force a third copy of existing behavior, **extract** the shared piece
instead of re-porting. The owner has flagged fast-path re-implementation **more than once**.

### A4. Prefer the higher-quality option — always, by default.
Never present quality as an opt-in tradeoff. Assume the quality-maximizing choice (real e2e/visual
verification, full a11y, polished UX, genuine coverage) and just do it, even if it's more work.

### A5. Don't cut scope; don't presume the owner's stance.
- A critique ("this doesn't work", "I don't know what this does") is **not** a removal order. Ask
  (keep / fix / move / remove) before deleting a working feature. Scope calls are the owner's.
- On a real tradeoff, lay out **both** options plainly and ask — don't quietly steer to the one you assume
  they want. (They were fine with PRs/branch protection when I'd presumed otherwise.)

---

## B. Definition of done

### B1. Regression-test every fix — and PROVE it.
Every bug fix ships, in the same change, with a test that **fails on the old behavior and passes on the
fix**. Prove it: temporarily re-introduce the bug, watch the test fail, restore.
- Logic/engine → `tests/regression/bugRegressions.test.js`
- UI/layout/responsive/stacking → `tests/e2e/responsive.spec.js` (functional hit-tests, not pixel baselines)
- Pixel-visual → `tests/e2e/visual.spec.js`
- Add a row to [`fix-patterns.md`](fix-patterns.md).

### B2. Interactions must be PRESSED, not just rendered.
Render-only assertions and marker/regex "surface parity" checks **cannot** catch a dead control — a prop
the parent passes and the child never destructures renders perfectly and does nothing. That is exactly how
untappable generated images shipped (`onOpenImage` ignored). For every interactive control: `fireEvent.press`
it and assert the handler fired **with the right payload**; and in the parent's test capture the mocked
child's props and assert the callback is a function.

### B3. Verify UI by LOOKING — screenshots at every breakpoint.
Passing functional tests is **not** proof it looks good. For any UI/CSS work: run it, screenshot at
360 / 390 / 768 / 1280, and actually **look** — overflow, clipping, cut-off tabs, "slab of buttons"
density, overlapping elements, things that look clickable but aren't. Self-critique the whole screen
proactively, not just the thing asked about. Add runtime diagnostics (`scrollWidth > clientWidth`;
`elementFromPoint` / computed `display`/`opacity`/`pointer-events` to catch invisible-but-present or
non-interactive elements). A real catch: a drawer scrim was `display:none`, so it neither dimmed nor
swallowed clicks and "click-off to close" silently failed.

### B4. Verify with the real tool before claiming done.
Don't assert success from a proxy signal. (I claimed OpenSSF Signed-Releases was satisfied because an
attestation existed — Scorecard reads signature files, not the attestations API, and never credited it.)
Run the actual tool and read the real result.

### B5. Don't regress quality metrics.
Scorecard, coverage (Codecov), SonarCloud gate/debt must **hold or rise** — never drop without a good,
stated reason. Treat metric preservation as part of "done."

---

## C. Vocabulary

- **"ship it" = "deploy" = "release" = merge to `main`** (cut a release), not merely commit/push to `dev`.
  Plain "commit"/"save"/"push" still means `dev` only. The explicit word is still required before touching
  `main`; all git safety rules hold.
- **One code pool → local + online *builds*** (online = same code, local-only features gated off).
  **dev / release are *stages***, not editions. Terminology precision matters to this owner.

## D. Environment / workflow

- **Start dev servers and builds in the BACKGROUND by default** (hidden process → log file), never a
  popped-open terminal window. Surface the connection info (URL/QR/port) from the log.
  - Windows note: a *detached* spawn (`Win32_Process.Create`) survives the shell session but shows a
    console by default — pass `Win32_ProcessStartup` with `ShowWindow = 0` to get **detached AND hidden**.
- **CRLF working-tree noise:** `git status` routinely shows 100+ tracked files "modified" with no real diff
  (line-ending normalization). **Never `git add -A`/`.`** — stage explicit paths. Use
  `git diff --numstat | ? { $_ -notmatch '^0\t0\t' }` for the real-diff set. Switching branches can be
  blocked by the noise → `git checkout -f <branch>` is safe (all real work is committed).

## E. Parity rules

- **CLI ⇄ GUI ⇄ engine parity** — `targets/cli/` must stay at feature parity with **both** the GUI and the
  engine by default: every `engine/settings.js` field is a flag; same providers, same settings store.
- **Mobile ⇄ web parity** — complete, no exceptions, no size-based feature loss; enforced behind the
  release gate. See [`../plans/mobile-parity.md`](../plans/mobile-parity.md) and
  [`../systems/mobile.md`](../systems/mobile.md).
- **Capability gating is part of parity** (learned 2026-07-10): the web **locks** controls
  (`is-locked` + 🔒) when a provider isn't picked or can't do the job — it does **not** pop
  "pick a provider" errors on press. Marker/feature-presence parity checks do not cover this layer.
  Every provider-dependent control must be gated the same way on every target.

## F. Project facts worth keeping

- **Release gates:** SonarCloud is scoped to `src/` only (the SPA is excluded — its JS security sensor
  hangs); Codecov ingests both Node + SPA lcov. `main` has `required_conversation_resolution`, so **every**
  review thread (incl. CodeRabbit's) must be resolved or `gh pr merge` fails as BLOCKED even with all checks
  green. Owner wants new-code coverage ≥85% and zero total Sonar debt.
- **Legal docs:** three self-hosted pages (`targets/web/public/legal/{privacy,terms,cookies}.html`),
  contact `fairy@fairyfox.io`, 18+. Keep them **code-accurate by default** whenever data practices change
  (same change, bump "Last updated"). Fonts are self-hosted, so there's no IP-to-Google transfer.
- **Testing landmine:** lodash captures `Math.random` at import, so `_.random`/`_.sample`/`_.shuffle`
  cannot be stubbed by overriding `Math.random`. Assert invariants or use single-entry lists; only the DPL
  renderer is seedable.
- **Content-safety / list policy:** remove slurs + minor-sexual + extreme shock/gore/non-consensual;
  **keep** ordinary adult/nudity content but NSFW-gate it (never delete). Always **relocate over delete**,
  and show what would be removed first. The owner distrusts fuzzy/heuristic scripts — prefer authoritative
  sources (WordNet/dictionaries) or explicit judgment, and always prove no-loss coverage.

## G. Historical (superseded — kept for context, do not act on)

These came from the memory dump but describe a tree that no longer exists (`engine-v3/`, `web-app/`,
`gui/`, `src/server.js`, `prompt-modules/`). The repo is now **engine/ + targets/**.
- *classic-server-read-only* — the legacy Express/Pug server and `prompt-modules/` were read-only and are
  now **deleted** from the tree (they live in git history + the reference clone).
- *provider-framework* — the `gui/providers/` design; it shipped and now lives at `targets/web/shared/`.
- *removed-pending-readd* — 2026-06-19 SPA home features pulled for later re-add (presets to come back
  richer: full settings + auto-generation).
- *list-cleanup-and-safety* — the v2.1.0 keyword-list purge/reorg; the durable **policy** is captured in
  §F above, and the architecture in `notes/reference/list-architecture.md`.
