# Storage & Settings — unified, versioned, cookie-free

Status: **in progress** (foundation landed on `feature/storage-config-layer`). This note is the
agreed design; the checklist at the bottom tracks what's built vs. pending.

## Goal

One coherent storage story for both run modes, owner's requirements:

- **All user storage in ONE folder** (local mode). No scattered `.gui-storage.json` at the gui root,
  no settings living in the browser when running locally.
- **Layered provider settings.** A provider ships its **defaults**; the user's folder may hold an
  **override** file with the *same name*; defaults load first, the override deep-merges on top — the
  user only writes the keys they actually changed.
- **Versioned configs.** Every stored document carries a schema version and migrates forward on load,
  so an old saved file is upgraded, never broken or silently dropped (don't corrupt user data).
- **Flexible merge.** Objects merge recursively; the strategy for arrays/scalars is explicit and
  predictable (delegated design — see "Merge semantics").
- **No browser storage at all in local mode.** `localStorage` is used **only** by the online build,
  which has no disk. Local run persists exclusively to the user-settings folder on disk.
- **Online mode: `localStorage` only, zero cookies.** The app sets no cookies in any mode (it never
  has — confirmed: the only `cookie`/`tough-cookie` hits in the tree are transitive jsdom/test deps,
  not app code). No cookie ⇒ no consent banner ever needed.
- **Manage section also manages "everything in cache."** List every stored namespace, view its JSON,
  delete one, clear all, export/import.

## The two layers (keep them separate)

### 1. Backend — one interface, two implementations (already exists, `gui/storage/`)

`StorageBackend` = `{ get(ns), set(ns,obj), remove(ns), keys() }`, selected by run mode:

- **online** → `browserStorage` (`localStorage`, prefix `rap.store.`).
- **local** → `localFileStorage` (HTTP `/api/storage` → real files on disk), browser fallback if the
  endpoint is unreachable (a static build with no server).

A namespace (`ns`) is an opaque key, e.g. `settings`, `wrappers`, `presets:openai`,
`providers/openai`. The app/providers read & write through this and never care where bytes live.

### 2. Config — versioned documents + cascade (new, `gui/storage/config.js` + `merge.js`)

On top of the backend:

- **Stored shape:** every document is wrapped `{ "__v": <int>, ...data }`. Bare legacy values (no
  `__v`) are treated as `__v: 0` and run through migrations.
- **Migration registry:** per-namespace ordered migration steps. `loadConfig(ns, {version, migrate})`
  reads the doc, applies steps `doc.__v → version`, returns the upgraded **data** (and re-saves if it
  changed, so the on-disk file heals itself once).
- **Cascade:** `loadConfigCascade(ns, defaults, opts)` = `deepMerge(defaults, migratedUserDoc)`. The
  user file holds only diffs from the defaults; missing file ⇒ pure defaults.
- **Save:** `saveConfig(ns, data, {version})` writes `{ __v: version, ...data }`. For provider
  overrides we save **only the diff** vs. defaults (`diff(defaults, value)`), keeping override files
  small and resilient to default changes.

### Merge semantics (the delegated call)

- **Plain objects:** merge recursively (override wins per leaf key).
- **Arrays:** **replace wholesale** by default — predictable, and right for ordered lists like
  samplers/sizes/workflow nodes where a positional merge would corrupt order. A namespace may opt into
  `arrays: "concat"` if it ever needs union semantics.
- **Scalars / type mismatch / `null`:** override wins (an explicit `null` in the override clears a
  default). `undefined` in the override means "not set" ⇒ keep the default.
- Never mutate inputs; always return fresh objects.

## On-disk layout (local mode)

```
engine-v3/
  user-settings/                 ← the ONE folder, gitignored (user data)
    settings.json                ← { __v, ...appSettings } (prompt knobs, image params, BYOK keys)
    wrappers.json                ← saved START/END wrapper presets (+ edited Default)
    presets.json                 ← custom setting presets
    providers/
      openai.json                ← override diff over gui/providers/openai defaults
      comfyui.json               ← …only the keys the user changed
      …
```

Provider **defaults** stay in the provider folder (`gui/providers/<id>/settings.js` `defaults`,
optionally a sibling `<id>.json` if a literal sidecar is preferred). Same logical name on both sides
(`<id>`), defaults-then-override, exactly as specified.

The dev-server `/api/storage` endpoint maps a namespace to a file under `user-settings/`: `providers/x`
→ `user-settings/providers/x.json`, everything else → `user-settings/<ns>.json`. It migrates the old
flat `.gui-storage.json` on first run (split into per-namespace files) and then leaves it alone.

## Cookies

Zero, permanently. Nothing in the app sets `document.cookie`; hosting is static (Netlify) with no
sessions. The functional `localStorage` we use is not a cookie and needs no consent for first-party
functional storage. If a future dependency tries to set one, that's the line we don't cross.

## Migration / back-compat (don't strand anyone)

Old browser keys are migrated **into the new layer** on first load, then the old keys are left in
place (harmless) or cleared once confirmed:

| Old (direct `localStorage`)        | New namespace        |
|------------------------------------|----------------------|
| `rap.settings.v2`                  | `settings`           |
| `rap.customPresets.v1`             | `presets`            |
| `rap.wrappers.v1` / `…default.v1`  | `wrappers`           |
| `settings.providerParams[id]`      | `providers/<id>` (diff) |

## Sync → async (the one real refactor risk)

`useSettings` currently loads **synchronously** in a `useState` initializer (localStorage). The
storage layer is **async**. Wiring main settings through it makes the initial load async: the app
shows a tiny "loading settings" state (or the defaults) for one tick, then hydrates. This ripples into
`App.jsx` (share-link seeding, the online fallbacks) and must be done carefully — it's the part most
able to destabilize the running app, so it lands as its own reviewable step with the full test gate.

## Checklist

- [x] `gui/storage/merge.js` — deep merge + diff, with tests.
- [x] `gui/storage/config.js` — versioned load/save + cascade, with tests.
- [x] Dev-server `/api/storage` → `user-settings/` folder layout (+ old-file migration, list).
- [x] Provider defaults extracted to literal `<id>.json` sidecars (static providers).
- [x] Route app settings / customStore / wrapperStore through the layer via the boot-time hydration
      cache (`gui/storage/cache.js`); legacy `localStorage` keys migrated forward. No direct
      `localStorage` in local mode.
- [x] Provider params persisted as per-provider override files (`providers/<id>`), reassembled into
      `providerParams` on load.
- [ ] **Manage "Storage / Cache" panel — DEFERRED (owner's design call).** A first cut (a local-mode
      list/view/delete/clear-all/export-import panel) was built and then **reverted at the owner's
      request**: how to surface storage management in-app — especially the **online** case, where the
      only store is `localStorage` and the Manage tab isn't available — is an open UX question the owner
      wants to design. Don't rebuild it without direction.
- [x] Gate green through the wiring (lint, smoke, test:unit 242, test:web 265, gui build) +
      notes/version (2.29.0).
