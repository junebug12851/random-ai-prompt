# Mobile ⇄ web FULL parity — the campaign

**Mandate (owner, 2026-07-10):** the mobile (Android/Expo) app must have **complete feature + appearance
parity with the web app — no exceptions, no size-based feature loss, no "mobile is simpler" version.** The
whole app is available on every device (phone and tablet) **to the extent the target platform allows**, and
parity is **enforced behind the release quality gate**. Nothing mandatory may be dropped, excluded, or
ignored. This supersedes the softer "keep them in parity by default" wording in
[`../systems/mobile.md`](../systems/mobile.md).

The **only** sanctioned non-parity is a genuine platform boundary, and even that is a **build variant, not a
feature drop**: the **SFW build physically removes NSFW** (content + the toggle) via the `--tier=sfw`
metro catalog (`catalog:play`) for the all-ages Play listing; an **NSFW-capable APK** (GitHub-only) keeps
it. So "to the extent the platform allows" = the SFW/NSFW split is a compile-time variant, not "mobile lacks
NSFW." Everything else must match.

## What is already at parity (green today)

- **Engine/data** — `metroLoader` output == `nodeLoader` (`scripts/metro-parity-check.mjs`): 89 blocks / 88
  lists identical, 150 seeded generations identical.
- **Ported catalogs** (`scripts/mobile-parity-check.mjs`): accents (9), locales, DPL insert categories (7),
  **provider role completeness** (image 15 / text 18 / upscale 17 — every mobile-capable web provider
  present), local provider settings fields.
- **Surface markers** for **Header / Generate / Gallery / Single** — a marker per web feature; a missing one
  fails the gate. (Manage is NOT yet covered — see gaps.)
- **Component/behavior** — `jest-expo` mounts the real screens (40 tests).
- **Visual** — `scripts/mobile-visual-parity.mjs` now shoots the **full phone→tablet size matrix**
  (phone-small 360, phone 390, phone-large 430, tablet-portrait 834, tablet-landscape 1112) into
  `artifacts/mobile-parity/<size>/`, not just one 390px phone.

## The gaps (the audit — 2026-07-10)

### 1. Manage — the big one (mobile is a small subset)

Web `Manage` (`targets/web/frontend/components/Manage*.jsx`) is a full content manager; mobile
`screens/ManageScreen.js` only manages **flat user word-lists** (add/edit/delete lines + filter). Full
parity (bounded by the platform: no fs backend on device, so it manages the **on-device user overlay** —
user lists + user blocks — the platform-allowed extent) requires porting:

- **Two roots + tree** — Blocks (generators) and Lists, a nested folder tree with category/subfolder
  styling, `force-prefix` / `group` badges, entry counts, NSFW gating (SFW-bounded), add-file / add-folder,
  per-folder gear (settings), and the phone master/detail swap (already the RN idiom).
- **Block (DPL) editor** — mirror `ManageBlockEditor.jsx`: the syntax-highlighted DPL editor (the mobile
  `GenerateScreen` already has a DPL code box — line-number gutter + `{…}` highlight layer under a
  transparent `TextInput` — **extract it into a reusable component** and reuse it here), Insert menu, Refine
  bar (Detail/Complexity/Focus/Intensity/Variety steppers + Cleanup), the free-text **Modify/Draft**
  control, name + description + NSFW flag, **JS sidecar** tab + "create sidecar", **Create override**.
- **List editor** — mirror `ManageListEditor.jsx`: Entries (virtualized) + **Raw** tabs, quick add /
  inline-edit / delete, **Sort / Dedupe / AI Expand**, description, **Create override / Restore default**.
- **Folder editor** — mirror `ManageFolderEditor.jsx`: name, priority, force-prefix, group mode, delete.
- **Override/restore + runtime overlay** — copying a built-in into the user overlay, and wiring the user
  overlay into `metroLoader` so `{name}` draws from it during generation (the current "next step").

### 2. Tablet / responsive layouts — no size-based feature loss

The web has phone (≤768) / tablet (769–1024) / wide tiers; several views are **two-pane** on tablet
(tree+editor side by side, e.g. Manage, Single). The mobile app is **single-column at every size** (only
Gallery/Single read `useWindowDimensions`, for grid columns / image sizing). To honor "no feature loss from
a size change":

- Add a shared **`useResponsive()`** hook (breakpoints mirroring the web tiers).
- Per screen: centered max-content-width for reading columns (Generate composer, Single detail, Manage
  editor) and **two-pane master/detail on tablet** for Manage + Single; Gallery uses the extra width for
  more columns (already width-driven).
- Every feature stays reachable at every size — nothing hidden or removed on small **or** large screens.

### 3. Gate coverage — encode the requirement

- Add a **Manage surface** to `mobile-parity-check.mjs` (marker per web Manage feature) — flip it **strict**
  when the port lands (until then it would correctly red the build, so it ships **with** the implementation,
  not before).
- Add **size/responsive assertions** (jest: the responsive hook + that each screen renders its full control
  set at phone AND tablet widths).
- Keep the "no per-feature ignores" philosophy: a missing feature is a FAILURE, not a note.

## Data-layer feasibility (confirmed 2026-07-10 — de-risks Phase 2)

- **Built-in catalog is fully readable on device.** `metroLoader` exposes `blockNames` / `listNames`,
  `readBlockMeta` / `readListMeta`, `blockForcedPrefixDirs` / `blockGroupDirs` / `groupListDirs`,
  `loadBlock`, `readListLines` — the same interface the web `getBlocks` uses (see `lib/blockCatalog.js`).
  So the read-only **built-in tree** (Blocks + Lists, folders, badges, NSFW gating) is straightforward.
- **Raw source IS in the static catalog.** `scripts/build-metro-catalog.mjs` inlines every `.dpl` as
  `dpDplText[key]` and every list as `listLines[key]`. So viewing a built-in block's DPL source and
  **override** (copy built-in → editable user overlay) are feasible. TODO for Phase 2: expose the raw
  `.dpl` text via a `metroLoader.readBlockSource(key)` (small loader addition; keep the loader interface
  parallel across node/browser/metro).
- **User overlay = the editable extent.** `lib/storage.js` currently stores only flat user **lists**
  (`rap/lists/*.txt`). Phase 2 extends it to user **blocks** (`rap/blocks/*.dpl` + `.json` sidecar) and
  **nested folders** (recursive walk, since `readDirectoryAsync` is one level), mirroring the web `user/`
  overlay. Runtime-overlay wiring into `metroLoader` (so `{name}` draws from the overlay during
  generation) is Phase 4.

## Status: COMPLETE (2026-07-10)

All phases below shipped green on `dev` in ~15 verified increments. The mobile Manage went from a
lists-only screen to a full AI-capable content manager at parity with the web (to the platform-allowed
extent), every surface has tablet layouts with no size-based feature loss, and the strict Manage parity
gate is ON. `test:mobile` 80/80 · `mobile:parity` (Header/Generate/Gallery/Single/Manage + listOps + all
17 rewrite-system modes) · `metro:parity` (89/88/150) — all green.

## Phased plan (each phase lands green; strict gates flip on with their implementation)

- **Phase 0 (done)** — audit + this plan; multi-size visual parity; jest FlashList-mock key fix.
- **Phase 1 (done)** — `useResponsive()` hook + per-screen tablet layouts: Gallery fills full width; a
  `ContentColumn` gives Generate/Manage the centered reading column; **Single goes two-pane on tablet**
  (image left, metadata right). No feature hidden at any size.
- **Phase 2 (done)** — on-device storage overlay (user blocks + folders + sidecars + tree) + `listOps`
  port (Sort/Dedupe) with a parity-lockstep check.
- **Phase 3 (done)** — full RN Manage: two-root folder tree; block editor (DPL + Insert + Refine +
  Modify/Draft + JS sidecar + rename/delete/description/NSFW); list editor (Entries/Raw + Sort/Dedupe +
  description + AI Expand); runtime overlay (custom content feeds generation); built-in browse + override.
  DPL system prompts ported verbatim + parity-gated (all 17 modes).
- **Phase 4 (done)** — strict Manage surface gate ON (22 markers; missing feature = build failure).

### Historical detail (superseded by the above)
- **1a** — Gallery full-width + `ContentColumn` centered columns.
- **Phase 2** — extract the reusable DPL editor component from `GenerateScreen`; build the mobile Manage
  **Blocks** root + block editor (DPL + Insert + Refine + Modify/Draft + JS sidecar) to parity.
- **Phase 3** — mobile Manage **Lists** editor (Entries/Raw/Sort/Dedupe/AI-Expand) + **folder** tree +
  folder editor + override/restore; two-pane on tablet.
- **Phase 4** — wire the user overlay into `metroLoader` runtime generation; flip the strict Manage gate on;
  full green across `mobile:parity:all` + `test:mobile` + multi-size visual.

## Verify (the release gate)

`npm test` (includes `mobile:parity` + `test:mobile`) + `npm run mobile:parity:all` (engine + surface +
multi-size visual) must be green. No release with a red parity gate.
