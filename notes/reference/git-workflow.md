# Git Workflow

## Branch model

- **`master`** — stable. Don't commit here without an explicit go-ahead. (The repo's default branch is
  `master`; there is also a remote `dev`.)
- **`dev`** — where ongoing work lands. Commit early/often here and `git push origin dev`.

The 2.0.0 modernization work is being committed on **`dev`** per the owner's instruction.

## Commit style

- Focused, present-tense `type: summary` messages (e.g. `build: migrate to ES modules + Node 24`,
  `chore: add eslint + prettier`, `docs: add notes system`).
- **Stage specific files** (`git add <paths>`), never `git add -A` / `git add .`.
- The changelog entry for a substantive change rides **inside the same commit** (top of
  `notes/version/YYYY-MM.md`) — see [`../version.md`](../version.md).
- Bump `VERSION` **and** `package.json` in the same commit when the change warrants it — see
  [`versioning.md`](versioning.md).

## Hard safety rules (absolute)

- Never `git push --force` / `--force-with-lease`.
- Never rewrite pushed history (`rebase` of pushed commits, amend of pushed commits).
- Never `git reset --hard`, `git clean -fd`, or delete a branch without an explicit request.
- Inspect `git status` **before and after** every git operation.
- Don't commit user data / runtime artifacts: `user-settings.json`, `results.json`, `output/`,
  `node_modules/` (all gitignored).

## Typical loop

```
git status
git add <specific files>            # incl. the notes/version entry + VERSION/package.json if bumped
git commit -m "type: summary"
git push origin dev
```
