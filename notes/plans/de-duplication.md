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

## Next: E — engine-domain logic STILL duplicated in mobile

These are *engine* concepts the mobile target hand-ported; they belong in `engine/`, imported by both:

| Mobile file | Lines | Belongs in | Note |
|---|---|---|---|
| `lib/dplInserts.js` | 262 | `engine/` | The DPL **insert catalog** — it describes the engine's own grammar. Guarded by `checkDplInserts`. |
| `lib/listOps.js` | 71 | `engine/` | Sort / dedupe / clean of list content. Guarded by `checkListOps`. |
| `lib/blockCatalog.js` | 218 | `engine/` | Block browsing + completions over the loaders. |
| `lib/themeData.js` | 82 | `targets/shared/` | Design tokens + locales, mirrored from the web's CSS tokens. Guarded by `checkAccents` / `checkLocales`. |

Each row's "guarded by" is the drift check that will be **deleted along with the copy** — that's the
tell that the copy shouldn't exist. (The rewrite system prompts + `cleanDplOutput` were on this list and
are **done**: they now live once in `shared/_shared/rewriteSystem.js`.)

## Done: the drift checks that duplication made necessary

`checkProviders`, `checkRewriteSystems` and `checkLocalSettings` are **deleted** (2.54.0) — mobile derives
all three from the shared layer now, so they were comparing a file to itself. The remaining drift checks
(`checkAccents`, `checkLocales`, `checkDplInserts`, `checkListOps`) each guard a copy listed above, and go
when that copy does.

**`checkSurfaces` stays — permanently.** It is not a drift check: it asserts the mobile UI *exposes* every
web feature (the FULL-parity mandate), which no amount of code-sharing guarantees. Same for the
capability-gating layer.

> The measure of success: deleting a parity check because the thing it guarded **can no longer
> differ**, not because we stopped caring.
