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

## Where the number lives (keep these in sync)

| Place | Role |
|-------|------|
| `VERSION` | The canonical number — the only thing a human edits. |
| `package.json` `"version"` | The Node package number — kept equal to `VERSION` in the same commit. |
| `web-app/package.json` `"version"` | The SPA's number — keep it in step with the root when the SPA ships as part of a release. |

There is no compiled `pse_version.h`-style generation here (this isn't a compiled app); the sync is the
manual two-line (three with the SPA) edit above, done in the one commit that warrants the bump. If you
ever add a place that needs the version (e.g. a footer in the web UI), **derive it from
`package.json`** at build time — never add a new hardcoded literal.

## Releases and git tags (the version gate)

Releases are cut by `.github/workflows/release.yml`, gated on the tag **`v<VERSION>`** not already
existing — so a release happens exactly when `master` advances on a commit that bumped `VERSION`:

1. Bump `VERSION` (+ `package.json`) on `dev`, commit with its changelog entry, go green.
2. Fast-forward `master` (the standing workflow). If `VERSION` changed, `release.yml` creates tag
   `vX.Y.Z` and publishes the Release; if it didn't, the tag already exists and the run is a no-op.
3. A `-alpha`/`-beta`/`-rc` label marks the GitHub Release as a **prerelease**.

`workflow_dispatch` with `dry_run=true` builds the artifacts without publishing. The full pipeline is in
[`deployment.md`](deployment.md).

> **Don't confuse this with [`../version.md`](../version.md).** This file is the version-*number*
> scheme. `version.md` is the *changelog* (the per-commit narrative).
