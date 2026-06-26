# Plan — Split into engine-v1-2 (frozen) + engine-v3 (the project)

**Status: core split DONE & verified on `feature/legacy-isolation` (Stages 1–5). Follow-ups below.**
Untangle the repo into two clearly
labeled, fully disconnected trees that share **zero files**:

- **`engine-v1-2/`** — the **literal pre-revival snapshot** (commit `241a148`, 2023-04-07, CommonJS),
  restored as-is. Frozen, untouched, self-contained: its own `package.json` + `package-lock.json` +
  `webui.bat`/`update.bat`, and `web/` contained inside it. It is **bulk code on its way out** — kept
  runnable until deleted, but NOT a maintained project (no CI, no VERSION, no release flow of its own).
- **`engine-v3/`** — **the** project. The new system (core engine + SPA) relocated here, self-contained,
  with the project's `package.json` / configs / CI pointing at it. Root becomes a thin wrapper.

Locked decisions (owner, 2026-06-25):
- **Single project.** Only `engine-v3` is developed/maintained/released. `engine-v1-2` is frozen bulk.
- **engine-v1-2 = pre-revival restore from git history** (not the current ESM-migrated legacy). The current
  transitional legacy code in `src/` (classic server, CLI, old `prompt-modules` stages, `common.js`,
  image/upscale/animation, `src/web/`) is **deleted** from the project — the old system is preserved by the
  `engine-v1-2` snapshot, so the in-between version is redundant.
- **engine-v3 keeps the `v1`/`v2`/`v3` dynamic-prompt subfolders**, but v1/v2 generator code (unchanged) is
  reorganized and re-wired to the **new** keyword lists + SFW/NSFW gating — same output, new plumbing.
- **No expansions in engine-v3** (already moved to dynamic prompts + removed from the SPA UX).
- **Zero shared files** between the two trees.
- Root **README** must tell users where old (`engine-v1-2`, complete/frozen) and new (`engine-v3`, active)
  live, and that the old is complete.

## Target layout
```
random-ai-prompt/
├── engine-v1-2/      pre-revival snapshot — frozen, self-contained (DONE)
├── engine-v3/        THE project: src/core/, web-app/, data/ (dynprompts v1/v2/v3 + new lists, NO expansions),
│                     tests/, scripts/, package.json, vite/vitest/playwright/eslint configs, VERSION
├── notes/            repo-level notes (stay at root)
├── .github/          CI — retargeted into engine-v3/
├── README.md         root: points to both; marks engine-v1-2 complete/frozen
└── .git, CLAUDE.md, fairyfox node
```

## Execution stages (each verified)
1. **DONE** — Restore `241a148` into `engine-v1-2/` (git archive → extract).
2. Scaffold `engine-v3/`; `git mv` the new system in, **preserving relative structure** so sibling relative
   imports stay valid (e.g. `web-app → ../../../src/core`, `data` generators → `../src/helpers/...`). Move:
   `src/core/`, the kernel modules, `web-app/`, `data/` (minus `expansions/`), `tests/`, `scripts/`,
   `package.json` + lockfile, all configs, `VERSION`.
3. **Drop** expansions from engine-v3 (`data/expansions*`, the expansion stage if new engine still imports it
   — verify) and **delete** the transitional legacy `src/` files (preserved in engine-v1-2).
4. Fix root-relative references: CI `working-directory` / `npm --prefix`, `package.json` scripts, the smoke
   test target, doc-site build paths.
5. **Verify both:** engine-v3 → `lint` + `smoke` + `web-app build` + Vitest green; engine-v1-2 → actually
   boots (CLI + classic server) and behaves as before *(caveat: it's CommonJS for older Node + era deps —
   may need its pinned Node/deps; document if so)*. Write the root README.
6. Commit (changelog in the merge commit), merge `--no-ff` into `dev`, delete branch, push.

## Landmines
- `chdir.js` repo-root `".."` math — it's **legacy-only**, rides into engine-v1-2; engine-v3 doesn't use it.
- `data/` generators use relative `../src/helpers/keywordRepeater.js` — fine as long as `data/` and `src/`
  move **together** under engine-v3 (relative depth preserved).
- The smoke test currently boots `common.js` (legacy) — retarget to the engine-v3 core path.
- CRLF noise: the working tree shows mass `M` files with empty `git diff` (`core.autocrlf=true`) — ignore; stage only real changes.

## Follow-ups
Done (2026-06-25): **engine-v3 deps pruned** (removed express/pug/yargs/open/cli-progress/crc — `npm install`
dropped 149 packages, smoke + 84 tests green); **`CLAUDE.md` reframed** (intro + Build/Run scoped to
engine-v3); **`status.md` + `context/architecture.md`** got structure banners; loose ends cleaned (stale
:7861 server killed, stray log removed).

Still open:
- **Deeper notes sync** — `systems/*` (overview/cli/server/web-app/core-engine), the rest of `context/*`, and
  inline `src/…` references throughout still describe the pre-split single tree. Banners added to the entry
  docs; the body reconciliation is incremental.
- **Doc-site paths** — `jsdoc.config.json` (left at root) + `scripts/build-docs.mjs` reference old paths;
  retarget for `engine-v3/` + root `notes/`. (Not gated; the doc-site is git-ignored.)
- **Drop the expansion stage** *(your call — behavior change)* — `engine-v3/data/expansions*` + the core
  `stages/expansion.js` slot in `DEFAULT_ORDER` are still present; removing them changes output (snapshot
  tests), so it's its own verified change.
- **Root `VERSION` / fairyfox node** *(your call)* — decide whether `VERSION` lives at root or in `engine-v3/`,
  and how the fairyfox registry tracks the relocated project. Plus whether to cut a PATCH release to `main`.

## See also
- [`generate-page-triage.md`](generate-page-triage.md) — the Sweep prune this unblocks (trivial once isolated).
- `classic-server-read-only` memory — the standing "old is being deleted" directive.
