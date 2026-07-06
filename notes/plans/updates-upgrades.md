# Updates & Upgrades — design brainstorm (pre-3.0)

_Status: **Phase 1 (check-and-notify) SHIPPED; Phase 2 (full desktop auto-install) SCAFFOLDED,
dormant.** The lowest-fragility rung — a dismissible "update available" banner that compares the
built-in version to the latest GitHub release, edition-aware — is live for every local/desktop
edition (Option 1 below). The full Tauri in-app auto-installer (Option 2) is wired but gated off until
the owner adds a signing keypair; the exact finishing steps are in
[`../reference/desktop-updater.md`](../reference/desktop-updater.md). The manual paths below still
apply everywhere until Phase 2 is turned on. Auto-upgrade remains **mandatory-before-3.0**._

## The problem

There is no single "update" story because there is no single way people run this. The same codebase
reaches users as: the **hosted online edition**, a **self-hosted online bundle**, a **git checkout**, a
**desktop installer** (possibly an *old* installer), or a **portable** build. An update mechanism has to
be **case-aware**, **non-destructive** (never eat a user's settings, gallery, or — for a git user —
their working tree), **stable, not hacky**, and **minimum-effort** for the user. Getting this wrong
(e.g. a botched in-place upgrade that half-merges an old folder layout) is exactly the fragility to
avoid.

## What's already safe (the invariant to preserve)

The desktop shell already separates **code** from **user data**: on a version change it refreshes the
bundled code/content but preserves `output/`, `user-settings.json`, and `results.json` (see
[`../systems/desktop.md`](../systems/desktop.md)). Any future updater must keep this invariant: **an
update replaces code, never user data.** The online editions store everything in the browser
(`rap.store.*` localStorage), which a redeploy never touches.

## Per-edition update paths

| Edition | Update today (manual) | Future auto path (to design) |
|---------|----------------------|------------------------------|
| **Hosted online** (prompt.fairyfox.io) | Nothing to do — a reload gets the latest deploy. | n/a (already always-latest). |
| **Self-hosted online bundle** | Re-download `…-online.zip` from Releases, redeploy static files. | Optional: a small "new version available" banner (compare built-in version to the latest GitHub release tag). |
| **git checkout** | `git pull` → `npm install` → rebuild. | An in-app / CLI **"update from git"** that runs `git pull --ff-only` (+ `npm install`, rebuild) **without ever clobbering** the working tree — refuse/stash if dirty, never `reset --hard`. Using git *as* the update transport means it just updates the repo as requested and can't corrupt it. |
| **Desktop installer** | Download + run the newer installer (it upgrades in place; user data preserved). | Full auto-update (see below): check → download the new installer/package → install → relaunch. |
| **Portable** | Download the newer portable zip, unzip over (or beside) the old one; copy `data/` across if desired. | "New version available" notice + one-click download; portable stays deliberately self-contained. |

## Options for the desktop auto-update

1. **Check & notify (lowest fragility).** On launch, compare the built-in version to the latest GitHub
   release tag; if newer, show a dismissible "Update available → download" banner linking to the
   release. No signing keys, no in-place mutation, essentially nothing to break. Good first step.
2. **Full auto-update (Tauri updater plugin).** In-app "update → install → relaunch". Smoothest UX and a
   standard isolated plugin, but needs a **dedicated updater signing keypair** (public key in
   `tauri.conf.json`, private key signs each release in CI) and a hosted `latest.json` manifest. If it
   ever fails, the app still runs and falls back to manual. This is the eventual target for installed
   builds.
3. **git-based self-update** for the checkout edition, as above — attractive because it reuses a tool
   the user already trusts and updates the repo *as a repo* (no bespoke patcher).

## Open questions to resolve before building

- One unified "Check for updates" entry point in the UI that dispatches by **detected edition**
  (installed vs portable vs git vs online), so the user never has to know their install type.
- How the app **detects its own edition** at runtime (a build-stamped marker: `installer` / `portable` /
  `git` / `online`).
- Where `latest.json` lives (GitHub Release asset vs fairyfox.io) and how it's signed.
- "Update" (same major, safe) vs "**upgrade**" (major/breaking, e.g. → 3.0) — should a major bump prompt
  differently, show release notes, or gate on explicit confirmation?
- Rollback / recovery if an update fails mid-flight (the desktop shell's versioned working-copy already
  gives a natural fallback: keep the previous working copy until the new one is proven).
- Data/format **migrations** across versions (the server already runs `runStartupMigrations()` — the
  updater should let it own schema/layout changes rather than the updater touching user files).

## Guardrails (must hold for any implementation)

- Never destructive to user data or a user's git working tree; prefer refuse-and-report over force.
- Contained + reversible: an update failure must never break the *running* app — always leave a working
  fallback (previous working copy, or the other editions).
- No silent background mutation without consent; the user initiates or explicitly opts in.
- Verified artifacts only (signature/provenance checks before installing a downloaded build).
