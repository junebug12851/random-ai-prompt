# De-duplication: push shared behavior down, keep targets thin

**Why this plan exists.** The owner asked, looking at the mobile provider code: *"this feels dumb —
why isn't providers handled on an engine level? I'm actually wondering how much functionality that
should be in the engine is not, and duplicated to the targets."* They were right, and the answer
generalizes past providers:

> As much as possible that is **not specific to a target** should live in the engine; anything else
> that's common to several targets should live in a **shared layer**. A target is a thin wrapper.

This is [`working-agreements.md`](../reference/working-agreements.md) §A3 stated as a campaign.

## The root cause (worth understanding, because it will recur)

Every plugin pool in this repo (providers, blocks, lists) is **drop-a-folder-in**, so it needs a
*discovery* mechanism. Each runtime discovers differently — and there is **no intersection**:

| Runtime | Target | Discovery |
|---|---|---|
| Vite | web | `import.meta.glob` |
| Node | CLI, backend | `fs.readdirSync` + dynamic `import()` |
| **Metro** | mobile | **neither** — a static module graph, no fs at runtime |

When a shared module reaches for one of these, the other targets **cannot import it** — and the path
of least resistance is to hand-port it. That's the whole story of the duplication: the provider
registry got a Vite glob, so the CLI re-ported it (fs scan) and mobile re-ported it *again* (892
hand-written lines). The parity checks (`scripts/mobile-parity-check.mjs`) were then invented to
*detect the drift* — treating the symptom.

**The rule that falls out of this** (now in [`../decisions/architecture.md`](../decisions/architecture.md)):
a module intended to be shared across targets **may not touch `import.meta` or `node:`**. Discovery
goes through a **generated static index** — plain `import` statements, the one construct all three
runtimes understand. Anything genuinely platform-specific is **injected by the target**, not forked.

## Done

- **A — `targets/web/shared/` → `targets/shared/`** (2.52.0). The provider adapters were living
  *inside* the web target while the CLI and mobile reached into it. Now a first-class cross-target
  layer, siblings under `targets/`.
- **B — one provider registry for all three runtimes** (2.53.0). `targets/shared/registry.generated.js`
  (`npm run registry`; `npm run check:registry` in `npm test` fails if stale). `shared/index.js` is
  runtime-agnostic. Web-only online-gating moved to the web shim. **CLI registry: 145 lines → a thin
  facade** (its duplicate `applySharedSettings` deleted).
- **B2 — the transport is now injectable** (`_shared/transport/config.js`). This was the *reason* a
  native target couldn't reuse the providers at all:
  - `hosted-proxy` hardcoded a relative `fetch("/api/generate")` — a browser has an origin, a native
    app does not → `configureTransport({ apiBase })`.
  - `local-direct` tunnels through `/api/forward` purely to dodge **browser CORS**; RN has no CORS and
    should call the user's server directly → `configureTransport({ forward: false })`.
  - RN's `fetch` has no timeout → `configureTransport({ timeoutMs })`.
  Defaults reproduce the web's exact behavior (web = no-op). 11 contract tests, proven by
  re-introducing both bugs.
- **B3 — provider `description` / `keyUrl` moved onto the manifests.** Was a hand-kept `PROVIDER_META`
  table in the web + a second copy inside mobile's registry. Now declared once, next to the provider.

- **C — mobile imports the shared providers** (2.54.0). The 892-line hand-port is **deleted**; a 268-line
  adapter derives the three role lists from the same manifests the web uses and dispatches into the shared
  provider code. The settings-schema mismatch (async manifests vs a sync UI) was resolved by **preloading
  every schema once at boot** — not by making the UI async: on a phone the bundle already ships everything,
  so lazy code-splitting buys nothing. `cleanDplOutput` moved to `shared/_shared/rewriteSystem.js`;
  `keyHint` joined the manifests. Contract-tested (17 tests) in
  `targets/mobile/lib/__tests__/imageProviders.test.js`.
- **D — retired the drift checks the duplication made necessary** (2.54.0). `checkProviders`,
  `checkRewriteSystems`, `checkLocalSettings` deleted from `scripts/mobile-parity-check.mjs` — they now
  compare a file to itself. `checkSurfaces` **kept** (it asserts the UI *exposes* every web feature, which
  code-sharing does not guarantee).

## Historical: how C was originally scoped (kept — the obstacle it names is instructive)

> The shared manifest exposes settings *asynchronously* (`loadSettings() → {defaults, fields, data}`,
> code-split), while the mobile UI reads a *synchronous flat* `provider.settings` array. So the swap is not
> a find-and-replace: mobile's provider-settings UI must become async…

That framing was **wrong in its conclusion**, and it's worth remembering why. The async-ness of
`loadSettings()` is a *web* concern — it exists so the browser can code-split the gear. A phone has already
downloaded the whole bundle, so the right move was to **resolve the asynchrony once at boot** (preload all
schemas + their option sources) and keep the UI synchronous. Making the mobile UI async would have imported
the web's constraint along with the web's code. **Share the logic; don't inherit the other platform's
trade-offs.**

- **E (partial) — engine-domain logic promoted out of mobile** (2.55.0):
  - `listOps.js` (71 lines) → **`engine/listEditorOps.js`**. Sort / dedupe / AI-candidate parse of *list
    content* is engine domain — "what counts as a duplicate entry" is a property of the engine's lists,
    not of any one UI. Both Manage editors import it; the mobile copy and `checkListOps` are deleted.
  - `themeData.js` (82 → 24 lines) → the accent themes moved to **`targets/shared/theme/themes/*.json`**
    with a generated static index. Same root cause as the providers: the web discovered them with a Vite
    `import.meta.glob` that Metro can't run, so mobile transcribed all nine by hand. `checkAccents` deleted.
    (`gen-accents.mjs` still emits the same byte-identical `accents.css` — only its source path moved.)

- **E (cont.) — `blockCatalog` → `engine/blockCatalog.js`** (2.59.0). The building-block catalog (the
  token cloud + the DPL autocomplete) is engine domain — it describes the engine's own content pools,
  their folder categories, the `{#any}` / `{keyword}` wildcards and the NSFW gate — and is a pure
  function of a **loader**, which is exactly why it could be shared: each target passes its own
  (`runtimeLoader` in the browser, `metroLoader` on the phone). The web's `promptEngine.js` went 411 →
  219 lines and **mobile's 218-line hand-port became 33 lines**. That copy had **no drift check at
  all** — the worst case, since nothing would have noticed the phone falling behind. Replaced with a
  real test (`tests/unit/blockCatalog.test.js`, 9 tests) that pins the catalog's rules AND asserts the
  phone never invents content the engine doesn't have.

- **E (done) — `dplInserts` → `engine/dplInsertCatalog.js`** (2.60.0). The **last hand-port**, and the
  one the plan called "entangled": the web localizes the menu's labels through react-intl descriptors
  while mobile inlines English, so a naïve "share the module" would have dragged react-intl into React
  Native. The split that resolved it is the general answer to that whole class of problem:

  - **The grammar moved** — ids, DPL `syntax`, editor `template`, `example`, the `${…}` template
    conventions and `materializeTemplate`. It describes what `engine/core/dpl/dpl.js` *compiles*, so it
    was never the web's to own.
  - **The label layer stayed** — the web keeps its react-intl messages, mobile keeps its English table.
    Each target attaches its own via `buildInsertMenu({category, item})`. Presentation is
    platform-specific; grammar is not.
  - Label keys are **derived from the catalog ids** (`camelId`: `one-of-nothing` → `oneOfNothing…`), so a
    construct added to the grammar with no string in a target fails
    `tests/unit/dplInsertCatalog.test.js` instead of rendering `undefined` on a phone. That test is what
    `checkDplInserts` became: the copies can't drift (there are none), but a label layer *can* fall
    behind, and that's what's now asserted.

  Mobile's file went 262 lines → a label table. `checkDplInserts` is **deleted**.

## Next: E — nothing. The campaign's hand-ports are all gone.

Every mobile hand-port the audit found has been promoted:

| Was | Lines | Now | Its drift check |
|---|---|---|---|
| `lib/imageProviders.js` | 892 | `targets/shared/` registry | `checkProviders` / `checkRewriteSystems` / `checkLocalSettings` — deleted |
| `lib/listOps.js` | 71 | `engine/listEditorOps.js` | `checkListOps` — deleted |
| `lib/themeData.js` (accents) | 82 | `targets/shared/theme/` | `checkAccents` — deleted |
| `lib/blockCatalog.js` | 218 | `engine/blockCatalog.js` | (had none — the worst case) |
| `lib/dplInserts.js` | 262 | `engine/dplInsertCatalog.js` | `checkDplInserts` — deleted |

The "its drift check" column is the tell: **every check deleted here was deleted because the thing it
guarded could no longer differ.** What remains in `scripts/mobile-parity-check.mjs` is `checkLocales`
(one line of config, not a port), plus the three permanent gates that code-sharing does NOT satisfy —
`checkSurfaces` (the UI exposes every web feature), `checkGating`, and `checkNoCaps`.

## Done: the drift checks that duplication made necessary

**Six of seven are gone.** `checkProviders`, `checkRewriteSystems`, `checkLocalSettings` (2.54.0),
`checkListOps` and `checkAccents` (2.55.0), and `checkDplInserts` (2.60.0) are **deleted** — mobile
derives all of them from the shared layer / engine now, so each was comparing a file to itself. Only
`checkLocales` remains, and it guards a config list, not a port.

**`checkSurfaces` stays — permanently.** It is not a drift check: it asserts the mobile UI *exposes* every
web feature (the FULL-parity mandate), which no amount of code-sharing guarantees. Same for the
capability-gating layer.

> The measure of success: deleting a parity check because the thing it guarded **can no longer
> differ**, not because we stopped caring.
