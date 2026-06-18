# Versioning

## The single source of truth

Repo-root **`VERSION`** holds the canonical version string (first non-comment line). **`package.json`'s
`"version"`** is kept in sync with it — bump both in the same commit. (There's no build step wiring them
together the way a compiled project would; it's a manual two-line sync, done together.)

Current: **2.0.0**.

## SemVer scheme

`MAJOR.MINOR.PATCH[-prerelease]`:

- **PATCH** (`2.0.0 → 2.0.1 → …`) — the default. Almost every change: bug fixes and ordinary features.
  Not capped at 9.
- **MINOR** (`2.0.x → 2.1.0`) — a notable feature set or milestone.
- **MAJOR** (`2.x → 3.0.0`) — a breaking change or a stability promise. **The project leader's call
  (junebug12851); never bump automatically.**

2.0.0 itself was a MAJOR bump because the ESM + Node-24 + dependency-major move breaks anyone on an old
Node or relying on the CommonJS module shape.

## How to bump

1. Edit the version line in `VERSION`.
2. Set the same value in `package.json` `"version"`.
3. Commit both together with the change that warranted the bump (and its changelog entry).

Docs/notes-only or test/CI-only commits don't move the number.

> **Don't confuse this with [`../version.md`](../version.md).** This file is the version-*number*
> scheme. `version.md` is the *changelog* (the per-commit narrative).
