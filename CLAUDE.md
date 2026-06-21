# random-ai-prompt — AI Context

Random AI prompt + image generator for the Stable Diffusion WebUI. Node.js (ES modules) — a
yargs **CLI** (`src/index.js`) and a local **Express + Pug web UI** (`src/server.js`) that share one
core (`src/common.js`). Open source, by junebug12851. Originally CommonJS (2022); modernized to ES
modules on Node 24 LTS in June 2026. **All code lives under `src/`; all prompt content (lists,
expansions, presets, the CSV sources, and the `#name` dynamic-prompt generators) lives under `data/`;
runtime/user data (`output/`, `user-settings.json`, `results.json`) stays at the repo root.** The
**one deliberate exception** to "code lives in `src/`" is `data/dynamic-prompts/`: those generators
are executable `.js`, but they're authored as prompt *content* (like lists/expansions), so they live
with the rest of the content under `data/`. The loaders prefix the `dynamicPromptFiles` setting
accordingly — see "Critical Things Not to Get Wrong".

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
| `notes/systems/` | **System map** — `README.md` (hub) + `overview.md` (the machine end-to-end) and per-layer deep-dives: `core-engine.md` (the isomorphic `core/` engine), `cli.md`, `server.md`, `web-app.md`. Start here to understand how it fits together |
| `notes/reference/esm-patterns.md` | **The Node/ESM landmine catalog** — CJS→ESM gotchas hit during the migration (import ordering vs `process.chdir`, `require(ESM)` for config-driven plugin loading, default vs named exports, JSON imports, dropping `node-fetch`). Read before touching module wiring |
| `notes/reference/dependencies.md` | Every runtime/dev dependency, why it's there, and the breaking-change notes for the current majors |
| `notes/reference/fix-patterns.md` | Error → fix lookup table |
| `notes/reference/documentation.md` | **The doc-site** — generating the JSDoc site (`npm run docs` → code API + the notes wired in as tutorials), and the JSDoc comment house-style. Read before adding a note page |
| `notes/reference/deployment.md` | **Releases / CI** — the GitHub Actions pipelines (`ci.yml`, `pages.yml`, `release.yml`), the version gate, and the Netlify web-app deploy |
| `notes/reference/git-workflow.md` | Branch model + commit style + hard safety rules. Read before any git op |
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
- **`src/chdir.js` must stay imported first in `src/common.js`.** The whole app uses cwd-relative paths
  (`./output`, `./data/lists`, `./results.json`, `./user-settings.json`). Because `chdir.js` now lives
  in `src/`, it does `process.chdir(path.join(import.meta.dirname, ".."))` to pin the cwd to the **repo
  root** (its parent), and is imported before settings load. Because ES-module imports are evaluated in
  order, importing it first guarantees the chdir happens before any module reads a cwd-relative file.
  Don't reorder it below the settings imports, and don't drop the `".."`. See `decisions/architecture.md`.
- **Config-driven plugin loading uses `createRequire`, on purpose.** Dynamic prompts and prompt
  modules are loaded by a runtime path, synchronously, inside string-replace callbacks. Node 24 can
  `require()` ES modules synchronously, so `createRequire(import.meta.url)` is the correct tool — do
  **not** try to convert these to `await import()` (the call sites are synchronous and can't be made
  async without rewriting the prompt pipeline). The loaded module is a namespace: call `.default(...)`
  and read `.full` / `.suggestion_exclude` as named exports. See `reference/esm-patterns.md`.
- **Dynamic prompts live under `data/dynamic-prompts/` (the documented `src/`→`data/` exception),
  organized into `v2/<category>/` with `v1/` frozen.** As of 2.3.0 the v2 generators are sorted into
  category folders (`v2/{scene,subject,fragment,style,engine,user}/`) and as of 2.4.0 are written
  **`{#name}`** (brace-delimited like `{list}`/`<expansion>`; the bare `#name` form is gone — folders are
  organization only, **never** `{#folder}` groups). `{#name}` resolves by **path suffix** (the shared
  `resolveName`, same as lists/expansions), so refs stay short and folder-independent. `{#name-v1}`
  resolves against the frozen `v1/` tree; `{#user-name}` is a back-compat alias for `v2/user/`. A category
  folder with 2+ generators is an implied **pick-one group** (`{#scene}` runs one random scene generator;
  `.group` files + `_enable/_disable-group-list` markers work too); `{#any}` / `{#any-sfw}` / `{#any-nsfw}`
  pick one generator from the whole catalog (the unit is one GENERATOR, never a line union). Expansions get
  the same `<folder>` pick-one groups. NSFW gating is automatic by name token (`isGatedDynPrompt`). The
  **active** resolver is the core engine: `src/core/stages/dynamicPrompt.js`
  (suffix resolution; splits v1 vs v2) over the two isomorphic loaders — `src/core/nodeLoader.js` (fs +
  `createRequire`) and `src/core/browserLoader.js` (Vite `import.meta.glob("../../data/dynamic-prompts/**/*.js")`).
  The classic pipeline `src/prompt-modules/dynamic-prompt.js` and `src/server.js` are **read-only legacy
  reference** (being replaced) — do not maintain them; nothing active imports the legacy stage.
- **Generator imports are depth-sensitive — verify with both gates after any move.** v2 generators sit
  two folders deeper than the old flat root, so they reach `src/` via `../../../../src/helpers/…` (and
  `../../../../src/promptFilesAndSuggestions.js`); they import siblings across categories by relative path
  (`../fragment/nature.js`). `v1/` files use `../../../src/helpers/…` and reach the v2 entity helper via
  `../v2/subject/entity.js`. `npm run smoke` does NOT load v1 modules (the classifier skips them), so a
  broken `v1/` import only surfaces in **`npm --prefix web-app run build`** (browser glob bundles
  everything) — always run **both**. The moves + import rewrites are scripted in
  `scripts/reorg-dynprompts-v2.mjs` (resolves old→new absolute paths).
- **Dynamic-prompt files export a default function + optional `full` / `suggestion_exclude` flags.**
  `export default function (settings, imageSettings, upscaleSettings) {…}`, plus
  `export const full = true;` / `export const suggestion_exclude = true;` where applicable. Keep that
  shape or the loader in `src/promptFilesAndSuggestions.js` won't classify them. Each generator/folder
  may carry an optional `<name>.json` description sidecar (editor tooltip), regenerated by
  `scripts/dynprompt-meta/write-dynprompt-meta.mjs`; `_`-prefixed files are internal (never generators),
  and a `_force-prefix` folder marker shows its path in the `#token` (all parity with lists/expansions).
- **`src/helpers/listFiles.js` is a default-export object on purpose** (it's indexed dynamically:
  `listFiles[\`${keyword}Alias\`]`). `src/helpers/keywordRepeater.js` is named exports
  (`artistRepeater`, `keywordRepeater`) because it's consumed via destructuring. Don't flip them.
- **Never use `node-fetch`.** Node 24 has a global `fetch`; the dependency was removed in 2.0.0.
- **Use PowerShell or the file tools (Read/Edit/Write) — not the Cowork bash sandbox.** Bash has
  reported false file truncations on this machine and risks data loss; PowerShell has real, reliable
  access to the repo and Node 24. See `reference/fix-patterns.md`.

## Build / Run / Verify

Node **24 LTS** (`.nvmrc` pins `24`; `package.json` `engines` requires `>=24`). The repo runs on the
local Windows machine; use **PowerShell** to run anything.

```
npm install            # install deps
npm start              # run the CLI generator (node index.js)
npm run server         # start the web UI on http://localhost:7861 (node server.js; also webui.bat)
npm run lint           # eslint . (flat config; 0 errors expected, warnings are pre-existing)
npm run format         # prettier --write .
npm run format:check   # prettier --check .
npm run smoke          # the import smoke test (node scripts/smoke-test.mjs)
npm test               # lint + smoke (the headless verification gate)
npm run docs           # build the JSDoc doc-site (code API + notes as tutorials) into docs/jsdoc/
```

- Generating images requires a **Stable Diffusion WebUI running with `--api`** on the URL in
  `imageSettings.url` (default `http://127.0.0.1:7860`). Without it, prompt generation still runs but
  the image calls fail — that's expected, not a bug.
- There is **no full automated test suite yet** (see `notes/plans/testing.md`). Verification today is:
  `npm run lint`, `node --check` on changed files, and the **import smoke test** (`npm run smoke` →
  `scripts/smoke-test.mjs`) — it loads `src/common.js` + `src/promptFilesAndSuggestions.js` the way the
  server boots, forces every dynamic prompt to load via `require(ESM)`, and expands a prompt, confirming
  the whole ES module graph resolves without starting a server or touching the network. `npm test` runs
  lint + smoke together. The same checks run in CI (`.github/workflows/ci.yml`).

## Default Workflow — Do These By Default (a standing instruction)

After making changes, run this loop without being asked:

1. **Lint + format.** `npm run lint` (fix new errors; pre-existing warnings are fine) and
   `npm run format`.
2. **Verify the module graph.** `node --check` changed files; run `npm run smoke` (or `npm test`) for
   anything touching module wiring, settings, or the prompt pipeline. Only proceed on green.
3. **Commit on `dev`.** Stage specific files (never `git add -A`/`.`), focused `type: summary`
   messages, and write the changelog entry **inside the same commit** (see below). `git push origin
   dev` after each commit.
4. **Keep `VERSION` + `package.json` in sync.** Bump both in the same commit when a change warrants it —
   **PATCH** for a fix/small change, **MINOR** for a feature; never **MAJOR** automatically. Docs / notes
   / test / CI-only commits don't move the number. See `reference/versioning.md`.
5. **Ship to `master` when green (on go-ahead).** `master` is **FF-only** from a green `dev` — never
   commit on `master` directly. When shipping (with the owner's go-ahead, unless they've asked for it to
   be automatic like the sibling project), confirm CI is green on the `dev` HEAD
   (`gh run list --branch dev -L 1`), then:
   `git checkout master && git merge --ff-only dev && git push origin master && git checkout dev`.
   A `master` push that bumped `VERSION` cuts a GitHub Release (`release.yml`, tag-gated) and refreshes
   the Pages docs (`pages.yml`); watch them with `gh run watch`. See `reference/deployment.md`.
6. **Regenerate the docs after shipping (by default).** After a `master` FF, run `npm run docs` so the
   generated `docs/jsdoc/` (git-ignored) tracks `master`; CI also rebuilds + deploys it to Pages.

Hard git safety rules are absolute: never `push --force`, never rewrite pushed history, never
`reset --hard`/`rebase`/`clean -fd`/delete a branch without an explicit request. Inspect `git status`
before and after. Full standards: `notes/reference/git-workflow.md`.

## GitHub Is Part of Default Management (a standing instruction)

The GitHub CLI (`gh`) is the way to keep GitHub state part of the normal workflow — event-based, not on
a timer. The trigger is **preparing `master` for shipment**, not a calendar.

- **When prepping `master` for shipment**, do a quick GitHub check: `gh run list` (CI/Pages/release
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
| Created/renamed a Markdown note | Nothing extra needed — `scripts/build-docs.mjs` auto-discovers every `notes/**.md` and wires it into the JSDoc doc-site (hierarchy mirrors the folder tree). Keep cross-links relative (`[x](../reference/foo.md)`) so the build rewrites them to tutorial links |
| A version is warranted | Bump `VERSION` **and** `package.json` in the same commit |

If something doesn't fit an existing file, make a new one in the right folder. The goal: any AI (or
human) opening this repo cold can read the notes and be fully oriented — nothing trapped in one
person's head, nothing lost between sessions.

## Project Preferences

- Keep the app feeling like polished software, not a dev tool.
- Don't silently swallow errors; surface them. Never corrupt or lose a user's generated images or
  their `user-settings.json`.
- `user-settings.json`, `results.json`, and `output/` are user data / runtime artifacts (gitignored) —
  don't commit them.
