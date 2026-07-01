---
date: 2026-07-01
procedure: standard-proposal
node: random-ai-prompt
outcome: proposed-to-hub
hub_version: 0.11.0
hub_commit: 2ffe455
---

# Process Report — standard-proposal (CRLF / `.gitattributes` EOL), 2026-07-01

> A full, honest account of a fairyfox interaction. This one runs the other
> direction: a node proposing a shared standard up to the hub. Voice: direct,
> matter-of-fact. Standard: `hub/standards/process-reports.md`.

## Outcome in one line

This node hit — and permanently fixed — the recurring **CRLF working-tree noise**, and the
owner asked to push the fix up so **every** fairyfox project can stop the same noise. The fix
is a one-file, zero-behavior-change `.gitattributes`. This report proposes it as a hub
standard (or a `templates/project.gitattributes` template). **Nothing was changed in the hub**
— per the anti-recursion guardrails a node never edits the hub; the standard/template authoring
is surfaced here for the owner to make.

## The problem (as seen on this node)

- No `.gitattributes` anywhere in the repo, and `core.autocrlf=true` on the Windows dev machine.
- Consequence: git blobs are already stored **LF** (autocrlf converts on commit), so `git status`
  is clean — but the working tree is checked out **CRLF**. Prettier (`endOfLine: lf`, the default)
  then flags **~178 files** on every local `format:check`. Pure noise: no real formatting problem,
  and CI (Linux/LF) never sees it.
- It has been a standing annoyance on this node — recorded in working memory as "CRLF working-tree
  noise: ~100+ files show modified but are CRLF-only." Every contributor on Windows re-hits it.

## The fix (what this node did)

Added a repo-root `.gitattributes`:

```gitattributes
* text=auto eol=lf          # force LF in the working tree on every platform
*.bat text eol=crlf         # Windows batch must stay CRLF
*.cmd text eol=crlf
# + explicit `binary` for png/jpg/gif/webp/ico/icns/woff/woff2/ttf/otf/eot/pdf/zip/mp4/webm
# + `*.svg text`
```

Then refreshed the working tree to LF so the noise stops immediately (not just on the next clone).
Blobs were already LF, so this is a checkout-side change only; fresh clones and CI were never
affected. Binary assets verified unchanged (object ids stable). No version bump — infra only.

## Why it's a good hub standard

- **Universal:** any project with a Windows contributor and an LF-expecting formatter/linter
  (Prettier, most JS/CSS tooling) hits this. The mesh already standardizes on Prettier-style tooling.
- **One file, zero risk:** no code or behavior change; `text=auto` auto-detects binaries and the
  explicit `binary`/`eol=crlf` lines are belt-and-suspenders.
- **Self-healing:** `eol=lf` overrides whatever `core.autocrlf` each contributor has set, so it
  doesn't depend on per-machine git config.

## Recommended hub action (for the owner — not done here)

Pick one:

1. Add a `templates/project.gitattributes` to the hub templates (alongside the existing
   `templates/CLAUDE.md` / `project.gitignore`), and have `adopting-updates` copy it into nodes that
   lack one (copy-not-clobber; re-prompt if a node already has a deliberately different one).
2. Or fold a short "line-ending normalization" clause into an existing standard (e.g. the
   ai-context / project-hygiene standard) that says "every repo ships a `.gitattributes` with
   `* text=auto eol=lf` (+ `.bat`/`.cmd` CRLF, explicit binaries)."

Either way the propagation is a hub-authored change the owner makes in `junebug12851.github.io`; this
node only reports it. Suggest also noting the `.bat`/`.cmd` CRLF carve-out and the binary list so
nodes with Windows scripts or committed fonts/images don't get mis-normalized.

## What went well

Root cause was quick to pin (blob-vs-worktree EOL inspection settled it), and the fix is genuinely
tiny and portable — a clean candidate for a shared standard rather than a per-repo one-off.

## What went wrong / friction

- The node's own docs (CLAUDE.md, `notes/reference/cross-project-sync.md`) previously only
  *described* the CRLF noise as a known annoyance and a workaround ("stage explicit paths, use
  `checkout -f` to switch branches") rather than fixing it — the fix was overdue and is exactly the
  kind of thing the hub should have carried from the start.
- There is no defined fairyfox procedure for a node *proposing* a standard upward; I filed this under
  an ad-hoc `procedure: standard-proposal`. If node→hub proposals are a thing the mesh wants (the
  aggressive-upgrade policy on 2026-07-01 was another), the process-reports standard could name the
  shape so these are consistent.

## Environment

Windows, PowerShell via `Windows-MCP` (project rule: no bash sandbox — false-truncation risk;
PowerShell + file tools only). Node 24 ESM project (`engine-v3/`). Hub state cited from the
read-only mirror as last checked this morning (0.11.0 / `2ffe455`); this run did not re-pull the
mirror (not an update check) and made no hub-side change.
