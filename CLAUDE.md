# random-ai-prompt — AI Context

An open-source generator for AI image and text prompts that automatically builds richer, more
detailed prompts than most people write by hand, then runs them through 40+ models (Midjourney,
DALL·E, Gemini, FLUX, Stable Diffusion, and more). Node.js (ES modules). By junebug12851.

**This is a single project at the repo root, organized as an engine + build targets.** An isomorphic
prompt **engine** (`engine/`) authored in the **DPL** dynamic-prompt language powers one or more **build
targets** under `targets/`, with SFW/NSFW gating. As of 2026-07-06 the tree was restructured from the old
`src/` + `gui/` split into this **engine/ + targets/** shape (see the changelog). The old pre-revival
system (the 2022–2023 CommonJS yargs CLI + Express/Pug web UI) has been removed from the tree; it lives in
git history and as a read-only reference clone at `assets/references/og-pre-revival-2023-04-07-241a148/`.

**Repository layout (every path below is relative to the repo root):**

- **`engine/`** — the isomorphic prompt engine: `engine/core/` (the DPL engine + stages + the two
  isomorphic loaders), `engine/helpers/`, and the manifest/settings/content-safety modules
  (`engine/listManifest.js`, `engine/settings.js`, `engine/contentSafety.js`, …). The engine **owns its
  content**: `engine/data/` holds all prompt content — `engine/data/lists`, `engine/data/presets`, the raw
  `engine/data/sources/` CSV/JSON, and the `{#name}` dynamic-prompt generators under
  `engine/data/dynamic-prompts/`. The **one deliberate exception** to "engine code is `.js` modules" is
  `engine/data/dynamic-prompts/`: those generators are executable `.js` authored as prompt *content* (like
  lists), so they live under `engine/data/`. (Expansions are deprecated, superseded by dynamic prompts.)
- **`targets/`** — the build targets that consume the engine. **`targets/web/`** is the React/Vite web
  target (ONE npm package): `targets/web/frontend/` (the SPA — was `gui/src`), `targets/web/backend/` (the
  `/api` server — was `gui/server`), and `targets/web/shared/` (the provider adapters shared by both — was
  `gui/providers`); its Vite/build config sits at the `targets/web/` package root. **`targets/desktop/`**
  is the Tauri desktop shell (its own package; wraps the built local web target — was `gui/src-tauri`).
  **`targets/shared/`** is reserved for code shared across targets. A **`targets/cli/`** target is planned
  next (the engine is already headless/isomorphic); there is **no CLI yet**.
- **`user/`** — the repo-root **universal override overlay** (sibling of `engine/` and `targets/`):
  `user/lists` and `user/blocks` (dynamic prompts) override the built-in `engine/data/` content USER-WINS.
- **`scripts/`** (build/meta scripts), **`tests/`** (the Node engine test suite; the web target has its
  own tests under `targets/web/tests/`), and **`notes/`** (the docs system). Runtime/user data
  (`output/`, `user-settings.json`, `results.json`, and the local `user/settings/` store) stays out of git.

Note: the dev server (`npm run web`) is a **development-only** tool. End users run the built local
**desktop** target (the production local edition) or the hosted **web** build — never the dev server.

## Start Here

Read `notes/status.md` first — current health, what works, what's next.

The full notes system is in `notes/`, organized by topic:

| File | What's in it |
|------|-------------|
| `notes/status.md` | **Current state** — build/run health, open issues, immediate actions. Start here |
| `notes/sessions/` | **Session logs**, one file per day in month folders (`YYYY-MM/YYYY-MM-DD.md`) — the day-by-day story of what changed and why. `sessions/README.md` defines the system |
| `notes/version.md` | **Changelog** — plain-English, one entry per commit (index; months under `notes/version/`). NOT the version-number scheme (that's `reference/versioning.md`) |
| `notes/context/project.md` | What the project is, what it does, its goals |
| `notes/context/architecture.md` | Codebase layout, the two entry points, the prompt pipeline, data flow |
| `notes/context/principles.md` | Project philosophy — what to do and what to avoid |
| `notes/context/history.md` | The 2022 origins and the 2026 ESM modernization |
| `notes/systems/` | **System map** — `README.md` (hub) + `overview.md` (the machine end-to-end) and per-layer deep-dives: `core-engine.md` (the isomorphic `core/` engine), `cli.md`, `server.md`, `gui.md`. Start here to understand how it fits together |
| `notes/reference/esm-patterns.md` | **The Node/ESM landmine catalog** — CJS→ESM gotchas hit during the migration (import ordering vs `process.chdir`, `require(ESM)` for config-driven plugin loading, default vs named exports, JSON imports, dropping `node-fetch`). Read before touching module wiring |
| `notes/reference/dependencies.md` | Every runtime/dev dependency, why it's there, and the breaking-change notes for the current majors |
| `notes/reference/fix-patterns.md` | Error → fix lookup table |
| `notes/reference/documentation.md` | **The doc-site** — generating the JSDoc site (`npm run docs` → code API + the notes wired in as tutorials), and the JSDoc comment house-style. Read before adding a note page |
| `notes/reference/deployment.md` | **Releases / CI** — the GitHub Actions pipelines (`ci.yml`, `pages.yml`, `release.yml`), the version gate, and the Netlify gui deploy |
| `notes/reference/git-workflow.md` | Branch model + commit style + hard safety rules. Read before any git op |
| `notes/reference/repo-hygiene.md` | **Keeping the repo from rotting** — the guards against uncommitted files, doc drift, and branch litter (`check:docs`, `check:tidy`, auto-delete-on-merge) and the rules they enforce |
| `notes/reference/versioning.md` | Version-number scheme — SemVer, the `VERSION` file, keeping `package.json` in sync |
| `notes/decisions/architecture.md` | Key structural choices and why |
| `notes/decisions/rejected.md` | Things tried/considered that were rejected — don't repeat |
| `notes/plans/next-steps.md` | Ordered task list |
| `notes/plans/testing.md` | Testing reality (there is no automated suite yet) + how verification is done today |
| `notes/plans/future.md` | Longer-term ideas |

## Critical Things Not to Get Wrong

- **This is ES modules (`"type": "module"`).** Every relative import needs its **file extension**
  (`./foo.js`, not `./foo`). There is no `require`/`module.exports`/`__dirname`/`__filename` — use
  `import`/`export`, `import.meta.url`, `import.meta.dirname`. See `reference/esm-patterns.md`.
- **Content paths resolve two ways — keep both working.** The dynamic-prompt loaders resolve
  **module-relative** via `import.meta.url` (`engine/core/nodeLoader.js` does
  `fileURLToPath(new URL("../../", import.meta.url))` → the repo root, since `engine/core` is two below it;
  `browserLoader.js` uses a Vite glob), so they don't depend on the cwd. The list/preset settings, by
  contrast, are **cwd-relative** (`engine/settings.js`: `listFiles: "./data/lists"`,
  `presetFiles: "./data/presets"`), so they only resolve when the process runs from the **repo root** —
  which npm scripts always do (the package root is the repo root). There is no `chdir` shim: just run
  everything from the repo root. See `decisions/architecture.md`.
- **There are TWO content roots — `data/` (app built-ins) and `user/` (the user overlay) — merged
  USER-WINS.** As of 2.46.0 a repo-root `user/` folder (`user/lists`, `user/blocks` = dynamic prompts,
  `user/settings` = the local per-namespace store) sits beside `data/`; the app watches both. Both
  engine loaders scan two roots per pool (`engine/core/nodeLoader.js` reads `[user, data]`, first hit wins;
  the browser keeps names at first paint from lazy globs in `browserLoader.js` and loads user *content*
  from a separate code-split `engine/core/browserUserCatalog.js` overlaid last). A user file of the same
  name **overrides** the built-in; a new name adds. The overlay is **local/desktop only** — gated OFF
  the online build via `VITE_ONLINE` (user chunk not imported, user names dropped), so the hosted
  bundle carries no user content. In Manage (`targets/web/backend/manageFs.js`), `user-lists`/`user-blocks` are
  separate roots grouped on top; the runtime **snapshot merges** them onto the built-in pools (user-wins)
  so live generation honors the overlay, but tree/fs-ops stay per-root so edits land in `user/`. User
  content has no upstream — `restoreFromRepo` REFUSES user roots (a 404 would delete the file) and
  ghost/"restore default" is suppressed. The desktop shell seeds `user/` once and preserves it across
  upgrades. NOTE this repo-root `user/` overlay is distinct from the `engine/data/dynamic-prompts/user/`
  category (the `{#user-name}` alias). See `user/README.md`.
- **Config-driven plugin loading uses `createRequire`, on purpose.** Dynamic prompts and prompt
  modules are loaded by a runtime path, synchronously, inside string-replace callbacks. Node 24 can
  `require()` ES modules synchronously, so `createRequire(import.meta.url)` is the correct tool — do
  **not** try to convert these to `await import()` (the call sites are synchronous and can't be made
  async without rewriting the prompt pipeline). The loaded module is a namespace: call `.default(...)`
  and read `.full` / `.suggestion_exclude` as named exports. See `reference/esm-patterns.md`.
- **Dynamic prompts live FLAT under `engine/data/dynamic-prompts/<category>/` (the documented `src/`→`data/`
  exception).** As of 2.7.1 there are **no version generations** — v1/v2 were deleted in 2.7.0 and the
  `v3/` wrapper + the `{#v1/}`/`{#v2/}`/`{#any-ver}` routing were stripped, leaving one flat catalog.
  Generators are sorted into category folders (`{scene,subject,fragment,style,prompt,expansion,user}/`;
  `prompt/` is `_force-prefix`ed) and written **`{#name}`** (brace-delimited like `{list}`; the bare
  `#name` form is gone — folders are organization only, **never** `{#folder}` groups). `{#name}` resolves
  by **path suffix** (the shared `resolveName`, same as lists), so refs stay short and folder-independent;
  `{#user-name}` is a back-compat alias for `user/`. A category folder with 2+ generators is an implied
  **pick-one group** (`{#scene}` runs one random scene generator; `.group` files +
  `_enable/_disable-group-list` markers work too); `{#any}` / `{#any-sfw}` / `{#any-nsfw}` pick one
  generator from the whole catalog (the unit is one GENERATOR, never a line union). NSFW gating is
  automatic by name token (`isGatedDynPrompt`). The resolver is the core engine
  `engine/core/stages/dynamicPrompt.js` (one flat pool) over the two isomorphic loaders —
  `engine/core/nodeLoader.js` (fs + `createRequire`) and `engine/core/browserLoader.js`
  (Vite `import.meta.glob("../../engine/data/dynamic-prompts/**/*.js")`).
- **Generator imports are depth-sensitive — verify with both gates after any move.** A `<category>/`
  generator reaches `src/` via `../../../engine/helpers/…` (and `../../../engine/promptFilesAndSuggestions.js`)
  and imports siblings across categories by relative path (`../fragment/nature.js`). `npm run smoke`
  exercises the Node loader; a broken import in the browser glob only surfaces in
  **`npm --prefix gui run build`** (it bundles everything) — always run **both**.
- **Dynamic-prompt files export a default function + optional `full` / `suggestion_exclude` flags.**
  `export default function (settings, imageSettings, upscaleSettings) {…}`, plus
  `export const full = true;` / `export const suggestion_exclude = true;` where applicable. Keep that
  shape or the loader in `engine/promptFilesAndSuggestions.js` won't classify them. Each generator/folder
  may carry an optional `<name>.json` description sidecar (editor tooltip), regenerated by
  `scripts/dynprompt-meta/write-dynprompt-meta.mjs`; `_`-prefixed files are internal (never generators),
  and a `_force-prefix` folder marker shows its path in the `#token` (all parity with lists/expansions).
- **`engine/helpers/keywordRepeater.js` uses named exports on purpose** (`keywordRepeater`,
  `artistRepeater`) because it's consumed via destructuring — don't flip it to a default export (its own
  header says so). The two built-in list aliases live in `engine/helpers/aliases.js` as named string
  constants (`keywordAlias`, `artistAlias`), kept dependency-free so the dynamic-prompt chain stays
  browser-safe.
- **Never use `node-fetch`.** Node 24 has a global `fetch`; the dependency was removed in 2.0.0.
- **The ONLINE build PRERENDERS its first paint — keep the initial render SSR-safe.** As of 2.38.0 the
  online build (`VITE_ONLINE=true`) runs `targets/web/scripts/build.mjs`: client build → SSR build of
  `src/entry-server.jsx` → `renderToString` → inject into `#root` → `main.jsx` `hydrateRoot`s it (local
  ships `#root` empty → `createRoot`, unchanged). This means **anything rendered on first paint must not
  touch `window`/`document`/`matchMedia`/`localStorage`/… during render** — put browser access in
  effects (they don't run in `renderToString`). Server and client-first render must MATCH: the app boots
  the **default-settings** shell online and stored settings settle in via the two-pass store
  (`cache.onHydrated` + guarded `useSettings`/`useUserThemes` — the save is gated so it never persists
  the transient defaults, or a returning visitor's settings would be wiped). `tests/prerender.test.js`
  (a `node`-env render) is the CI guard; verify hydration is warning-free (Playwright) after any change
  to the initial render tree, the boot, or the cache stores. See `notes/systems/gui.md` +
  `notes/decisions/architecture.md`.
- **Use PowerShell or the file tools (Read/Edit/Write) — not the Cowork bash sandbox.** Bash has
  reported false file truncations on this machine and risks data loss; PowerShell has real, reliable
  access to the repo and Node 24. See `reference/fix-patterns.md`.

## Build / Run / Verify

Node **24 LTS** (`.nvmrc` pins `24`; `package.json` `engines` requires `>=24`). The repo runs on the
local Windows machine; use **PowerShell** to run anything, and **run everything from the repo root**
(that's where the project's `package.json` lives). The `targets/web/` SPA is its own npm package; a root
`npm install` installs it too (via `postinstall`).

```
npm install            # install deps (root + gui, via postinstall)
npm run web            # DEV stage: the Vite dev server (HMR) — for development, not end users
npm start              # RELEASE stage (local edition): build, then serve the built app + /api backend
npm run serve          # serve an already-built local release (node targets/web/backend/serve.js)
npm run lint           # eslint . (flat config; 0 errors expected, warnings are pre-existing)
npm run format         # prettier --write .
npm run format:check   # prettier --check .
npm run check:docs     # fail on broken relative links in the Markdown docs (drift guard; in `npm test` + CI)
npm run check:tidy     # fail on untracked non-ignored files (run before finishing — nothing left uncommitted)
npm run smoke          # the import smoke test (node scripts/smoke-test.mjs)
npm run test:unit      # Vitest (Node): unit/integration/snapshot/regression under tests/
npm run test:web       # Vitest (jsdom): SPA unit/component/contract/integration under targets/web/tests/
npm run test:e2e       # Playwright: E2E/visual/a11y (builds the SPA; needs `npx playwright install chromium` once)
npm run test:e2e:update# refresh the committed visual baselines after a deliberate UI change
npm test               # check:docs + lint + smoke + test:unit + test:web (the headless verification gate)
npm run test:all       # npm test + test:e2e
npm run docs           # build the JSDoc doc-site (code API + notes as tutorials) into docs/jsdoc/
```

- **Editions vs. stages — don't conflate them.** There is **one code pool** that builds into two
  **editions**: the full **local** build and the **online** build (the same code with the local-only
  features — Gallery/Single/Manage, local SD providers, NSFW — gated off via `VITE_ONLINE`). Each
  edition has the usual **dev** and **release** stages. `npm run web` is the **dev** server (HMR) and
  is **not** what end users run. The local edition's **release** stage is `npm start` (build →
  `targets/web/backend/serve.js`), a standalone Node server that serves the built `dist/` **plus** the `/api/*`
  backend. The online edition's release is the static Netlify build (no backend — BYOK calls go
  straight from the browser). The `/api/*` handler lives once in `targets/web/backend/apiHandler.js` and is
  mounted by **both** the dev-server Vite plugin (`targets/web/vite-plugin-api.js`) and the release server, so
  the local backend is identical across stages.
- Generating images requires a **Stable Diffusion WebUI running with `--api`** on the URL in
  `imageSettings.url` (default `http://127.0.0.1:7860`). Without it, prompt generation still runs but
  the image calls fail — that's expected, not a bug.
- There is a **full automated test suite** (added 2.6.0 — see `notes/plans/testing.md`): **Vitest** drives
  a Node-side suite (`tests/`: unit, integration, snapshot, contract, bug-regression) and a jsdom SPA suite
  (`targets/web/tests/`: unit, component/UI, contract, integration), and **Playwright** drives E2E + visual-
  regression + `@axe-core` accessibility specs (`tests/e2e/`). It targets the **active** engine + SPA only;
  the legacy classic server is out of scope (only the pure stages the core engine still imports —
  `cleanup.js`, `prompt-salt.js` — are covered). The **import smoke test** (`npm run smoke` →
  `scripts/smoke-test.mjs`) is retained as the fast gate — it loads `engine/promptFilesAndSuggestions.js` +
  `engine/core/nodeLoader.js` + `engine/settings.js` the way the SPA's Node-side loader boots, forces every
  dynamic prompt to load via `require(ESM)`, and expands a prompt. `npm test` runs lint + smoke + the Vitest suites; the Playwright
  suite is separate (`npm run test:e2e`, browser via `npx playwright install chromium`). The headless
  checks run in CI (`.github/workflows/ci.yml`).
- **Testing landmine:** lodash captures `Math.random` at import, so `_.random/_.sample/_.shuffle` can't be
  RNG-stubbed; tests assert invariants or use single-entry lists, and only the DPL renderer is seeded
  (`tests/helpers/seededRandom.js`). See `notes/plans/testing.md`.

## Default Workflow — Do These By Default (a standing instruction)

After making changes, run this loop without being asked:

1. **Lint + format.** `npm run lint` (fix new errors; pre-existing warnings are fine) and
   `npm run format`.
2. **Verify the module graph.** `node --check` changed files; run `npm run smoke` (or `npm test`) for
   anything touching module wiring, settings, or the prompt pipeline. Only proceed on green.
   - **If you renamed, moved, or removed a file/feature, sweep the docs in the _same_ change.**
     `npm run check:docs` fails on any broken Markdown link (so a link to a removed file turns CI red);
     also `git grep -n "<old-name>" -- "*.md"` and fix current-state prose. Leave dated history
     (`sessions/`, `version/`, `fairyfox-reports/`, `decisions/`, and pages banner-marked *historical*)
     intact. See [`reference/repo-hygiene.md`](notes/reference/repo-hygiene.md).
   - **Before finishing, leave nothing uncommitted.** Run `npm run check:tidy` — it fails on any
     untracked non-ignored file (stray notes/reports/docs). Commit them (fairyfox reports get their own
     commit) or gitignore genuinely machine-local files. Only `/_*.bat|.log|.sh`, `*-private*`, and
     build/runtime artifacts are meant to be untracked.
3. **Commit on `dev` (or a `feature/*` branch).** This project follows the system's **git-flow**
   standard: real features get a `feature/<name>` branch off `dev`, merged back with `--no-ff`; only a
   genuinely trivial change goes straight on `dev`. Stage specific files (never `git add -A`/`.`),
   focused `type: summary` messages, write the changelog entry **inside the same commit** (see below),
   and `git push origin dev` (and feature branches, to back them up).
4. **Keep `VERSION` + `package.json` in sync.** Bump both in the same commit when a change warrants it —
   **PATCH** for a fix/small change, **MINOR** for a feature; never **MAJOR** automatically. Docs / notes
   / test / CI-only commits don't move the number. The release path follows the SemVer level (step 5).
   See `reference/versioning.md`.
5. **Release when green (on go-ahead) — via a PR into `main`, path set by SemVer level.** `main` is the
   stable branch and is **branch-protected**: it accepts changes **only through a pull request** with
   the required CI checks green. Approvals are set to **0**, so you self-merge (there's no second
   reviewer) — but admins are **not** exempt (`enforce_admins`), and force-push + branch-deletion are
   blocked. **Never commit on `main` directly** (the protection now enforces this). Every commit on
   `main` is a **tagged release** reached by a **merge-commit** PR merge (the `--no-ff` equivalent;
   linear history is intentionally off so these merge commits are allowed). A **PATCH** goes
   `dev → main`; a **MINOR/MAJOR** goes through a `release/X.Y.0` branch → `main`
   (see `reference/git-workflow.md`). With the owner's go-ahead, confirm `dev` (or the release branch)
   is green (`gh run list --branch dev -L 1`), then:
   `gh pr create --base main --head dev --title "Release v<VERSION>" --fill` →
   `gh pr checks <#> --watch` (wait for the required checks) →
   `gh pr merge <#> --merge` (a **merge** commit — never `--squash`/`--rebase`; that preserves the
   changelog history and the merge commit `release.yml` keys on).
   **After every release `dev` must CONTAIN `main`** — once the PR is merged, catch `dev` up to the
   merge commit: `git fetch origin && git switch dev && git merge --ff-only origin/main && git push origin dev`
   (`dev` is unprotected, so this push is fine). Skipping this back-merge is what once left `dev` 32
   commits behind `main` (with `main`-only README/docs). A MINOR/MAJOR ends the same way: fast-forward
   `dev` up to `main` after the `release/X.Y.0` PR merges (don't merge the release branch into `dev`
   separately). A scheduled `branch-sync` workflow fails if `main` ever has commits not in `dev`. See
   `reference/git-workflow.md`.
   **Do not tag by hand.** `release.yml` derives `v<VERSION>` and creates the tag itself, gated on that
   tag not already existing — a hand-pushed tag makes the gated run find the tag present and **skip
   itself (a silent no-op release)**. The merge to `main` *is* the release act; CI applies the tag. A
   push to `main` that bumped `VERSION` cuts a GitHub Release (`release.yml`, tag-gated) and refreshes
   the Pages docs (`pages.yml`); watch them with `gh run watch`. See `reference/deployment.md`.
6. **Regenerate the docs after shipping (by default).** After releasing to `main`, run `npm run docs` so
   the generated `docs/jsdoc/` (git-ignored) tracks `main`; CI also rebuilds + deploys it to Pages.

Hard git safety rules are absolute: never `push --force`, never rewrite pushed history, never
`reset --hard`/`rebase`/`clean -fd`/delete a **long-lived** branch (`main`/`dev`) without an explicit
request (spent `feature/`/`release/`/`hotfix/` branches are deleted as the normal end of their merge).
Inspect `git status` before and after. Full standards: `notes/reference/git-workflow.md`.

## GitHub Is Part of Default Management (a standing instruction)

The GitHub CLI (`gh`) is the way to keep GitHub state part of the normal workflow — event-based, not on
a timer. The trigger is **preparing a release to `main`**, not a calendar.

- **When prepping a release to `main`**, do a quick GitHub check: `gh run list` (CI/Pages/release
  health — must be green), plus `gh issue list` and `gh pr list`. If there are open/new/changed issues
  or PRs, surface them as a short summary and **ask whether to work on them now or later** — don't
  silently start.
- **Never auto-act on issues/PRs** (no closing, merging, or pushing to PR branches) without an explicit
  go-ahead — surfacing + asking is the default. Hard git safety rules still apply.
- **Releases are software releases only**, each with a clear auto-composed description; the docs site
  lives on GitHub Pages (not in git, not in a release). See `reference/deployment.md`.

## Keep the Credits Living

`list-credits.md` is the human-readable credits for the prompt lists, data sources, tools, and AI
assistance the project builds on. Keep it current **by default, without being asked** — whenever a new
person, data source, framework, tool, service, or AI assistant contributes, add them under the right
section. (It's the analog of an in-app credits screen; treat it as a living document.)

## Keep the Legal Docs Accurate — Your Responsibility (a standing instruction)

The app's three legal documents live as self-hosted static pages at
`targets/web/public/legal/{privacy,terms,cookies}.html` (linked from `LinksMenu.jsx` below the
`.links-sep` separator; contact address `fairy@fairyfox.io`). They were rewritten to describe **what the
app actually does** — no accounts, no analytics/cookies/tracking, settings + bring-your-own API keys
stored only on the user's device (`rap.store.` localStorage / local files), prompts + keys sent directly
from the device to the chosen provider (no server relay — providers that can't be called directly from a
browser are locked out of the web build), and Netlify as the hosting processor. Fonts are **self-hosted**
from `targets/web/public/fonts/`
(no Google Fonts request), so the chosen AI provider + the Netlify hosting logs are the only third-party
data flows. They cover web + desktop + the future mobile/Android build; age is 18+ (desktop NSFW
capability).

Keep them accurate **by default, without being asked** — they are a living compliance surface, like the
credits and the notes. **Whenever a change touches the app's data practices, re-read the three pages and
update them in the same change** (and bump their "Last updated" date). Concretely, treat these as
triggers to re-check the docs: adding/removing an analytics, telemetry, error-reporting, or A/B tool;
introducing any cookie or server-side storage of user data; adding/removing a third-party network
dependency (fonts, CDNs, providers) or a new provider/proxy path; changing what's stored locally or how
keys are handled; adding accounts/auth; shipping the mobile app or app-store distribution; or changing
hosting. If a change makes a statement in the docs untrue, fixing the docs is part of that change — not a
follow-up. When unsure whether a change is material, flag it and ask. (Not legal advice; for high-stakes
changes recommend a real review.) Fonts are now self-hosted (`targets/web/public/fonts/`, sourced from the
`@fontsource` packages), which removed the former IP-to-Google transfer — if you ever re-add a CDN font
or any other third-party request, update the docs to disclose it.

## Maintaining the Notes — Your Responsibility

The notes are a **living document**. Keep them current as you work — don't wait to be asked.

| Trigger | Action |
|---------|--------|
| Did work worth recording this session | Append to today's `notes/sessions/YYYY-MM/YYYY-MM-DD.md` (create the file/month folder if it's the day's first entry; newest on top) |
| Made a substantive commit | Write its plain-English entry at the top of `notes/version/YYYY-MM.md` and stage it in the **same commit** (no separate "document the commit" commit) |
| Build/run health or open issues changed | Update `notes/status.md` (current-state only) |
| Fixed a compiler/runtime error | Add a row to `notes/reference/fix-patterns.md` |
| Hit a CJS→ESM / Node landmine | Add to `notes/reference/esm-patterns.md` |
| Changed/added/removed a dependency | Update `notes/reference/dependencies.md` |
| Studied a layer in depth | Update the matching `notes/systems/*.md` deep-dive (and add JSDoc per `notes/reference/documentation.md`) |
| Made / rejected a structural decision | `notes/decisions/architecture.md` / `notes/decisions/rejected.md` |
| Finished or unblocked a task | Update `notes/plans/next-steps.md` |
| Changed how docs / CI / releases work | Update `notes/reference/documentation.md` / `notes/reference/deployment.md` |
| Changed the app's data practices (analytics, cookies, storage, keys, providers, third-party deps, hosting, accounts, new platform) | Re-read + update the three legal pages in `targets/web/public/legal/` in the **same change** and bump their "Last updated" date. See the "Keep the Legal Docs Accurate" standing instruction above |
| Created/renamed a Markdown note | Nothing extra needed — `scripts/build-docs.mjs` auto-discovers every `notes/**.md` and wires it into the JSDoc doc-site (hierarchy mirrors the folder tree). Keep cross-links relative (`[x](../reference/foo.md)`) so the build rewrites them to tutorial links |
| **Renamed, moved, or removed a file/feature** | **Sweep the docs for stale references in the _same_ change.** `npm run check:docs` fails on broken links; `git grep -n "<old-name>" -- "*.md"` for prose. Fix current-state docs; leave dated history intact. See [`reference/repo-hygiene.md`](notes/reference/repo-hygiene.md) |
| A version is warranted | Bump `VERSION` **and** `package.json` in the same commit |
| Ran a fairyfox system procedure (check/adopt updates, setup, onboarding) | Write a process report in `notes/fairyfox-reports/YYYY-MM-DD-<procedure>.md` — even a check-only run — **and commit it** (its own commit is fine; never leave it untracked). See `notes/reference/process-reports.md` |
| **Finishing a work session** | Leave nothing behind: `npm run check:tidy` (no untracked non-ignored files) and confirm the remote has only `dev`/`main` + active branches. See [`reference/repo-hygiene.md`](notes/reference/repo-hygiene.md) |

If something doesn't fit an existing file, make a new one in the right folder. The goal: any AI (or
human) opening this repo cold can read the notes and be fully oriented — nothing trapped in one
person's head, nothing lost between sessions.

## Cross-project standards & checking the fairyfox system for updates

This project is a **node in the fairyfox system** (the hub mesh): it pulls shared standards from the
system on request — see `notes/reference/cross-project-sync.md`. The read-only system clone lives at
`assets/references/fairyfox.io/` (git-ignored, never committed); its `hub/standards/` and
`hub/templates/` are the canonical sources this project reconciles in.

**When the user asks you to check *the fairyfox system* for updates** — to sync the standards, get the
latest version, or pull a particular standard/runbook — treat it as the check-for-updates flow. **To
invoke it the request must carry the word "fairyfox"** — normally **"the fairyfox system"**, or a
*fairyfox*-prefixed variant ("fairyfox.io", "fairyfox standards") — *paired with* an update/sync intent
(check for updates · what changed · sync · refresh · pull the latest · get the newest). Generic handles
— "the hub", "the mesh", "the standards", a runbook name, a bare "system", or an update verb alone — do
**not** qualify; the word *fairyfox* must be present, or don't assume this flow.

The default is **check, report, then wait**: refresh the read-only system clone under
`assets/references/fairyfox.io/` (`git -C assets/references/fairyfox.io pull --depth 1 --ff-only origin
dev`; if hub `dev` was force-pushed and `--ff-only` aborts, `git fetch` + `git reset --hard origin/dev`
on the **reference clone only**), diff it against what this project has adopted, and **report what
changed + what adopting it would touch — then stop.** Apply nothing until the user clearly says go
ahead; applying is a separate, confirmed act. Full procedure: the shared `adopting-updates` runbook (in
the clone's `hub/standards/`).

**Exception — pre-authorized changes (the express-authorization ledger).** The system keeps an
express-authorization ledger at `hub/authorizations.yml` (read it from the read-only clone like any
other hub artifact). If an **active** entry there `covers` the change being adopted, the user **already
gave the go-ahead at the system** — apply it directly, skipping *only* the "check-and-report-then-wait"
pause. Skip nothing else — **the verification floor is never skipped**: still copy-not-clobber, still
**re-prompt before overwriting a deliberate local divergence**, still write the process report, still
commit as a reviewable act, and still run **full verification — build/tests + the standards'
`## Verify`/compliance checks + project-constraint checks, before _and_ after the apply**. A
pre-authorization (like any automated apply) removes one redundant confirmation, never the safety floor:
**if full verification can't be completed, do not auto-apply — fall back to check-report-wait.**
If nothing in the ledger covers the change (or its entry has `expires`d), fall back to the
check-report-wait default. Reading the ledger lets a node skip a redundant prompt; it never lets the
system reach in and act — anti-recursion holds. **An unattended/scheduled check still applies nothing**
(it reports and waits) regardless of the ledger — a pre-authorization shortens an *interactive* adopt,
it doesn't turn a check-only run into a self-adopt.

**Every fairyfox run ends with a process report** — write one in `notes/fairyfox-reports/`
(`YYYY-MM-DD-<procedure>.md`, from the clone's `hub/templates/fairyfox-report.md`), **even a
check-only run.** It's an honest account of what the run did and where the procedure was rough; the hub
reads these (read-only, on request) to improve the standards. See
`notes/reference/process-reports.md`. The recurring whole-set check that this project still follows
every adopted standard is the **compliance audit** (`notes/reference/compliance.md`) — on request,
report-only.

**Guardrails (don't break these):** on-request only — never auto-pull or schedule cross-repo syncs
(anti-recursion); the reference clone is read-only and git-ignored (the `hub/authorizations.yml` ledger
included — reading it lets you skip a redundant prompt, it never lets the system act on this repo);
never apply changes or rewrite history without an explicit go-ahead (an active `authorizations.yml`
entry that covers the change *is* that go-ahead, given at the system); reconcile with local edits, don't
clobber them. **Stay inside this repo only** — never edit or push to another repo (including the hub `junebug12851.github.io`); when a
hub-side change is needed (e.g. a `registry.yml` correction), **report it for the owner to make**, don't
do it here.

> Naming: the user calls it **the fairyfox system** in conversation; the public website calls it the
> **hub**. Both name the same fairyfox.io mesh.

## Project Preferences

- Keep the app feeling like polished software, not a dev tool.
- Don't silently swallow errors; surface them. Never corrupt or lose a user's generated images or
  their `user-settings.json`.
- `user-settings.json`, `results.json`, and `output/` are user data / runtime artifacts (gitignored) —
  don't commit them.
