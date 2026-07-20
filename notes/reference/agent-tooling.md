# Agent Tooling & Execution

How an AI assistant operates this repo on this environment. Two rules that were being rediscovered
per-project, lifted into the mesh so every node inherits them: **use PowerShell + the file tools, never
the Cowork bash sandbox**, and **execute the work directly rather than handing the owner a script.**

Canonical, project-agnostic source: `assets/references/fairyfox.io/hub/standards/agent-tooling.md`. It
belongs in [`../../CLAUDE.md`](../../CLAUDE.md)'s Build/Run + "Critical things not to get wrong"
sections, and it restates [`working-agreements.md`](working-agreements.md) §A1 verbatim in intent.

## The rules

### 1. Never use the Cowork bash sandbox

On this Windows machine `mcp__workspace__bash` is **actively broken**, not just redundant — **zero
exceptions, including "quick" reads.** Observed failures: stale/truncated file views (a 42-line file
read back as 36), inability to touch `.git`, and line-ending mangling (a 12-line edit staged as ~3,256
phantom CRLF-flip lines). Use instead:

- **File tools** (Read / Edit / Write / Glob / Grep) for all file work.
- The **`Windows-MCP` PowerShell** tool for everything else — `npm`, `git`, `node`, builds, doc gen.

### 2. Execute, don't hand off

The assistant has PowerShell + full `git`/`gh` control **at all times**. When the owner says *ship* /
*clean up and commit* / *verify*, the assistant **runs** the gate, stages, commits, branches, merges,
and releases **itself** — pausing only for the confirmations the workflow actually requires (e.g. the
go-ahead to release to `main`, which "ship" already grants). "Here's a script for you to run" is the
wrong default. Never say or imply "I can't run git/builds/tests" — *no bash ≠ no shell.*

### 3. Known PowerShell gotchas to encode

- **`Get-Content -Raw | Set-Content`** (and positional `Set-Content`) can silently **no-op** here — for
  scripted bulk replaces use `[System.IO.File]::ReadAllText/WriteAllText` (with **absolute** paths —
  .NET resolves relative paths against its own cwd), or just the Read/Edit tools.
- **Never pass prose through `-m` / `-e`** — PowerShell parses `&`, `|`, `` ` ``, `$(…)` inside
  double-quoted args, so a commit message describing a shell-injection payload actually **ran** it. Use
  `git commit -F <utf8 file>`; for scripts, a real `.mjs` file, never `node -e`.
- **`gh api --input -`** (stdin) fails from PowerShell (UTF-16 → "Problems parsing JSON") — use a UTF-8
  (no BOM) temp file + `--input <file>`.

### Line-ending hygiene (`.gitattributes`)

The repo ships a root **`.gitattributes`** with `* text=auto eol=lf` (+ `.bat`/`.cmd` `eol=crlf`,
explicit `binary` for images/fonts/media). It forces LF in the working tree on every platform
regardless of each machine's `core.autocrlf`, so LF-expecting formatters (Prettier) stop flagging
phantom "modified" files. **This project already has it** — see [`.gitattributes`](../../.gitattributes).
(The residual CRLF-noise note in [`working-agreements.md`](working-agreements.md) §D predates the
attribute file and is kept as historical context / a switch-branch safety tip.)

## Verify (is it being followed?)

- [`../../CLAUDE.md`](../../CLAUDE.md) names PowerShell + file tools and forbids the bash sandbox
  (Build/Run + landmines) — present.
- A root `.gitattributes` with `* text=auto eol=lf` (+ `.bat`/`.cmd` CRLF, binaries) exists — present.
- The working tree isn't drowning in CRLF-only "modified" noise after a formatter run.
