# Project Status

_Current state only._ For the chronological history of what changed each session and why, see
[`sessions/`](sessions/README.md). For the commit-by-commit changelog see [`version.md`](version.md).

**Repository structure (split 2026-06-25):** the repo is now two separate projects that share no code.
**`engine-v3/`** is the active project (the new core engine + SPA) — everything below describes it, and all
commands run from `engine-v3/` (`cd engine-v3`). **`engine-v1-2/`** is the frozen pre-revival CommonJS
snapshot (the old CLI + classic Express/Pug server), self-contained and runnable but unmaintained, on its
way out. Much of the narrative below predates the split (it describes the old single-tree `src/` layout at
the repo root); those `src/…` / `data/…` paths now live under `engine-v3/`, and the classic CLI/server code
lives only in `engine-v1-2/`. See [`plans/engine-split.md`](plans/engine-split.md).

**Version:** `2.9.0` (single source of truth: repo-root `VERSION`; kept in sync with `package.json`;
see [`reference/versioning.md`](reference/versioning.md)).

**Provider header redesign (2.9.0):** the top bar is now a single **Providers dropdown**
(`gui/src/components/ProvidersMenu.jsx`) + a provider-settings **gear** + the NSFW switch. The dropdown holds
two rich pickers (`ProviderPicker.jsx`): **Image** (grouped Local — incl. Plain text — / Online) and **Text**
(Off + the rewrite AIs OpenAI / Gemini / Grok), each with its **BYOK key** field (`ApiKeyField.jsx`) on the
right in an aligned two-column grid; the key is keyed by provider id, so the same provider chosen for both rows
**shares one key** (shown once). The provider's own knobs (`ProviderBox.jsx`, now bare — no card/collapse)
moved into the gear popover (`ProviderGear.jsx`), out of the prompt area; `ProviderSelect.jsx` was removed and
the rewrite select/key left `Settings.jsx`. The **negative prompt** left provider settings: the composer's
editor flips between **Prompt** and **Negative** via a switch on the insert bar (only when the provider
supports negatives), storing the per-provider negative the engine already reads. **Next:** a per-provider
**preset manager** + migrating the old v1–v2 flat presets (deferred). Windows visual baselines refreshed; the
**Linux** set needs the `visual-baselines.yml` workflow before the `main` release.

**Keyword tooling + DPL insert toolbar (2.8.0):** the single view's keyword cloud is now backed by a real
parser (`gui/src/lib/keywords.js` — strips SD/NovelAI weighting syntax, keeps accents for display but folds
them for dedupe/search) with a **"Rebuild with AI"** button that keyword-translates the prompt, alphabetizes,
and saves over the image's sidecar (`POST /api/image/meta`); the composer gained an **`autoKeyword`** toggle
beside the auto-fix wand (independent + chainable), backed by a new `KEYWORD_SYSTEM` rewrite mode; and the
single view's details block is a real `<table>`. Also lands the **DPL insert toolbar** above the prompt box
(`DplInsertBar.jsx` + `dplInserts.js`, snippet insertion via `DplEditor.insertSnippet`). The stale E2E
selectors that still targeted `<textarea>` (red since the 2.7.26 CodeMirror switch) were fixed to drive
`.prompt-input .cm-content`, and the Linux visual baselines were refreshed.

**DPL editors (2.7.26):** the prompt, negative, and wrapper Start/End boxes are **CodeMirror 6** editors
(`gui/src/components/DplEditor.jsx` + `gui/src/lib/dpl/dplLanguage.js`) with DPL syntax highlighting
(theme-aware `--dpl-*` colors in `styles.css`) and a brace-aware `{…}`/`{#…}` token autocomplete. Part of a
four-branch GUI/DPL UX pass on `dev`; the Playwright **visual baselines** still need a refresh for the
prompt-box change.

**Dynamic-prompt sidecars (2.7.27):** category `.json` sidecars carry a `priority` (orders the
category/folder pills inside the **Blocks** tab — lower = higher, default 1000; the curated order is
Any · Prompt · Scene · Subject · Style · Fragment · User · Special), and generator sidecars can carry
`nsfw: true` to be **hard-hidden** when the NSFW switch is off (gone from the picker and from the engine,
not just emptied).

**Result/gallery polish (2.7.28):** the prompt box's live-preview moved to the box's upper-right corner as
an icon (off the bottom action bar); generated-prompt rows dropped the copy button for **click-to-copy**
text (full text on hover; the DPL line's hover tooltip also shows an example that re-rolls every second);
and **gallery thumbnails now carry the same hover actions as the generate thumbnails** (open in default app,
reveal in explorer, delete).

**Online build is stripped (2.7.29):** when built with `VITE_ONLINE=true`, the SPA is **Generate-only** —
the header tabbar (Gallery/Single) is gone, the **NSFW toggle is removed** and adult content forced off, and
no image feed/storage is touched (generated images stay in-memory; nothing is saved to the browser). The
local build is unchanged.

**Photo gallery (2.7.25):** the old v1-2 image **feed** is back as a first-class v3 view. The top-bar now
carries a **Generate · Gallery · Single** switch (`gui/src/App.jsx`) over three top-level views that all stay
**mounted** for the session — each keeps its state + scroll position when you switch tabs (shared feed /
search / current-image state lives in `App`). The **gallery** (`gui/src/components/Gallery.jsx`) browses
everything saved to `output/`; the **single** view (`gui/src/components/SingleView.jsx`) is the full
per-image page. Generated images and gallery thumbnails open into the single view (Back returns where you
came from); the Single tab shows the last image, or a random one the first time. Every
generated image now gets a **`.json` metadata sidecar** next to it (prompt sent, the deterministic engine
roll, the AI translation, the source DPL, negative, provider, and a settings snapshot with **API keys
stripped**), written by `POST /api/image` and read back via a new `GET /api/feed` (`gui/vite-plugin-api.js`).
The gallery is a masonry grid with keyword search; clicking opens a **dedicated single-image page** (not a
modal) with the prompt and negative each in their DPL / engine-roll / AI-translation / sent-final layers, a
curated details table over the full settings snapshot + raw JSON, a clickable keyword cloud, prev/next nav,
and actions (open / reveal / download PNG / **Convert & download** via ImageMagick / delete). The sidecar is
nested (`prompt:{dpl,roll,ai,final}`, `negative:{…}`), and **the negative prompt is AI-translated too** when
auto-fix is on. The dev server detects ImageMagick (`/api/magick`) and converts on demand
(`/api/image/convert`); the convert menu hides when magick isn't installed. Local-only by nature (the feed +
conversion need the dev server's filesystem); a static/online build shows an empty gallery with a note. See
[`version/2026-06.md`](version/2026-06.md).

**Layout reorg (2.7.1):** completes the v3-only move. Dynamic prompts are now **flat** under
`data/dynamic-prompts/<category>/` — the `v3/` wrapper and the leftover `{#v1/}`/`{#v2/}`/`{#any-ver}`
version routing are gone (engine + both loaders + the SPA browser). The loose raw build inputs moved to
`data/sources/` (`artists.csv`, `danbooru.csv`, `nai-tag-expirement.json`), and the SPA folder was renamed
**`web-app/` → `gui/`** (the name anticipates a planned CLI; the core engine is already headless). A fuller
notes sweep of the remaining `v1/v2`/`web-app` references in the deeper `reference/` docs is still pending.

**Content rating (2.6.1):** the SPA now defaults to **SFW** (`settings.includeAdult: false`) and carries a
right-aligned **NSFW** toggle in the top-bar (`gui/src/components/NsfwToggle.jsx`) — a stopgap until the
options screen lands. Turning it ON requires a confirmation dialog; turning it OFF is immediate; the choice
is remembered in the browser (it's part of `settings` → localStorage). The engine already gated on
`includeAdult` (`core/listStore.js`, `core/stages/*`, `gatedLists.js`); this just exposes the switch. Still
pending: the SFW/adult word-list split + re-adding the Style control (see
[`plans/removed-pending-readd.md`](plans/removed-pending-readd.md)).

**fairyfox mesh:** this repo is a node in the fairyfox system. Project-side onboarding is done — the
`CLAUDE.md` mesh-awareness block ([`reference/cross-project-sync.md`](reference/cross-project-sync.md)),
the notes/version/branch model, and a **fairyfox-themed docs site** ([`reference/documentation.md`](reference/documentation.md))
are in place. The themed docs go live on the next `main` release + Pages deploy. **Branch model (adopted
2026-06-25):** the project now follows the system's full **git-flow** standard, and `master` was renamed
to **`main`** (see [`reference/git-workflow.md`](reference/git-workflow.md)). **Hub updates adopted
2026-06-26:** the **process-reports** loop ([`fairyfox-reports/`](fairyfox-reports/README.md) +
[`reference/process-reports.md`](reference/process-reports.md) — every fairyfox run, including a
check-only one, writes a report) and the **standards compliance audit**
([`reference/compliance.md`](reference/compliance.md)), plus `## Verify` sections on the git-workflow
and versioning notes. Notes-only adoption — no `VERSION` bump, no release. Open (hub-side, for the
owner, in the `junebug12851.github.io` repo): the registry's `notes:` link still points at `tree/master/…`
(update to `tree/main/…` after the default branch flips), and the `adopts_hub`/docs-site flag is overstated.
The registry's `branch: dev` is **correct** — that field tracks the work branch, not the default branch.

**Dynamic prompts (2.5.0):** added **pick-one groups** — a category folder with 2+ generators is an implied
group (`{#scene}` runs one random scene generator; `.group` files + markers too), and the same for
expansions (`<lighting>` splices one random expansion). Added the `{#any}` / `{#any-sfw}` / `{#any-nsfw}`
wildcard (one random generator from the whole catalog, `{keyword}`-style mode variants). Renamed the
`engine/` category to **`prompt/`** (force-prefixed → `{#prompt/…}`): `danbooru`→`d`, `random`→`random-words`,
and `*-prompt`→`*` (so `{#prompt/random}` is the composite; the default `settings.prompt` is now
`{#random-words}`). Reworked the SPA navbar into a single **"Prompts"** heading with one **v1/v2 superset
switch** (v2 default) over **full** / **partial** sub-tabs; folder-group and `{#any}` pills are clickable.
The "pick one" always resolves to ONE concrete generator/snippet, never a line union.

**Dynamic prompts (2.3.0 + 2.4.0):** `data/dynamic-prompts/` was brought to full parity with the
list/expansion systems. **2.3.0:** the 79 v2 generators (+ the user-submitted one) were reorganized into
category folders under a new `v2/` root (`scene`/`subject`/`fragment`/`style`/`prompt`/`user`), `v1/` left
frozen; resolution by **path suffix**, `<name>.json` description sidecars, `_`-internal / `_force-prefix` /
`compareNames`. **2.4.0:** the sigil became **`{#name}`** (brace-delimited like `{list}`/`<expansion>`,
`/`-path capable; bare `#name` retired — 204 internal refs migrated, v1 untouched); automatic NSFW gating
by name token (`isGatedDynPrompt`); tag metadata (`src/dynPromptManifest.js`); and a **uniform SPA** — one
Dynamic-prompts block with category-folder pills
(plain labels — folders are organization, **not** groups: a generator is a script, not a word pool) and a
**v1/v2 toggle**. Only the **new** engine (core loaders/stage, classifier, SPA) was touched — the classic
server + `prompt-modules/` are read-only legacy reference. See
[`reference/dynamic-prompts-architecture.md`](reference/dynamic-prompts-architecture.md).

**Expansions (2.2.0):** `data/expansions/` was brought to parity with the list system — the 9 snippets nest
into category folders (`detail`, `style`, `lighting`, `subject`, `scene`) with shared path-suffix resolution
(existing `<name>` references unchanged), each has a `<name>.json` description sidecar (folders too), and the
SPA token cloud groups them by folder with tooltips. Random-union groups / clickable folder pills / SFW-NSFW
splitting were intentionally left out (they don't fit deterministic copy/paste snippets). See
[`reference/expansions-architecture.md`](reference/expansions-architecture.md).

**Keyword lists (2.1.0, branch `cleanup/list-reorg`):** the `data/lists/` corpus was purged of slurs /
minor-sexualizing / extreme-shock content via a new `src/contentSafety.js` filter (wired into the CSV
build scripts), the 48k-line `keyword.txt` dictionary was sorted by part of speech into `dict-*` lists
(`keyword.txt` is now proper nouns), and duplicated composites were collapsed into **virtual lists**
(`src/listManifest.js`: `danbooru`, `d-keyword`, `d-character`, `artist`, `artist-digipa`, plus new
`danbooru-sfw` and `*-all`). See [`reference/list-architecture.md`](reference/list-architecture.md).

## Current state (read this first)

Everything below happened during the **2026-06-18 revival** (the project had been dormant since
2023-04-07). Four strands, in order:

**1. Modernized to ES modules on Node 24.**

- **Runtime:** Node **24 LTS** (was implicitly an old Node). `.nvmrc` = `24`, `engines.node >= 24`.
- **Module system:** the entire codebase is now **ES modules** (`"type": "module"`). ~130 files moved
  from CommonJS (`require`/`module.exports`) to `import`/`export`. There is no remaining `require`
  except the deliberate `createRequire` used for config-driven synchronous plugin loading (dynamic
  prompts / prompt modules) and the optional legacy `user-settings.js` migration.
- **Dependencies:** all taken to current majors — Express **5**, yargs **18**, open **11**,
  `cli-progress` 3, `crc` 4, `compromise` 14, lodash 4, pug 3. **`node-fetch` was removed** in favor of
  the built-in global `fetch`.
- **Tooling added:** ESLint 9 (flat config) + Prettier 3, plus `.editorconfig`, `.nvmrc`,
  `.prettierrc.json`/`.prettierignore`. `npm` scripts: `start`, `server`/`webui`, `lint`, `lint:fix`,
  `format`, `format:check`.

**2. Reorganized the tree (2.0.1).** All code lives under **`src/`**, all prompt content (lists,
expansions, presets, the CSV sources) under **`data/`**; runtime/user data (`output/`,
`user-settings.json`, `results.json`) stays at the repo root. `src/chdir.js` pins the cwd to the repo
root (its parent) so every cwd-relative path keeps working.

**3. Started the web migration — a React + Vite SPA** (`gui/`, usable online BYOK or locally). The
real prompt engine was ported to a browser-safe `core/` driven by an **injected loader** (Node: fs +
`createRequire`; browser: Vite `import.meta.glob`), so there is one engine, no duplicated prompt logic.
As of **2.0.2** the SPA front-end is a single **redesigned home page** (`Home.jsx`) styled after the
pre-revival generate screen — dark charcoal + mint brand, Rokkitt/Maven Pro, a hero, and one composer
that unifies prompt building (blocks cloud, share links, custom expansions/presets, chaos,
Normal/Anime toggle, live preview) **and** generation (provider line, generate prompts/images,
in-session gallery). The full settings form lives in a right-side slide-over drawer
(`SettingsDrawer.jsx`). Build tooling is **Vite 8 / @vitejs/plugin-react 6**. The classic Express + Pug
server and the CLI are untouched and still work.

**4. Documented the whole repo in one JSDoc doc-site.** `npm run docs` (`scripts/build-docs.mjs`) builds
a single **JSDoc + docdash** site that unifies the per-function **code API** (every authored `.js`,
including the React SPA via a babel-transpile-then-JSDoc step) with the **entire `notes/` tree as
tutorials** (cross-links rewritten). **Doxygen was retired.** Coverage is complete: `@file` on every
authored file, per-function JSDoc across all server-side code, all 113 dynamic prompts, the frontend
scripts, and the whole `gui/` SPA — only anonymous callbacks are left (no generator extracts them).
The full AI/notes system (`CLAUDE.md` + `notes/`) backs all of this and is kept living.

**First ship (2026-06-22): the deployment hold is lifted.** The stable branch (then `master`, renamed to
`main` on 2026-06-25) was first advanced off the pre-revival `241a148` up to the CI-green `dev` HEAD.
As of the 2026-06-25 git-flow adoption it now advances by **`--no-ff` merge + tag** (PATCH straight from
green `dev`, MINOR/MAJOR via a `release/*` branch) rather than fast-forward. Getting there required
unbreaking CI first — both `npm ci` jobs were red on a
lockfile drift (root + `gui`) and `format:check` was red on ~40 un-Prettier'd files; both fixed
(build/style only, no version bump). Active work continues on `dev`. **CI now runs the full gate** — lint,
format:check, smoke, the Node + jsdom Vitest suites, the gui build, and the Playwright E2E +
accessibility **+ visual-regression** specs. Visual works cross-OS: baselines are committed for both Windows
(`*-chromium-win32.png`, system Chrome) and Linux (`*-chromium-linux.png`, bundled chromium); regenerate the
Linux set via the "Update visual baselines (Linux)" workflow (`visual-baselines.yml`). See
[`reference/deployment.md`](reference/deployment.md).

**Verification done:** `node --check` on all 152 server-side JS files (0 syntax errors); `npm run lint`
(0 errors, 163 pre-existing style warnings); a Prettier pass over the codebase; and an **import smoke
test** that loads the whole ES-module graph, loads all 113 dynamic prompts via `require(ESM)`, runs
`promptSuggestion()`, and expands `#random` — all green.

**Not yet runtime-verified end to end:** actually generating an image requires a running Stable
Diffusion WebUI (`--api`) on `imageSettings.url`; that wasn't exercised here. The CLI (`index.js`) and
server (`server.js`) entry points pass syntax + import-graph validation and use Express-5-safe route
patterns, but were not launched live (launching the server opens a browser on the user's machine).

## Open issues

| Issue | Where | Status / notes |
|-------|-------|----------------|
| ~~No automated test suite~~ | ~~whole repo~~ | **DONE (2.6.0).** Full Vitest (Node + jsdom SPA) + Playwright (E2E/visual/a11y) suite — 118 Vitest tests green. See [`plans/testing.md`](plans/testing.md). |
| `no-dupe-else-if` warnings (dead branches) | several `dynamic-prompts/**.js` (e.g. `v2/subject/portrait-princess.js`, `v1/*`) | Pre-existing duplicate `else if` conditions flag as ESLint warnings. They likely indicate latent logic bugs in the prompt generators, but "fixing" them changes generated prompts, so they're left as warnings to review deliberately. See [`plans/next-steps.md`](plans/next-steps.md). |
| `no-useless-escape` warnings | a few prompt/data regexes | Harmless redundant escapes; kept as warnings (changing regexes risks changing output). |
| Live generation unverified | `src/genImg.js`, `helpers/imageUpscaler.js`, `server.js` | Needs a running SD WebUI to confirm the `fetch` migration end to end. |

## Build / run health

| Area | Status |
|------|--------|
| `npm install` (Node 24) | ✅ resolves clean |
| `node --check` all JS | ✅ 0 syntax errors (152 files) |
| `npm run lint` | ✅ 0 errors (165 warnings, pre-existing; ESLint 10) |
| Import smoke test (full graph + dynamic prompts + expansion) | ✅ green |
| `npm run test:unit` (Vitest, Node — unit/integration/snapshot/regression) | ✅ 86 passed |
| `npm run test:web` (Vitest, jsdom — SPA unit/component/contract/integration) | ✅ 43 passed (incl. `gallery.test.js`) |
| `npm run test:e2e` (Playwright — E2E/visual/a11y) | ✅ 8 passed (system Chrome via `channel: "chrome"`; visual baselines committed). The bundled Chrome-for-Testing build hit an SxS launch error here even with VC++ present, so the config uses the system Chrome; CI can drop the channel. |
| `npm run docs` (JSDoc + docdash doc-site, ~244 pages) | ✅ exit 0 |
| `gui` SPA `vite build` | ✅ green |
| `engine-v1-2/` CLI (`node index.js`) | ✅ runs standalone — own deps, generated a prompt (2026-06-25). Frozen snapshot. |
| `engine-v1-2/` classic server (`node server.js`) | ✅ boots the same way (also `webui.bat`); frozen. Image gen still needs an SD WebUI. |
