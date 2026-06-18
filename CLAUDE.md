# random-ai-prompt — AI Context

Random AI prompt + image generator for the Stable Diffusion WebUI. Node.js (ES modules) — a
yargs **CLI** (`index.js`) and a local **Express + Pug web UI** (`server.js`) that share one core
(`common.js`). Open source, by junebug12851. Originally CommonJS (2022); modernized to ES modules on
Node 24 LTS in June 2026.

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
| `notes/systems/overview.md` | **System map** — the machine: CLI vs server, settings, the prompt-module pipeline, dynamic prompts, the image index. Start here to understand how it fits together |
| `notes/reference/esm-patterns.md` | **The Node/ESM landmine catalog** — CJS→ESM gotchas hit during the migration (import ordering vs `process.chdir`, `require(ESM)` for config-driven plugin loading, default vs named exports, JSON imports, dropping `node-fetch`). Read before touching module wiring |
| `notes/reference/dependencies.md` | Every runtime/dev dependency, why it's there, and the breaking-change notes for the current majors |
| `notes/reference/fix-patterns.md` | Error → fix lookup table |
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
- **`chdir.js` must stay imported first in `common.js`.** The whole app uses cwd-relative paths
  (`./output`, `./lists`, `./results.json`, `./user-settings.json`). `chdir.js` does
  `process.chdir(import.meta.dirname)` and is imported before settings load. Because ES-module imports
  are evaluated in order, importing it first guarantees the chdir happens before any module reads a
  cwd-relative file. Don't reorder it below the settings imports. See `decisions/architecture.md`.
- **Config-driven plugin loading uses `createRequire`, on purpose.** Dynamic prompts and prompt
  modules are loaded by a runtime path (`require(\`./${settings.dynamicPromptFiles}/${name}\`)`),
  synchronously, inside string-replace callbacks. Node 24 can `require()` ES modules synchronously, so
  `createRequire(import.meta.url)` is the correct tool — do **not** try to convert these to
  `await import()` (the call sites are synchronous and can't be made async without rewriting the prompt
  pipeline). The loaded module is a namespace: call `.default(...)` and read `.full` /
  `.suggestion_exclude` as named exports. See `reference/esm-patterns.md`.
- **Dynamic-prompt files export a default function + optional `full` / `suggestion_exclude` flags.**
  `export default function (settings, imageSettings, upscaleSettings) {…}`, plus
  `export const full = true;` / `export const suggestion_exclude = true;` where applicable. Keep that
  shape or the loader in `src/promptFilesAndSuggestions.js` won't classify them.
- **`helpers/listFiles.js` is a default-export object on purpose** (it's indexed dynamically:
  `listFiles[\`${keyword}Alias\`]`). `helpers/keywordRepeater.js` is named exports
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
```

- Generating images requires a **Stable Diffusion WebUI running with `--api`** on the URL in
  `imageSettings.url` (default `http://127.0.0.1:7860`). Without it, prompt generation still runs but
  the image calls fail — that's expected, not a bug.
- There is **no automated test suite yet** (see `notes/plans/testing.md`). Verification today is:
  `npm run lint`, `node --check` on changed files, and an **import smoke test** — load `common.js` +
  `src/promptFilesAndSuggestions.js`, call `loadAll()` and expand a prompt — to confirm the whole ES
  module graph (incl. all dynamic prompts via `require(ESM)`) resolves without starting a server or
  touching the network.

## Default Workflow — Do These By Default (a standing instruction)

After making changes, run this loop without being asked:

1. **Lint + format.** `npm run lint` (fix new errors; pre-existing warnings are fine) and
   `npm run format`.
2. **Smoke-test the module graph.** `node --check` changed files; run the import smoke test above for
   anything touching module wiring, settings, or the prompt pipeline. Only proceed on green.
3. **Commit on `dev`.** Stage specific files (never `git add -A`/`.`), focused `type: summary`
   messages, and write the changelog entry **inside the same commit** (see below). `git push origin
   dev` after each commit. Do **not** commit to `master` without an explicit go-ahead.
4. **Keep `VERSION` + `package.json` in sync.** Bump in the same commit when a change warrants it —
   **PATCH** for a fix/small change, **MINOR** for a feature; never **MAJOR** automatically. See
   `reference/versioning.md`.

Hard git safety rules are absolute: never `push --force`, never rewrite pushed history, never
`reset --hard`/`rebase`/`clean -fd`/delete a branch without an explicit request. Inspect `git status`
before and after. Full standards: `notes/reference/git-workflow.md`.

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
| Made / rejected a structural decision | `notes/decisions/architecture.md` / `notes/decisions/rejected.md` |
| Finished or unblocked a task | Update `notes/plans/next-steps.md` |
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
