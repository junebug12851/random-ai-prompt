---
date: 2026-07-05
procedure: adopting-updates
node: random-ai-prompt
outcome: completed
hub_version: 0.14.3
hub_commit: 63fef52
---

# Process Report — adopting-updates, 2026-07-05

> A full, honest account of running a fairyfox system procedure. The point is to
> improve the system — so say what was rough even if the run succeeded. Voice: direct,
> matter-of-fact, no hype. Standard: `hub/standards/process-reports.md`.

## Outcome in one line

Adopted the updated docs-site chrome (header/footer/submenu) and the redesigned reader menu into the
project doc-theme, migrated to the versioned reader key `fairyfox:reader:b`, and aligned the reading
defaults to the hub. Completed and verified.

## What was done

1. Refreshed the read-only hub clone at `assets/references/fairyfox.io/`. `git pull --ff-only origin dev`
   aborted because hub `dev` had been force-pushed (diverging) — took the documented fallback
   (`git fetch` + `git reset --hard origin/dev`) **on the reference clone only**. Landed at `63fef52`,
   site version `0.14.3`.
2. Read the express-authorization ledger (`hub/authorizations.yml`). The standing
   `adopt-standards-by-default` entry covers `hub/standards/` + `hub/templates/`, so this adoption is
   pre-authorized: applied directly, skipping only the check-report-wait pause. Every other safety step
   still ran.
3. Studied the source of truth: `hub/standards/docs-site/` (README, `05-navigation`, `02-design-tokens`,
   `reference/chrome.html`, `reference/main.css`) and the live hub reader `assets/js/reader.js`.
4. Located the project's implementation (`assets/docs-theme/`: `modules/reader.js`, `modules/chrome.js`,
   `theme/reader.css`, `theme/chrome.css`, `theme/tokens.css`, `theme/base.css`).
5. Ported the new reader (icon theme tiles + Auto, accent swatches, size slider, panel head/foot) into
   the project module, keeping the `loadAndApply()`/`initReader()` split and `el` helper. New key
   `fairyfox:reader:b`. Replaced `theme/reader.css` with the new panel design, mapped onto the project's
   existing `var(--*)` tokens (all present).
6. Synced the chrome: primary nav → fixed mesh-wide set (added Games, removed Downloads from *primary*;
   Download kept in the subnav), footer Explore column matched, reader button moved to after the nav
   (`.nav{margin-left:auto}` + btn margin `.5rem`).
7. On the follow-up request ("same defaults as main hub"), aligned the CSS resting defaults to the hub:
   `html 16.5px`, `body 1rem`/`var(--reading-lh)`, `--reading-lh 1.65`, `--reading-fs 1rem`, width
   `46rem`.
8. Verified before and after (see Environment/Verify below). Fixed a stale nav list in
   `notes/reference/documentation.md`; wrote changelog + session entries; bumped `VERSION` +
   `package.json` to `2.43.1` (PATCH).

## What went well

- The ledger made the authorization decision unambiguous — the standing grant clearly covered a
  standards adoption, so no redundant prompt.
- The docs-site standard's `reference/chrome.html` + `main.css` snapshots plus the live `reader.js` gave
  an exact target; the project module already mirrored the hub's vanilla reader closely, so the port was
  a clean structural swap rather than a rewrite.
- The project already carried the full accent-token family (`--accent`/`--violet`/`--accent-ink`/`--link`
  /`--glow`), so the new accent feature worked with no token additions.
- The `--ff-only` → `reset --hard` fallback is spelled out in this project's CLAUDE.md, so the
  force-pushed hub `dev` was a non-event.

## What went wrong / friction

- **`file://` is blocked by the browser extension**, so the built doc-site couldn't be opened directly
  for the visual check. Had to stand up a tiny local static server to serve `docs/jsdoc/` over http.
  Minor, but worth noting for anyone doing a visual verify of a generated docs site.
- **Root-font-size vs `--reading-fs`.** The new hub reader scales `<html>` font-size directly, while the
  project historically drove a `--reading-fs` content var. These coexist fine, but the "same defaults"
  follow-up was needed to reconcile the resting values (`1.8`→`1.65` line-height, `1.05rem`→`1rem`
  content, add `html{font-size:16.5px}`). The standard describes the *reader's* defaults well but doesn't
  spell out the **base/token resting values** a project should adopt for a JS-disabled / first-paint
  match — I had to derive `16.5px` / `1.65` / `46rem` from `reference/main.css` and `02-design-tokens`.
- **Downloads vs Games in the primary nav.** The project had `Downloads` in the primary nav; the standard
  says the primary set is fixed (`…Games…`) and project links belong in the submenu. This was drift, not
  a sanctioned divergence, so I synced it — but a project maintainer could reasonably have read it as
  intentional. The standard is clear once found (`05-navigation`), but the "what counts as a sanctioned
  divergence" line is a judgment call each time.

## Suggestions / feedback

- The docs-site `reference/` could include a short **"base/token resting defaults" block** (or a line in
  `02-design-tokens`) stating the exact `html font-size`, `body font-size`/`line-height`, and the
  `--reading-*` default triple a project should set — so "match the hub defaults" doesn't require
  reverse-engineering `main.css`. (Tie: the "same defaults" friction above.)
- `09-adopting-and-maintaining` could name the common **primary-nav drift** case explicitly (e.g. a
  project that added a project-specific item to the *global* nav) and say the fix is "move it to the
  submenu", to remove the per-run judgment call.

## Environment

- **Repo/stack:** `random-ai-prompt` — Node 24, ES modules. The doc-site theme is hand-authored vanilla
  JS/CSS under `assets/docs-theme/`, layered onto a docdash/JSDoc generator via `npm run docs`; the
  reader/chrome are injected client-side. This made the port a faithful hand-reimplementation (the
  standard's intended model), not a file copy.
- **OS/shell:** Windows, PowerShell (per the project's standing "use PowerShell, not the bash sandbox"
  rule). Git ops and builds run from the repo root.
- **Branch model on arrival:** git-flow; this change went on `dev` as an ordinary PATCH.
- **Verify:** `npm run lint` (eslint + stylelint) green; `npm run docs` builds 651 pages; `npm run smoke`
  + `npm run check:docs` green. Live browser check on the built site: header/subnav correct, reader panel
  matches the master design, `fairyfox:reader:b` written on interaction (old key null), theme/accent/size
  apply live, and a fresh-visitor (cleared-storage) load computes root `16.5px` / body `16.5px` /
  line-height `1.65` / `--reading-fs 1rem` / width `46rem` — matching the hub. JSDoc emitted its usual
  pre-existing non-fatal type-expression warnings (unrelated React source); the build treats them as
  non-fatal.
