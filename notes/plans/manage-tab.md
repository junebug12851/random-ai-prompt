# Plan — the "Manage" tab (in-app content manager)

> Status: **proposal, awaiting go-ahead.** No engine code written yet. This is the
> review document requested before implementation.

## 1. Goal

Add a 4th top-level tab, **Manage**, after Single. It is the app's content manager:
the same two-pane skeleton as Generate (left tree + a big right pane), but instead of
*composing* prompts it *edits the catalog* — the dynamic-prompt generators ("blocks"),
the word lists, and the folder/category structure that organizes them, directly on disk
under `data/dynamic-prompts/` and `data/lists/`.

Decisions already settled (owner answers, 2026-06-28):

- **Runtime / hot edit.** Manage loads and applies edits at runtime like v1–v2 did. True
  hot live-apply where it's clean (no eval hacks); and when hot-apply is available we also
  **watch the `data/` files for external edits** and refresh automatically. There is always a
  manual **"Refresh catalog"** button as the fallback.
- **Edits the real `data/` files.** Full control for the user — it's their open-source
  copy. No separate overlay layer; Manage writes the actual source files.
- **Gated on local *mode*, not release stage.** Online vs local are runtime **modes**, each of
  which must work in **both dev and production** — they are not tied to a build/release stage.
  Manage requires **local mode** (i.e. the file-API backend is present); it is detected by a
  runtime capability probe, not by the `ONLINE` build flag or dev-vs-prod. In **online mode**
  (no local backend) Manage is shown disabled with a lock, like Gallery/Single in that mode.
- **Restore-defaults fetches from the stable branch `main`** (not `master` — that branch is stale
  old-layout; confirmed with the owner 2026-06-28).

## 2. The core technical question: can hot live-apply be clean?

The browser engine today loads **all** catalog data statically at build time via Vite
`import.meta.glob({ eager: true })` in `src/core/browserLoader.js`, and `gui/src/lib/promptEngine.js`
builds the engine **once** at module load and computes the block catalog in module-level
constants. So nothing reflects a disk change without a full reload today.

**Verdict — hot-apply is achievable cleanly for the content that matters, with one honest boundary:**

| Content | Hot-apply? | Why |
|---|---|---|
| Lists (`.txt`), group files (`.group`) | ✅ clean | plain text — re-fetch + re-split at runtime |
| JSON sidecars (`*.json`) | ✅ clean | parsed at runtime |
| Folder structure + `_`-marker files | ✅ clean | derived from a fetched file listing |
| `.dpl` generators | ✅ clean | already compiled at runtime by `compileDpl(text)` in both loaders — fetch the text, compile it |
| `.js` generator **modules** | ⚠️ reload | executing newly-edited JS in the browser needs `eval`/dynamic blob import — that's the kind of hack we're avoiding |

This boundary is comfortable: the **active** catalog is `.dpl`-first (every generator
surveyed is `.dpl`; `.js` files are sidecars or frozen legacy). So Manage authors and
hot-applies `.dpl` generators + lists + structure; the rare case of editing an executable
`.js` module's *code* is the only thing that asks for a page reload to re-run, and we'll
say so in the UI. Everything a normal user does hot-applies.

### How the refresh works (no hacks)

Introduce a third loader implementing the **same loader interface** the engine already
depends on (`readListLines`, `listNames`, `loadDynamicPrompt`, `dynamicPromptNames`,
the marker/group/meta accessors) — `gui/src/lib/runtimeLoader.js`:

- On first use (and on every refresh) it fetches a **catalog snapshot** from a new
  dev-server endpoint (`GET /api/manage/snapshot`): every list's text, every `.dpl` text,
  every `.group`, every sidecar JSON, and the set of `_`-marker dirs. It holds these in a
  mutable in-memory store and answers the loader interface synchronously from that store
  (the interface must stay sync — it's called inside string-replace callbacks).
- `.js`-module generators that exist on disk are still served by the build-time glob
  (the current `browserLoader`), so they keep executing; the runtime loader *overlays*
  the fetched text content on top. (Practically: runtime loader for text/dpl/lists/meta,
  delegate to the bundled glob only for `.js` module execution.)
- A `refresh()` clears caches (`dplModCache`, the `listStore`), re-fetches the snapshot,
  resets the classifier, and recreates the engine.

This requires refactoring `promptEngine.js` from eager module-level computation into a
**rebuildable** form (a `rebuild()` that re-creates `engine`, re-runs `promptFiles.loadAll()`,
and recomputes `getBlocks`), and adding a `reset()` to `promptFilesAndSuggestions.js` (it
currently pushes into module-level arrays that must be cleared on reload). Generate simply
reads the rebuilt catalog, so edits in Manage appear there live, same session.

Net: **true hot live-apply for lists / `.dpl` / structure / sidecars; a one-line "reload to
run" note only when someone edits an executable `.js` module body.** No eval, no HMR hacks.

### External-edit detection

Because hot-apply works, the local-mode backend also **watches the two `data/` roots**
(`fs.watch` / a small watcher) and pushes change events to the client (SSE), which triggers a
scoped `refresh()` — so editing a file in another editor updates the catalog automatically.
Watching is best-effort (it can be flaky on some platforms/network drives); the always-present
**"Refresh catalog"** button is the guaranteed fallback, never gated on the watcher working.
JS-module **execution** still never hot-applies (§4c) — a watcher event on a `.js` body just
flags "reload to run", it doesn't try to re-execute it.

## 3. New local-mode API (`/api/manage/*`)

This is the **local-mode backend** for content management — part of "local mode", not a
dev-only thing (§1). Today local mode is hosted by the Vite middleware (`gui/vite-plugin-api.js`),
and a production local build/desktop hosts the **same** endpoints; online mode simply doesn't
provide them. The surface is modeled on the existing image/storage middleware (same
`readJson`/`send` helpers, localhost-only, **path-traversal guarded** to `data/lists` and
`data/dynamic-prompts` only). The client decides Manage is available by probing this surface
(e.g. `GET /api/manage/snapshot` succeeds), independent of build flag or release stage:

- `GET  /api/manage/snapshot` — the full catalog snapshot (above) for the runtime loader.
- `GET  /api/manage/tree` — the raw folder tree of both roots (for the left panel), including
  `_`-marker files and `.json` sidecars, so the UI can show real structure.
- `GET  /api/manage/file?path=…` — read one file's text (used by the raw list editor /
  generator editor for on-demand load of large files).
- `GET  /api/manage/list?path=…&offset=&limit=&q=` — **paged/searched** list entries for the
  entry-management view (so a 27k-line list never loads whole into the UI).
- `POST /api/manage/file` — write a file's text (lists, `.dpl`, `.group`).
- `POST /api/manage/list/op` — targeted list mutations (add/edit/delete/move entries) applied
  server-side so the client doesn't round-trip 27k lines per edit.
- `POST /api/manage/sidecar` — read-modify-write a `*.json` sidecar (merge keys).
- `POST /api/manage/marker` — create/remove a `_`-marker file (`_force-prefix`,
  `_enable-group-list`, `_disable-group-list`).
- `POST /api/manage/fs` — folder/file ops: **create folder, create generator/list** (the Add
  buttons, §4a), rename, delete, move (the drag-drop target). Every destructive op is explicit +
  confirmed in the UI.
- `GET  /api/manage/watch` — Server-Sent Events stream of `data/` change events (the external-edit
  watcher, §2). Best-effort; the manual refresh button doesn't depend on it.

All writes return the affected paths so the client can trigger a scoped `refresh()`.

## 4. UI — the Manage view

New `gui/src/components/Manage.jsx` (+ subcomponents), mounted as a 4th `view-pane` in
`App.jsx`. Tab wiring: add `["manage", "Manage", "The content manager"]` to `TABS`, render it
after Single, lock it in the online build like Gallery/Single. NSFW toggle stays in the header
(it gates editing options); ProvidersMenu/ProviderGear stay hidden on this tab (already gated to
`view === "generate"`).

### 4a. Left panel — the real tree

Unlike Generate's flattened "All + folder sub-tabs", Manage shows the **actual nested folder
structure** of both roots and makes the engine's hidden mechanics legible:

- **Color-coding:** one treatment for top-level **categories**; a distinct one for subfolders
  that are *not* categories or that carry special attributes (force-prefix, group, nsfw).
- **Gear button beside each folder/category name** (left, next to the label — *not* on the right
  where the count-pill sits). Opens the **folder settings editor** (§4b).
- **Pills/chips stay** (visually like Generate) but **clicking a pill does nothing**; instead each
  pill reveals **hover icons: Edit and Delete**. Edit opens that item's editor (§4c/§4d); Delete
  confirms then removes the file.
- **Add buttons** — explicit, always-visible controls to **add a folder** and **add a file**
  (a generator or a list) into the selected/hovered folder (plus per-folder "+" affordances).
- **Drag-and-drop** to reorder and move items/folders (native HTML5 DnD — no new dependency).
- **Search bar** retained (filters the tree).
- **Refresh catalog** button (the §2 fallback) lives in the panel header.
- Visual indicators for: forced-prefix folders, group (pick-one) folders, category sort priority,
  and ignored/internal `_` files (which are shown as *state on the folder*, never as raw files).

### 4b. Folder / category settings editor

Opened from a folder's gear. Edits name + the JSON-sidecar options, and **abstracts the
`_`-prefixed config files into plain controls** (checkboxes/fields), never exposing them as files:

- Rename folder.
- `priority` (category sort order), `description`, `forceList`, `nsfw` — sidecar JSON fields.
- **Force prefix** (`_force-prefix` marker) — toggle.
- **Group behavior** — toggle (`_enable-group-list` / `_disable-group-list`), with the implied
  default (2+ items ⇒ group) shown.
- Saving writes the sidecar/markers via the API and triggers `refresh()`.

### 4c. Block (generator) editor

Reuse the existing `DplEditor` (CodeMirror + DPL highlighting/autocomplete). Edit the
generator's **name** and **`.dpl` contents**; edit its sidecar **description**. **NSFW toggle**
is enabled only when the header NSFW switch is on; otherwise greyed with tooltip *"NSFW option
only available in NSFW mode."* (NSFW is set by the `nsfw` sidecar key / name token, matching the
engine's `isGatedDynPrompt`.)

**JS sidecar support.** A `.dpl` generator may have a same-name `.js` sidecar (for
`script:` / `{js:}` / `insert js:` logic). The editor:

- If a `.js` sidecar exists, shows an easy **DPL ⇄ JS switch** (two tabs) — the `.dpl` in the
  DPL editor, the `.js` in a **JavaScript CodeMirror** (JS language mode, `@codemirror/lang-javascript`).
- If there's no sidecar, offers **"Create JS sidecar"**, which instantly scaffolds the file from a
  **boilerplate template** (the expected `export default function (settings, imageSettings,
  upscaleSettings) { … }`, with the optional `full` / `suggestion_exclude` exports commented in) and
  switches to the JS tab.
- Per the §2 boundary, **JS is editable and saved, but its execution does not hot-apply** — the JS
  tab shows a small persistent "saved — reload to run" note (DPL and everything else still hot-apply).

### 4d. List editor (new — lists have no editor today)

Two modes:

- **Entry management (default).** A virtualized, searchable list of entries with quick scroll and
  per-entry add/edit/delete/reorder. Backed by the paged `GET /api/manage/list` + targeted
  `POST /api/manage/list/op`, so a 27k-line list (e.g. `place/city.txt`, `word/noun.txt`) never
  loads whole into React state and edits don't re-send the whole file.
- **Raw editing.** Plain-text CodeMirror (no DPL highlighting), loaded on demand with
  debounced/explicit save. CodeMirror 6 is built for very large documents (viewport-only rendering),
  so this stays smooth at any size.

### Large-file strategy — seamless at any size, no warnings

**No size warnings, no caps.** Extremely large lists must feel as smooth as small ones; if any size
feels slow, that's a bug to fix, not to warn about. The design that delivers this:

- **Entry mode:** server-side paging + search (`GET /api/manage/list`) and targeted server-side
  mutations (`POST /api/manage/list/op`), so the UI holds only the visible window and a single edit
  never round-trips the whole file.
- **Raw mode:** CodeMirror's viewport rendering handles multi-MB docs; saves are atomic and
  debounced.
- Confirmed scale to design against: `place/city.txt` ≈ 27,100 lines, `word/noun.txt` ≈ 23,100.
- The *engine* still keeps all list text in memory to generate (its existing footprint today,
  unchanged) — that's separate from the editor UI, which never loads a whole large file into React
  state.

### 4e. Revert to default (fetch originals from the repo)

Because Manage edits the user's real `data/` files destructively, offer a **"Restore default"**
action that re-fetches the original file(s) from the project's GitHub repo and overwrites the local
copy — per file, per folder/category, or all. This is the safety net for "I tore it up and want it
back."

- Fetch via the GitHub raw content for the project from the **stable branch `main`**
  (`raw.githubusercontent.com/<owner>/<repo>/main/data/<path>`). The owner first said
  "master", but `master` is a stale old-layout branch with no flat-layout tree (restore would 404);
  confirmed 2026-06-28 to use `main`, which carries the current layout.
  A file deleted upstream ⇒ the restore deletes the local copy; a file the user added that doesn't
  exist upstream ⇒ left alone (with a note).
- Surfaced as: a **"Restore default"** item in a file/folder's hover menu and a top-level **"Restore
  all defaults"** in Manage; both confirm first and show a diff/summary of what will change.
- Available in local mode whenever the network is reachable (it's a network fetch regardless of
  dev vs prod); if the fetch fails it reports the error (never silently leaves a half-written file —
  atomic write per §5).
- API: `POST /api/manage/restore` (server fetches the raw file(s) and writes them, traversal-guarded
  like all other ops), then a scoped `refresh()`.

## 5. Safety & correctness

- Path-traversal guards on every API path (restrict to the two data roots), mirroring
  `resolveOutputFile`.
- Destructive ops (delete/rename/move) confirmed in the UI; writes are atomic (temp + rename) to
  avoid corrupting a list mid-write.
- Never silently swallow errors — surface them (project principle).
- Validate `.dpl` compiles before save (warn, allow override); validate sidecar JSON.
- Respect CRLF working-tree reality (memory: `crlf-working-tree-noise`) — preserve a file's existing
  line endings on write.

## 6. Testing (per `notes/plans/testing.md`)

- **Vitest (Node):** the new API handlers (contract tests — read/write/rename/move/marker round-trips
  against a temp data dir); the runtime loader; `promptEngine.rebuild()` / `promptFiles.reset()`.
- **Vitest (jsdom):** Manage components — tree render, color-coding, pill hover Edit/Delete, folder
  settings editor, list entry mode, NSFW gating of the editor toggle.
- **Playwright (e2e + visual + a11y):** open Manage, edit a `.dpl`, confirm Generate reflects it live;
  add/delete an entry; create a folder; visual baseline for the tab.
- **Smoke:** unchanged gate; ensure the runtime-loader refactor doesn't break `npm run smoke`
  (the Node loader path) or the browser build (`npm --prefix gui run build`) — both must stay green
  (depth-sensitive generator imports + the glob).

## 7. Phased delivery (feature branch `feature/manage-tab`)

1. **Plumbing:** `/api/manage/snapshot` + `tree` + `file`; the runtime loader; refactor
   `promptEngine.js` to rebuildable + `promptFiles.reset()`; verify Generate still works and a
   manual disk edit hot-applies. (No UI yet.)
2. **Tab + read-only tree:** mount Manage, render the real folder tree with color-coding,
   counts, gears, pills (Edit/Delete icons inert), search; online lock.
3. **Editors:** block (`.dpl`) editor wired to save+refresh with NSFW gating; folder settings
   editor (sidecar + marker abstraction).
4. **List management:** entry mode (paged) + raw mode (large-file safe); list create/delete;
   **restore-default** (fetch originals from the repo) per file/folder/all.
5. **Structure ops:** create subfolders/buttons, rename, delete, **drag-and-drop** move.
6. **Polish + tests + docs:** visual pass, full test suite, update notes (`systems/gui.md`,
   `status.md`, version/changelog). One new dependency is expected — **`@codemirror/lang-javascript`**
   for the JS sidecar editor (§4c) — so update `reference/dependencies.md` and `list-credits.md`.

Each phase is independently shippable on the branch; we verify (`npm test` + the browser build)
before moving on, and merge `--no-ff` to `dev` at the end per the git-flow standard.

## 8. Open questions / risks

- **`.js`-module hot-apply boundary** (§2/§4c) — *resolved:* no JS hot-reload; JS is editable, a JS
  sidecar can be scaffolded from boilerplate, with easy DPL ⇄ JS switching; JS saves but reloads to run.
- **Stable-branch name** — *resolved:* restore fetches from **`main`**. `master` turned out to be a
  stale old-layout branch with no flat-layout tree (would 404); owner confirmed `main` 2026-06-28.
- **Drag-and-drop scope** — *resolved:* don't build custom sorting; ride on the app's existing
  sort/display. Dragging a block/category around just **adjusts its `priority`** (abstractly), and the
  edit menu still exposes the **raw priority number** for direct editing. Folders/files move via DnD;
  no separate stored-order field.
- **Deleting a list/category that's referenced** by a `.dpl` (`{list}` / `{#gen}`) — warn on
  dangling references? (Proposed: yes, a soft warning, not a hard block — it's the user's copy.)
