# Project Status

_Current state only._ For the chronological history of what changed each session and why, see
[`sessions/`](sessions/README.md). For the commit-by-commit changelog see [`version.md`](version.md).

**Repository structure — engine/ + targets/ (restructured 2026-07-06, 2.47.0; the "dynamic prompt"
concept was renamed to "block" everywhere in 2.48.0, and the Tauri target `targets/desktop` was renamed
`targets/web-shell`):** the project lives at the
**repo root** as an **engine + build targets**. The isomorphic prompt engine is under `engine/`
(`engine/core/` = the DPL engine + pipeline stages + both loaders; plus `engine/helpers/` and the
manifest/settings/content-safety modules), and the engine **owns its content** under `engine/data/`
(lists, presets, sources, and the `{#name}` block generators). Build targets live under
`targets/`: `targets/web/` is the React/Vite web target (ONE npm package, split into `frontend/` +
`backend/` + `shared/`), and `targets/web-shell/` is the Tauri shell (its own package; wraps the built local
web target). `targets/shared/` is reserved for cross-target code and a `targets/cli/` target is planned.
The universal override overlay stays at the repo-root `user/` (`user/lists`, `user/blocks`). Build/meta
tooling is in `scripts/`, the Node engine test suite in `tests/` (the web target has its own under
`targets/web/tests/`); **all commands run from the repo root**. The dev server (`npm run web`) is
development-only — end users run the built local desktop target or the hosted web build. The pre-revival
2022–2023 CommonJS system (the old CLI + classic Express/Pug server) was **removed** from the tree — it
lives in git history and as a read-only reference clone under `assets/references/`. (Historical entries
below predate this restructure and may still say `src/…`, `gui/…`, or `engine-v3/…`; those paths are now
`engine/…` / `targets/web/…` at the repo root.) **Desktop target caveat:** its path wiring was rewritten
to the new layout but **not yet verified with a real Tauri/Rust build** — do that before shipping desktop.

**User content overlay — a repo-root `user/` folder beside `data/` (2.46.0 — branch
`feature/user-overlay`, on that branch pending review):** a first-class **user overlay** so people
add/tweak prompt content without touching the app's built-in files. A repo-root `user/`
(`user/lists`, `user/blocks`, `user/settings`) sits beside `data/` and the app watches **both**, with
**user-wins** precedence on a name clash (like a settings override). Both engine loaders scan two
roots per pool (`engine/core/nodeLoader.js` on disk; the browser keeps names at first paint from lazy
globs and loads user content from a separate code-split `engine/core/browserUserCatalog.js` overlaid
last). The overlay is **local/desktop only** — gated off the online build (`VITE_ONLINE`), so the
hosted bundle carries no user content. The **Manage** tab groups "your content" (badged `yours`) on
top via new `user-lists`/`user-blocks` roots; `buildManageSnapshot` merges them into the runtime pool
so live generation honors the overlay, while edits write into `user/`. User content has no upstream,
so ghost/"restore default" are suppressed and `restoreFromRepo` refuses user roots. Settings moved
from `targets/web/user-settings/` to the unified `user/settings/` (boot migration folds the old location). The
desktop shell **seeds `user/` once** and preserves it across upgrades. `npm test` green; **visual
baselines need a refresh** (the Manage tree gained the user sections) before the `main` release. See
[`version/2026-07.md`](version/2026-07.md).

**Gallery composer + live placeholders, multi-select, a11y + SEO (2.45.0 — branch
`feature/gallery-composer-a11y-seo`, on `dev` pending review):** the composer prompt box was extracted
into a reusable `targets/web/frontend/components/PromptComposer.jsx` (Home markup unchanged); the **Gallery** now
carries a narrow copy of it in a `.g-composer` slot at the top, and generating from it streams **live
placeholder cells** into the grid that resolve into the finished images as each batch lands (isolated
orchestrator `targets/web/frontend/lib/gallery/generateIntoGallery.js`; the perf-critical `useImageBatches` is
untouched). The gallery gained **multi-select + mass delete** (checkboxes, select-all, one-confirm disk
delete via `App.deleteManyItems`). An **accessibility** pass added a skip link, a landmark `<h1>`,
`role="tabpanel"` view panes, `role="alert"`/`aria-live` regions, a `prefers-reduced-motion` guard, and
`.sr-only`/`.skip-link` utilities (axe A/AA clean). An **SEO** pass added `sitemap.xml`, a `FAQPage` +
enriched `WebApplication` JSON-LD, and a `keywords` meta. New tests:
`generateIntoGallery` + `GalleryMultiSelect`. See [`version/2026-07.md`](version/2026-07.md).

**Auto-updating — check-and-notify shipped; desktop auto-install implemented (2.44.0):** local/desktop
editions check for a newer GitHub release on launch and show a dismissible **corner card**,
**edition-aware** (download the new installer/portable/release, or a copyable `git pull` for a checkout)
— the online build is exempt (always the latest deploy). Core in `targets/web/frontend/lib/updateCheck.js` (+
`useUpdateCheck.js` + `components/UpdateBanner.jsx`); backend `GET /api/update` fetches the latest
release **server-side** (1 h cache) + detects the edition (Tauri stamps `RAP_EDITION`; else `.git` ⇒ git;
else source); dismissal + throttle persist through the new `update` storage namespace. **Phase 2 (full
in-app auto-installer) is LIVE** behind the `updater` Cargo feature: signing public key committed, a Rust
check-on-launch → native-prompt → install/relaunch trigger (compile-verified; default build pulls in
neither the updater nor dialog crate), and a CI `updater-manifest` job that assembles `latest.json`. The
CI signing secret is set and the **first signed release (v2.44.0) shipped** — all installers + `.sig` +
a valid `latest.json` attached — so installed builds prompt-and-self-update from the next release on.
Privacy page updated (desktop update-check disclosure). See
[`reference/desktop-updater.md`](reference/desktop-updater.md) +
[`plans/updates-upgrades.md`](plans/updates-upgrades.md).

**Pre-built distribution + desktop edition (2.43.0 — branch `feature/prebuilt-distribution`):** every
edition now ships **pre-built** so nobody has to build from source, and the hosted site is reframed as
just one deployment of the online edition. New **desktop edition** (`targets/web-shell/`): a thin **Tauri**
(Rust) shell that runs the unmodified local SPA + Node `/api` backend as a bundled **sidecar** (bundles
the platform `node`, stages to a writable working copy that preserves user data across upgrades, launches
`serve.js` on a free port, points the WebView at it). `release.yml` now attaches a self-hostable
`…-online.zip` and a per-OS **matrix** builds Windows `.msi`/NSIS/portable-`.zip`, macOS `.dmg`, and Linux
`.AppImage`/`.deb` (signed, on their own runners). README leads with download-or-build (21 badges
restored); the in-app links menu gained "Get the desktop app" / "Run it yourself". Updates/auto-upgrade
are deferred to a pre-3.0 design ([`plans/updates-upgrades.md`](plans/updates-upgrades.md)). Verified
locally on Windows (installers build; portable runs end-to-end with the bundled node sidecar serving);
cross-OS installers are CI-only. See [`systems/desktop.md`](systems/desktop.md).

**Large-scale performance (2.42.0 — on `dev`):** the app is built to stay seamless at its **officially
supported maximum simultaneous load** — a **100k-image gallery + 1000 prompts / ~10k images + a
100k-line Manage file, all at once**. The gallery is **virtualized** (windowed uniform grid over the pure
`targets/web/frontend/lib/virtual/windowRange.js` — bounded DOM at any count; replaced the old wide/tall masonry with
uniform cells so row-windowing is exact); the 1000-prompt results list uses `content-visibility` +
a memoized `PromptResult` (all rows present, offscreen ones skip layout/paint/decode); and auto-image
generation is **placeholder-first + chunked** — `useImageBatches` shows every prompt's busy placeholder
instantly and runs the real generate behind a **per-provider concurrency limiter** (rewrites through a
separate text-provider limiter), so a huge run never stampedes an API. The concurrency lives in a new
**shared-settings system** (`targets/web/shared/_shared/settings/`, auto-discovered + injected into every
provider's schema): a per-provider **"Batch chunk size"** with metadata defaults (local 6 / hosted 3).
Guarded by a Playwright **perf suite** (`tests/perf/`, real release server via `playwright.perf.config.js`
— `npm run test:perf:scenarios`, in `test:all` + a CI job) and a profiler (`npm run profile`). See
[`version/2026-07.md`](version/2026-07.md).

**Version:** `2.46.0` (single source of truth: repo-root `VERSION`; kept in sync with `package.json`
and the desktop `targets/web-shell/tauri.conf.json`;
see [`reference/versioning.md`](reference/versioning.md)). The monorepo flatten + `engine-v1-2` removal +
stage consolidation is on `dev` (branch `feature/flatten-monorepo`) pending the owner's go-ahead to release.

**`main` is branch-protected (2026-07-02):** releases now run **through a pull request** (`gh pr merge
--merge`), not a local `git push origin main`. PR-required with 0 approvals (solo self-merge), strict
status checks, enforce-admins, force-push/deletion blocked, linear history off. The OpenSSF Scorecard
was hardened from 4.2 the same day. See [`reference/git-workflow.md`](reference/git-workflow.md) and
[`reference/deployment.md`](reference/deployment.md).

**SPA internationalization (2.15.0 — branch `feature/i18n-react-intl`):** the whole React SPA is
internationalized with **react-intl** + the full **FormatJS** pipeline. Every user-facing string across
all ~28 components (text, `title`/`placeholder`/`aria-label`, `confirm`/`prompt`, ICU plurals/numbers) is a
`defineMessages` / `intl.formatMessage` / `<FormattedMessage>` call — **~407 messages**, English rendering
byte-identically (visual baselines untouched). New `targets/web/frontend/i18n/` (`config.js` locale registry +
`resolveLocale`, `loadMessages.js` `import.meta.glob` catalog loader, `I18nProvider.jsx`); `App.jsx` split
into a thin root + `AppShell`; a **Display language** selector in Settings persisted to `settings.locale`
(`"auto"` follows the browser). Tooling: `babel-plugin-formatjs` (auto IDs) in the Vite react plugin;
`@formatjs/cli` scripts (`i18n:extract` → `src/i18n/messages/en.json`, `i18n:pseudo` → an `en-XA`
pseudo-locale); `targets/web/eslint.config.js` + `npm run lint:i18n` (`eslint-plugin-formatjs`). **Only English is
shipped** as a real locale (the app's DPL/prompt jargon makes machine translation low-quality; adding a real
language is now a one-file job). Coverage is **complete (~480 messages)** — including the DPL-technical lib
modules: `validateDpl.js` (editor lint diagnostics) takes an optional `intl` with a `createIntl` English
fallback so its message-asserting tests stay green, and `dplInserts.js` (the DPL syntax catalog) is a
`getDplInserts(intl)` builder. See [`version/2026-06.md`](version/2026-06.md).

**Manage tab (2.12.0 — on `dev`):** a 4th SPA tab, the in-app content manager (local mode only — gated
on a file-backend capability probe, locked online). It edits the real `data/lists` + `data/blocks`
files on disk and **hot-applies** them live via a runtime (disk-snapshot) loader (`runtimeLoader.js`) the
engine reads through — no reload, except an edited `.js` generator *module body* (which can't run from
fetched text without eval, so it reloads). Left pane: the real nested folder tree (categories vs subfolders
color-coded, force-prefix/group folders badged, `_`-markers abstracted, NSFW-gated, search). Editors:
blocks (DPL + JS-sidecar tabs/boilerplate), folders (rename, sidecar priority/description/forceList, marker
toggles), and lists (virtualized entry mode + raw CodeMirror — seamless at 27k lines). Plus add/delete,
drag-to-move, restore-default (from `main`), **ghost pills** for files deleted locally but still upstream
(diffed against a published `data/manifest.json`, disk-cached a day), and external-edit auto-refresh (SSE
`fs.watch`). Backend: `targets/web/backend/manageFs.js` + `/api/manage/*` (Vite dev middleware today). Plan +
details: [`plans/manage-tab.md`](plans/manage-tab.md). Contract-tested in `tests/integration/manageFs.test.js`.

**DPL intensity dial + block content refactor (2.10.0 — shipped):** a `{#name}` reference can carry
an intensity percent (`{#great-bridge 25%}`, 1–100; `0`→`1`; unspecified → **50%**, top-level and nested)
that flows into the generator. Lines take intensity **conditions** in the weight slot (`[<10%] - grass`; ops
`< <= > >= = !=`; stackable `[100|<10%]` or `[100 <10%]`); probability gates and `repeat`/`one of`/`N of`
counts **auto-scale** by intensity; and text can interpolate it via `{intensity}`
(tiny/small/normal/large/huge/massive), `{intensity%}`, `{intensity-num}`, each accepting a relative `±NN%`
modifier (also on nested `{#name ±NN%}` refs). Engine in `engine/core/dpl/dpl.js` +
`engine/core/stages/block.js`; design: [`reference/intensity-design.md`](reference/intensity-design.md).
The **content refactor is complete across all five categories** (scene · fragment · subject · style ·
prompt): de-scattered (knight no longer pulls `{#landscape}`/`[[castle]]`; beach↛city; etc.), render-farm
filler stripped, typos fixed (`interrior`, `accesories`, `mesmorizing`, `sceptor`), `anime-irl`→`anime-realism`,
list-backed + intensity-aware. The engine auto-append now re-resolves nested tokens (the `{#rays}`-leak root
cause). **Open:** confirm the 50% default at the top level (one constant, `DEFAULT_INTENSITY`, to retune).

**Provider header redesign (2.9.0):** the top bar is now a single **Providers dropdown**
(`targets/web/frontend/components/ProvidersMenu.jsx`) + a provider-settings **gear** + the NSFW switch. The dropdown holds
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
parser (`targets/web/frontend/lib/keywords.js` — strips SD/NovelAI weighting syntax, keeps accents for display but folds
them for dedupe/search) with a **"Rebuild with AI"** button that keyword-translates the prompt, alphabetizes,
and saves over the image's sidecar (`POST /api/image/meta`); the composer gained an **`autoKeyword`** toggle
beside the auto-fix wand (independent + chainable), backed by a new `KEYWORD_SYSTEM` rewrite mode; and the
single view's details block is a real `<table>`. Also lands the **DPL insert toolbar** above the prompt box
(`DplInsertBar.jsx` + `dplInserts.js`, snippet insertion via `DplEditor.insertSnippet`). The stale E2E
selectors that still targeted `<textarea>` (red since the 2.7.26 CodeMirror switch) were fixed to drive
`.prompt-input .cm-content`, and the Linux visual baselines were refreshed.

**DPL editors (2.7.26):** the prompt, negative, and wrapper Start/End boxes are **CodeMirror 6** editors
(`targets/web/frontend/components/DplEditor.jsx` + `targets/web/frontend/lib/dpl/dplLanguage.js`) with DPL syntax highlighting
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
carries a **Generate · Gallery · Single** switch (`targets/web/frontend/App.jsx`) over three top-level views that all stay
**mounted** for the session — each keeps its state + scroll position when you switch tabs (shared feed /
search / current-image state lives in `App`). The **gallery** (`targets/web/frontend/components/Gallery.jsx`) browses
everything saved to `output/`; the **single** view (`targets/web/frontend/components/SingleView.jsx`) is the full
per-image page. Generated images and gallery thumbnails open into the single view (Back returns where you
came from); the Single tab shows the last image, or a random one the first time. Every
generated image now gets a **`.json` metadata sidecar** next to it (prompt sent, the deterministic engine
roll, the AI translation, the source DPL, negative, provider, and a settings snapshot with **API keys
stripped**), written by `POST /api/image` and read back via a new `GET /api/feed` (`targets/web/vite-plugin-api.js`).
The gallery is a masonry grid with keyword search; clicking opens a **dedicated single-image page** (not a
modal) with the prompt and negative each in their DPL / engine-roll / AI-translation / sent-final layers, a
curated details table over the full settings snapshot + raw JSON, a clickable keyword cloud, prev/next nav,
and actions (open / reveal / download PNG / **Convert & download** via ImageMagick / delete). The sidecar is
nested (`prompt:{dpl,roll,ai,final}`, `negative:{…}`), and **the negative prompt is AI-translated too** when
auto-fix is on. The dev server detects ImageMagick (`/api/magick`) and converts on demand
(`/api/image/convert`); the convert menu hides when magick isn't installed. Local-only by nature (the feed +
conversion need the dev server's filesystem); a static/online build shows an empty gallery with a note. See
[`version/2026-06.md`](version/2026-06.md).

**Layout reorg (2.7.1):** completes the v3-only move. Blocks are now **flat** under
`engine/data/blocks/<category>/` — the `v3/` wrapper and the leftover `{#v1/}`/`{#v2/}`/`{#any-ver}`
version routing are gone (engine + both loaders + the SPA browser). The loose raw build inputs moved to
`engine/data/sources/` (`artists.csv`, `danbooru.csv`, `nai-tag-expirement.json`), and the SPA folder was renamed
**`web-app/` → `targets/web/`** (the name anticipates a planned CLI; the core engine is already headless). A fuller
notes sweep of the remaining `v1/v2`/`web-app` references in the deeper `reference/` docs is still pending.

**Content rating (2.6.1):** the SPA now defaults to **SFW** (`settings.includeAdult: false`) and carries a
right-aligned **NSFW** toggle in the top-bar (`targets/web/frontend/components/NsfwToggle.jsx`) — a stopgap until the
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

**Blocks (2.5.0):** added **pick-one groups** — a category folder with 2+ generators is an implied
group (`{#scene}` runs one random scene generator; `.group` files + markers too), and the same for
expansions (`<lighting>` splices one random expansion). Added the `{#any}` / `{#any-sfw}` / `{#any-nsfw}`
wildcard (one random generator from the whole catalog, `{keyword}`-style mode variants). Renamed the
`engine/` category to **`prompt/`** (force-prefixed → `{#prompt/…}`): `danbooru`→`d`, `random`→`random-words`,
and `*-prompt`→`*` (so `{#prompt/random}` is the composite; the default `settings.prompt` is now
`{#random-words}`). Reworked the SPA navbar into a single **"Prompts"** heading with one **v1/v2 superset
switch** (v2 default) over **full** / **partial** sub-tabs; folder-group and `{#any}` pills are clickable.
The "pick one" always resolves to ONE concrete generator/snippet, never a line union.

**Blocks (2.3.0 + 2.4.0):** `engine/data/blocks/` was brought to full parity with the
list/expansion systems. **2.3.0:** the 79 v2 generators (+ the user-submitted one) were reorganized into
category folders under a new `v2/` root (`scene`/`subject`/`fragment`/`style`/`prompt`/`user`), `v1/` left
frozen; resolution by **path suffix**, `<name>.json` description sidecars, `_`-internal / `_force-prefix` /
`compareNames`. **2.4.0:** the sigil became **`{#name}`** (brace-delimited like `{list}`/`<expansion>`,
`/`-path capable; bare `#name` retired — 204 internal refs migrated, v1 untouched); automatic NSFW gating
by name token (`isGatedBlock`); tag metadata (`engine/blockManifest.js`); and a **uniform SPA** — one
Dynamic-prompts block with category-folder pills
(plain labels — folders are organization, **not** groups: a generator is a script, not a word pool) and a
**v1/v2 toggle**. Only the **new** engine (core loaders/stage, classifier, SPA) was touched — the classic
server + `prompt-modules/` are read-only legacy reference. See
[`reference/blocks-architecture.md`](reference/blocks-architecture.md).

**Expansions (2.2.0):** `data/expansions/` was brought to parity with the list system — the 9 snippets nest
into category folders (`detail`, `style`, `lighting`, `subject`, `scene`) with shared path-suffix resolution
(existing `<name>` references unchanged), each has a `<name>.json` description sidecar (folders too), and the
SPA token cloud groups them by folder with tooltips. Random-union groups / clickable folder pills / SFW-NSFW
splitting were intentionally left out (they don't fit deterministic copy/paste snippets). See
[`reference/expansions-architecture.md`](reference/expansions-architecture.md).

**Keyword lists (2.1.0, branch `cleanup/list-reorg`):** the `engine/data/lists/` corpus was purged of slurs /
minor-sexualizing / extreme-shock content via a new `engine/contentSafety.js` filter (wired into the CSV
build scripts), the 48k-line `keyword.txt` dictionary was sorted by part of speech into `dict-*` lists
(`keyword.txt` is now proper nouns), and duplicated composites were collapsed into **virtual lists**
(`engine/listManifest.js`: `danbooru`, `d-keyword`, `d-character`, `artist`, `artist-digipa`, plus new
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

**3. Started the web migration — a React + Vite SPA** (`targets/web/`, usable online BYOK or locally). The
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
authored file, per-function JSDoc across all server-side code, all 113 blocks, the frontend
scripts, and the whole `targets/web/` SPA — only anonymous callbacks are left (no generator extracts them).
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
test** that loads the whole ES-module graph, loads all 113 blocks via `require(ESM)`, runs
`promptSuggestion()`, and expands `#random` — all green.

**Not yet runtime-verified end to end:** actually generating an image requires a running Stable
Diffusion WebUI (`--api`) on `imageSettings.url`; that wasn't exercised here. The CLI (`index.js`) and
server (`server.js`) entry points pass syntax + import-graph validation and use Express-5-safe route
patterns, but were not launched live (launching the server opens a browser on the user's machine).

## Open issues

| Issue | Where | Status / notes |
|-------|-------|----------------|
| ~~No automated test suite~~ | ~~whole repo~~ | **DONE (2.6.0).** Full Vitest (Node + jsdom SPA) + Playwright (E2E/visual/a11y) suite — 118 Vitest tests green. See [`plans/testing.md`](plans/testing.md). |
| `no-dupe-else-if` warnings (dead branches) | several `blocks/**.js` (e.g. `v2/subject/portrait-princess.js`, `v1/*`) | Pre-existing duplicate `else if` conditions flag as ESLint warnings. They likely indicate latent logic bugs in the prompt generators, but "fixing" them changes generated prompts, so they're left as warnings to review deliberately. See [`plans/next-steps.md`](plans/next-steps.md). |
| `no-useless-escape` warnings | a few prompt/data regexes | Harmless redundant escapes; kept as warnings (changing regexes risks changing output). |
| Live generation unverified end-to-end | the provider adapters (`targets/web/shared/**`) | Fully exercising real image/text generation needs live provider keys (or a running SD WebUI); not done in CI. |

## Build / run health

| Area | Status |
|------|--------|
| `npm install` (Node 24) | ✅ resolves clean |
| `node --check` all JS | ✅ 0 syntax errors (152 files) |
| `npm run lint` | ✅ 0 errors (18 warnings, pre-existing) |
| Import smoke test (full graph + blocks + expansion) | ✅ green |
| `npm run test:unit` (Vitest, Node — unit/integration/snapshot/regression) | ✅ 128 passed |
| `npm run test:web` (Vitest, jsdom — SPA unit/component/contract/integration) | ✅ 60 passed (IntlProvider render wrapper added for i18n) |
| `npm run lint:i18n` (gui — `eslint-plugin-formatjs`) | ✅ 0 problems |
| `npm run test:e2e` (Playwright — E2E/visual/a11y) | ✅ 8 passed (system Chrome via `channel: "chrome"`; visual baselines committed). The bundled Chrome-for-Testing build hit an SxS launch error here even with VC++ present, so the config uses the system Chrome; CI can drop the channel. |
| `npm run test:perf:scenarios` (Playwright — gallery 100k · 1000 prompts · Manage 100k · hot-reload · max-load) | ✅ 5 passed (real release server; bounded DOM + heap ceilings + scroll/tab-switch budgets) |
| `npm run docs` (JSDoc + docdash doc-site, ~244 pages) | ✅ exit 0 |
| `gui` SPA `vite build` | ✅ green |
