# Architecture Decisions

Key structural choices and why. (Things tried and rejected live in [`rejected.md`](rejected.md).)

## Scaling to the max supported load: virtualize, contain, chunk (2026-07-04)

The app promises to stay seamless at a **100k-image gallery + 1000 prompts / ~10k images + a 100k-line
Manage file, all at once**. Three different techniques, chosen per surface:

- **Gallery → windowing (bounded DOM).** 100k feed items can't all be DOM nodes, so `Gallery.jsx`
  renders only the viewport window (+ overscan) using the pure `targets/web/frontend/lib/virtual/windowRange.js`
  (a full-height spacer keeps the scrollbar honest). This required trading the old wide/tall **masonry**
  for **uniform square cells** — exact row-windowing needs a fixed row height; dense masonry packing
  can't be windowed without measuring every prior item. Uniform cells are the standard large-gallery
  choice and keep captions/hover/search intact. The Manage list editor already used the same idea inline.
- **Results list → render-containment (all rows present, offscreen skipped).** The 1000-prompt list must
  "roll out all at once", so windowing (which removes rows) is the wrong fit; instead `content-visibility:
  auto` on `.prompt-result` lets the browser skip layout/paint/**image decode** for offscreen rows while
  every row stays in the DOM. Paired with a **memoized `PromptResult`** and stable row identity across
  `setPrompts` (unchanged rows keep their object reference), so one image landing re-renders one row.
- **Generation → placeholder-first + concurrency-limited queue.** `useImageBatches.makeBatch` sets the
  busy placeholder **synchronously** for every prompt, then runs the real generate behind a limiter — so
  10k images never fire 10k requests. Why a limiter and not "just await sequentially": we want a bounded
  *few* in flight for throughput without a stampede. Rewrites use a *separate* limiter (below).

## Per-provider concurrency as the first shared provider setting (2026-07-04)

The right request concurrency differs per provider (a local ComfyUI can run wide; a hosted API is
rate-limited and the browser caps ~6 requests/host — which is also the online build's only constraint,
since online providers are all browser-direct). So the "Batch chunk size" is **per-provider**, and lives
in each provider's settings — not a global gear knob (an earlier global attempt was reverted).

Rather than copy the field into ~40 provider folders, it's the first entry in a new **shared-settings
system** (`targets/web/shared/_shared/settings/`): each shared setting is an auto-discovered module (globbed,
like providers/dynamic-prompts) exporting `{ key, applies, defaultFor, field }`, and
`applySharedSettings` folds each applicable one into a provider's schema **at the registry**
(`targets/web/shared/index.js`), so it flows identically to the gear UI (`ProviderBox`) and the flattened
generation settings (`flattenForProvider`). Defaults are metadata-derived (local 6 / hosted 3 / poll 4),
overridable per provider (`config.concurrencyDefault`), and a provider that declares its own field keeps
it (escape hatch). It applies to image, text (rewrite), and upscale providers independently — the Home
image queue reads the image provider's value; rewrites go through a separate limiter sized to the text
provider's. This was a deliberate "build a proper system, no shortcut" choice (owner-directed), and the
structure was picked via AskUserQuestion when the owner was deliberating it.

## SPA i18n: react-intl + FormatJS, English-only shipped, pipeline-ready (2026-06-28)

The SPA was internationalized with **react-intl** driven by the **FormatJS** toolchain. Choices and why:

- **react-intl over i18next.** react-intl is ICU-MessageFormat-native (correct plurals/gender/number/date
  via the platform `Intl`), integrates as React context + hooks, and pairs with a mature build-time
  extractor (`@formatjs/cli`) + babel plugin. The app already needed correct plurals (counts everywhere)
  and `Intl` number formatting, which is react-intl's strength.
- **Inline `defaultMessage` is the source of truth; the catalog is generated.** Every string is authored
  in-place as `defineMessages`/`<FormattedMessage>` with an explicit, namespaced `id` and an English
  `defaultMessage`. `npm run i18n:extract` produces `src/i18n/messages/en.json`; we do **not** hand-write
  the English catalog. The source locale (`en`) ships **no** runtime catalog — react-intl renders from the
  inline `defaultMessage` (`babel-plugin-formatjs` keeps it in the bundle). Only non-source locales get a
  compiled catalog, loaded via `import.meta.glob` (mirroring the engine's browser data loader).
- **English is the only shipped real locale (deliberate).** The owner's bar was "ship a language only if
  the translation is genuinely good." The app is thick with untranslatable-by-machine domain jargon (DPL,
  prompt "salt", wrappers, expansions, dynamic-prompt tokens, NSFW gating) that can't be verified, so no
  other language ships. The whole pipeline is in place, so adding a real, human-reviewed language is a
  one-file drop-in (`compiled/<locale>.json` + a `LOCALES` entry). A generated **`en-XA` pseudo-locale**
  (accented/expanded English) ships as a coverage aid — flipping to it surfaces any un-internationalized
  string instantly.
- **i18n boundary at the app root.** `App.jsx` is a thin root that owns settings and wraps the tree in
  `I18nProvider`; the former body moved to `AppShell` (so the shell can use `useIntl`). Locale lives in
  `settings.locale` (persisted; `"auto"` resolves from `navigator.languages`).
- **gui-scoped ESLint, not the root config.** The repo-root ESLint config intentionally ignores `targets/web/**`,
  so a separate, minimal `targets/web/eslint.config.js` runs **only** `eslint-plugin-formatjs`
  (`enforce-default-message`) — it does not pull in `js.recommended`, so it won't flood the never-linted
  SPA with unrelated findings. Run via `npm run lint:i18n` (not part of the root headless gate).
- **The DPL-technical lib modules are localized via an `intl` parameter, not React hooks.**
  `targets/web/frontend/lib/dpl/validateDpl.js` (editor lint diagnostics) and `targets/web/frontend/lib/dpl/dplInserts.js` (the DPL
  syntax teaching catalog) are non-React isomorphic modules, so they can't use `useIntl`. Instead they take
  an `intl` argument: `validateDpl(text, intl?)` and `getDplInserts(intl)`. `validateDpl` defaults to a
  module-level **`createIntl` English instance** when no `intl` is passed, so non-React callers and the
  message-asserting test suite get identical English with zero changes. Literal braces in messages (`{list}`,
  `{#name}`, `'{'`) are passed as **arguments** so ICU substitutes them verbatim rather than parsing them.
  Call sites thread their `intl` in: `DplStatus` (via `useIntl`), the `DplEditor` CodeMirror linter (via an
  `intlRef` so the once-built editor reads the live locale), and `DplInsertBar` (memoized
  `getDplInserts(intl)`).

## `dynamic-prompts/` lives under `data/`, not `src/` (2026-06-21)

The `#name` generators were moved from `src/dynamic-prompts/` to `engine/data/dynamic-prompts/`. They are
executable `.js` (they `import` helpers and run logic), so the June reorg first placed them with the
rest of the code under `src/`. But conceptually they are **prompt content** — authored and extended
exactly like `lists/`, `expansions/`, and `presets/` (the project's "drop a file in to add content"
philosophy applies to them too). Keeping all the content the user edits in one place (`data/`) won the
tradeoff over the "all code in `src/`" tidiness rule, so this is the **one deliberate exception** to
that rule.

Mechanically the move only required path edits in the loaders, because the directory name is
config-driven (`settings.dynamicPromptFiles = "dynamic-prompts"`): the legacy
`src/prompt-modules/dynamic-prompt.js` now prefixes the require with `../../data/`; `core/nodeLoader.js`
joins `rootDir/data/dynamic-prompts`; `core/browserLoader.js` globs `../../engine/data/dynamic-prompts/**/*.js`.
The generator files still import shared helpers out of `src/` (`../../engine/helpers/…` for top-level,
`../../../engine/helpers/…` for `v1/`). Verified green with `npm run smoke` (node + legacy loaders) and
`npm --prefix gui run build` (browser glob). Note both loaders must stay in sync — see
[`../../CLAUDE.md`](../../CLAUDE.md) "Critical Things Not to Get Wrong".

## Full ES modules, not a CJS/ESM hybrid (2026-06-18)

The whole codebase is ESM (`"type": "module"`). We did **not** leave the dynamic-prompt plugins or any
loader as `.cjs`. Reason: a single module system is simpler to reason about and the owner asked for full
ESM. The one place that *needs* synchronous module loading (config-driven plugin loading) is handled
with `createRequire` rather than by keeping those files CommonJS — Node 24 can `require()` ESM, so the
plugins can be ESM and still load synchronously.

## `createRequire` for config-driven plugin loading, not `await import()` (2026-06-18)

Dynamic prompts and prompt modules are resolved by a runtime path and invoked synchronously inside
`String.prototype.replaceAll` callbacks. Making that async would force the entire prompt pipeline
(`processBatch` → prompt modules → nested dynamic-prompt expansion) to become async and propagate up
through `run()` and the CLI/server. That's a large, risky rewrite for no user benefit. `createRequire`
keeps the existing synchronous control flow exactly. See
[`../reference/esm-patterns.md`](../reference/esm-patterns.md).

## `chdir.js` as a first-imported side-effect module (2026-06-18)

The app relies on cwd being the project root (dozens of `./output`, `./lists`, `./results.json` paths).
In CommonJS, `process.chdir(__dirname)` at the top of `common.js` ran before the settings `require`. In
ESM, imports evaluate first, so that ordering had to be preserved by putting the chdir in its own module
and importing it before the settings module. This is the smallest change that keeps every relative path
working.

## Keep the CLI-spawns-from-server design (2026-06-18)

The web UI generates images by spawning the CLI (`node . --flags`) and polling a small progress server,
rather than calling `run()` in-process. We kept this as-is during modernization — it isolates a
potentially long/crashy generation run from the UI server and was out of scope for an ESM migration.
(Noted in [`../plans/future.md`](../plans/future.md) as a possible future simplification.)

## `listFiles` default object vs `keywordRepeater` named exports (2026-06-18)

Export shape follows the consumer: `listFiles.js` is indexed dynamically so it stays a default object;
`keywordRepeater.js` is destructured so it's named exports. Don't homogenize them.

## Linter: warn, don't auto-fix, the creative prompt code (2026-06-18)

`no-useless-escape` and `no-dupe-else-if` in the hand-written prompt/data files are kept as **warnings**.
Auto-fixing a regex escape or collapsing a duplicate branch can change the prompts users get, which is a
behavior change we won't make blindly. They're surfaced for deliberate review instead.

## Go web: React + Vite SPA, BYOK providers, stateless Netlify host (2026-06-18)

The project is moving from a localhost-only Node tool to a **React + Vite SPA** usable **online or
locally**, hosted on **Netlify**, storing nothing. The decisions and their reasoning, settled in a
design discussion:

- **React + Vite SPA (not Next.js).** With no database, no accounts, and no server-rendered data, the
  heavy half of a meta-framework would go unused; a lean Vite SPA is the best-aligned "proper but light"
  choice. Well-supported, great testing story.
- **BYOK modular providers.** Users bring their own image-API key; the app never hosts GPUs or pays for
  compute. Each backend is a module behind one interface — the same plugin shape the dynamic prompts
  use. This is what makes "online" viable without a cost/ops burden.
- **No storage, no accounts.** Generated images go straight to the browser; settings live in
  `localStorage`. The server is stateless.
- **Stateless Netlify proxy only where CORS forces it.** Hosted providers usually block browser calls,
  so a thin function forwards the user's key (submit→poll), logging/storing nothing. Local mode calls
  the user's own WebUI directly and skips the proxy.
- **Retire Express.** Not because it's dated (we're on the modern v5) but because the SPA + a couple of
  serverless functions replace a hand-wired backend. The CLI stays, sharing the engine via a Node
  loader.
- **Browser-safe core via an injected loader.** The prompt engine is refactored to take its data
  (lists, expansions, dynamic prompts) through a loader interface, so it runs unchanged in Node (fs +
  createRequire) and in the browser (Vite `import.meta.glob`). The dynamic prompts being ESM default
  exports already is what makes the browser bundling clean.
- **Netlify default, Cloudflare Pages as the scale option.** Chosen for a commercial-OK free tier and no
  overage surprises; near-zero lock-in since nothing is stored.

Full plan + phases: [`../plans/web-migration.md`](../plans/web-migration.md).

## One JSDoc doc-site, not Doxygen (2026-06-18)

The documentation went through two tools before settling. Doxygen was set up first (file-level `@file`
headers + the notes as pages), but it **cannot extract this code's symbols** — the dynamic-prompt
generators are anonymous `export default function`, and Doxygen's ESM support is weak — so it could only
ever give a File List plus the notes, never a real per-function API. **JSDoc parses ESM and
`export default` natively**, so it was adopted and Doxygen **retired entirely**. One generator now does
everything: `npm run docs` → `scripts/build-docs.mjs` → a single **JSDoc + docdash** site. The owner's
constraint shaped this: **JSDoc comments, not TypeScript** ("I don't like TypeScript unless it's really
needed") — pure-JavaScript `/** … */` comments give the per-function API without a type system or a build
step in the way. See [`../reference/documentation.md`](../reference/documentation.md).

## Unify code API + notes in the same site (notes as JSDoc tutorials) (2026-06-18)

Rather than keep the conceptual notes and the code API as two separate things, the whole `notes/` tree is
wired into the JSDoc site as **tutorials**: `build-docs.mjs` walks `notes/**`, builds a `tutorials.json`
hierarchy that mirrors the folder tree (the role Doxygen's `_nav.dox` played), and rewrites inter-note
links so they resolve to the generated tutorial pages. One site carries the README home, the per-function
code API, and the living notes with a shared sidebar + search. This is deliberate: the depth the code
comments can't carry (the prompt DSL, the dynamic-prompt catalog, the system map) lives **beside** the API,
not in a separate doc system. Auto-discovery means adding/renaming a note needs no nav-file maintenance.

## Keep JSDoc for the React SPA too — transpile JSX, don't switch tools (2026-06-18)

The `targets/web/` React SPA raised the question of whether to adopt a React-specific doc tool (better-docs,
react-docgen, Storybook). Decision: **stay on the one JSDoc site** for now. JSDoc can't parse JSX, so
`build-docs.mjs` **babel-transpiles** `targets/web/src` (+ the Netlify function) into a `tmp/webapp-docs`
mirror (JSX stripped, comments kept) that JSDoc reads, with `@module` tags giving clean nav names. This
keeps one source of truth for all documentation while the SPA is still young and its components are simple.
The trigger to revisit: **if the SPA grows a real component library** with props/variants worth a visual
catalog, add **Storybook** (interactive component docs) and/or **better-docs** `@component` support
*alongside* JSDoc — not as a replacement for the unified site. Recorded so the judgment isn't re-litigated
from scratch.

## Online build prerenders via `renderToString` (SSG); local stays client-only (2026-07-01)

The online build's mobile Lighthouse LCP was ~5.6 s and, when profiled, was **92% render-delay** — the
intrinsic cost of client-rendering the palette with React + react-intl on throttled mobile (the local
app loads in ~220 ms; Lighthouse scales that ~26×). No bundling change moved it. The fix is to ship real
HTML, so the online build **prerenders its first paint to static HTML at build time and hydrates it**.
Decisions and why:

- **Prerender with `renderToString` (Node SSR), not a headless-browser snapshot.** Effects don't run in
  `renderToString`, so the CodeMirror composer renders as its empty host `<div>` — identical to the
  client's first render — giving clean hydration. A headless snapshot would capture CodeMirror's
  imperative DOM and mismatch on hydrate. (Confirmed CodeMirror + react-intl import cleanly in Node and
  the theme code already guards browser globals, so `renderToString` needed no SSR shims.)
- **Online-only.** The local build runs on localhost (instant) and isn't indexed — it gains nothing from
  prerendering and carries the risk, so it stays byte-for-byte client-only (`#root` ships empty →
  `createRoot`). Gated in `App.jsx` (the boot renders defaults only when `ONLINE`) and `main.jsx`
  (hydrate only when `#root` is populated).
- **Default-settings shell + two-pass hydration**, rather than trying to prerender per-visitor state
  (impossible — the build has no localStorage) or synchronously hydrating on the client (would mismatch
  the defaults-only prerender for returning visitors). The server and the client's first render both
  produce defaults → clean hydration; stored settings settle in after via `cache.onHydrated` + guarded
  stores. **Rejected: persisting on mount** — the pre-existing `useSettings` save-on-mount would wipe a
  returning visitor's settings once the boot no longer waited for hydration; the save is now gated on a
  "stored values applied" flag.
- **SSR-safety is an enforced invariant, not a hope.** `tests/prerender.test.js` renders the app in a
  `node` environment (no DOM), so any browser API used during the initial render fails in CI. This is
  what keeps the approach non-fragile over time (the owner's explicit requirement).

Rejected alternatives: **Next.js / re-platforming** (overkill for a static, server-less BYOK app; the
existing Vite stack does build-time SSG fine) and **`createRoot` over prerendered HTML** (React would
clear + re-render, risking an LCP-resetting flash — `hydrateRoot` reuses the DOM instead).
