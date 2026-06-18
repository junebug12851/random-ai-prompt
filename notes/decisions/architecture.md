# Architecture Decisions

Key structural choices and why. (Things tried and rejected live in [`rejected.md`](rejected.md).)

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
