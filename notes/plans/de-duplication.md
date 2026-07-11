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

## Next: C — mobile imports the shared providers (delete `targets/mobile/lib/imageProviders.js`)

The foundation is in place: Metro already aliases `shared` (and `engine`), the registry is
Metro-importable, and the transport can be pointed at the phone's reality. What's left is the swap.

**The one real obstacle, found while doing it — an impedance mismatch, not a missing piece:**

- The **shared manifest** exposes settings *asynchronously* and *structured*:
  `loadSettings() → { defaults, fields, data }` (code-split; the web loads it lazily when the gear opens).
- The **mobile UI** currently reads a *synchronous, flat* `provider.settings = [{key,label,type,default,placeholder}]`
  array, and `providerDefaults(id)` walks it synchronously at render time.

So the swap is not a find-and-replace: mobile's provider-settings UI (and `providerDefaults`) must
become async (load-on-open with a spinner/suspense), exactly as the web's `ProviderBox` already is.
That is the correct end state — it's how the web works — but it is a real UI change, not a rename.

Order (each step green + committed on its own):

1. Mobile: make the provider-settings sheet **load its schema on open** (`await p.loadSettings()`),
   with the flat-array reader kept only as the rendering shape. Press-tests stay green.
2. Replace `IMAGE_PROVIDERS` / `TEXT_PROVIDERS` / `UPSCALE_PROVIDERS` with derivations of the shared
   registry (`providers`, `rewriteProviders()`, `upscaleProviders()`), and `generate`/`rewrite`/
   `upscale` with `await p.loadGenerate()` etc. Call `configureTransport({apiBase: backendUrl,
   forward: false, timeoutMs: 120_000})` at boot and whenever the Backend URL changes.
3. Delete `imageProviders.js` (~892 lines), including its re-implemented `submitPoll` /
   `localPostJson` / `fetchWithTimeout` — all of which now exist once in `_shared/transport/`.
4. `lib/capabilities.js` derives from the manifests (`transport === "none"` ⇒ copy-only; `loadUpscale`
   ⇒ upscalable) instead of the hand-kept arrays. The **locked-state** behavior it drives must not
   change (see working-agreements §E).

## Then: D — engine-domain logic still duplicated in mobile

These are *engine* concepts the mobile target hand-ported; they belong in `engine/`, imported by both:

| Mobile file | Lines | Belongs in | Note |
|---|---|---|---|
| `lib/dplInserts.js` | 262 | `engine/` | The DPL **insert catalog** — it describes the engine's own grammar. |
| `lib/listOps.js` | 71 | `engine/` | Sort / dedupe / clean of list content. |
| `lib/blockCatalog.js` | 218 | `engine/` | Block browsing + completions over the loaders. |
| rewrite system prompts (`systemFor`, `cleanDplOutput` in `imageProviders.js`) | ~120 | `engine/` or `shared/_shared/rewriteSystem.js` (already exists — mobile re-ported it) | `DPL_PRIMER` / `DPL_TASKS` **document the engine's grammar**; they are not a provider concern. |
| `lib/themeData.js` | 82 | `targets/shared/` | Design tokens, mirrored from the web's CSS tokens. |

## Then: E — retire the drift checks that duplication made necessary

Once mobile *imports* rather than *copies*, these steps of `scripts/mobile-parity-check.mjs` are
checking a file against itself and should be deleted: `checkAccents`, `checkDplInserts`,
`checkListOps`, `checkRewriteSystems`, `checkLocalSettings`, `checkProviders`.

**Keep `checkSurfaces`.** It is not a drift check — it asserts the mobile UI *exposes* every web
feature (the FULL-parity mandate), which no amount of code-sharing guarantees. Likewise keep the
capability-gating parity layer.

> The measure of success: deleting a parity check because the thing it guarded **can no longer
> differ**, not because we stopped caring.
