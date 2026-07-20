# Coins — the shared reading-engagement counter

**Coins** are a light, shared engagement layer across the Fairy Fox mesh: reading a page you haven't
opened **today** — anywhere same-origin under `fairyfox.io` — earns a coin. The counter lives in the
shared chrome as a small button beside the reader "Aa" button, and the balance is shared, via one
origin-wide key, across every same-origin fairyfox.io site in the same browser. Coins make reading and
exploring the mesh **quietly rewarding** — a garnish, never the meal.

Canonical, project-agnostic source: `assets/references/fairyfox.io/hub/standards/coins.md`. It ships as
part of the shared docs-site **chrome** ([`documentation.md`](documentation.md)) and its earning engine
is the master `coins.js`, loaded after `reader.js`.

## The prime directive: subtle, never central

- **Never gate.** Coins must not unlock, restrict, or grant exclusive access to anything. The full
  experience is always available at zero coins.
- **Extra reward, not the reward.** A touch of delight on top of something already satisfying.
- **Restraint by default.** If unsure whether a spot warrants a coin, it doesn't. Sprinkle, don't shower.
- **Never at the brand's expense.** A coin flourish must not clutter the UI or degrade the chrome.

## Earning model (fixed — do NOT reimplement)

Earning is owned by the shared `coins.js`; a project **does not** re-implement or alter it. First view
of a page today: +1 (10% chance of +2); repeat view: 1% chance of +1, capped at 10/day; reading pages
(`data-read`/`data-story`) also show a read-time estimate and add a read-through bonus + a rare hidden
coin. State lives under the versioned origin-wide key **`fairyfox:coins:a`** — browser-only, never sent
to a server. The project may read/adjust the balance sparingly via `window.FairyFoxCoins`
(`get`/`earnedTotal`/`earnedToday`/`onChange`/`spend`/`reward`); a `fairyfox:coins` DOM event fires on
every change. Anti-patterns: daily log-in grinds, coins-to-continue, paywall-shaped "spend to unlock",
nagging, inflated grants.

## How this project ships it

The coins counter lives on the **docs site** (the JSDoc site themed to fairyfox.io), which is served
**same-origin under `fairyfox.io/<key>/`** — so it shares the hub's `fairyfox:coins:a` wallet and the
hub's `/legal/coins/` disclosure page (the coins panel links there). Concretely:

- **`assets/docs-theme/modules/coins.js`** — the master `coins.js` **vendored verbatim** (byte-identical
  to `assets/references/fairyfox.io/assets/js/coins.js`; do not edit — refresh by re-copying the master).
- **`assets/docs-theme/fairyfox-docs.js`** injects it as a plain `<script>` **after** `injectHeader()` +
  `initReader()`, so its button lands just left of the `.ff-reader-btn` "Aa" button. It's a classic IIFE
  exposing `window.FairyFoxCoins`, so it's script-injected, not ES-imported.
- **`assets/docs-theme/theme/coins.css`** — the coin button / panel / "+1" pop / read-time chip /
  hidden-coin styles, on the project's own tokens (same token names as the master); `@import`ed by
  `fairyfox-docs.css` after `reader.css` (the panel reuses the reader panel's `.ff-rp-*` chrome).
- `scripts/build-docs.mjs` copies the whole `modules/` and `theme/` dirs, so both files install into
  `docs/jsdoc/` automatically — no build-script change needed.

Because the docs are same-origin with the hub, **no project-side legal page changes are needed** (the
hub origin's `/legal/coins/` covers the `fairyfox:coins:a` disclosure). The RAP **web app**
(`targets/web`, a different origin on Netlify) does **not** carry coins, so its legal pages are
unaffected. If coins are ever added to the web app, disclose `fairyfox:coins:a` in
`targets/web/public/legal/{privacy,cookies}.html` per the "Keep the Legal Docs Accurate" instruction.

## Verify (is it being followed?)

- The coin counter comes from the **shared chrome** (`coins.js` vendored from master, byte-identical),
  not a re-implementation, and is loaded **after** `reader.js`.
- **Persistence** — the store is read-and-merged (never replaced) on load; nothing clears the wallet
  except the user (`spend`, the panel's **Clear my data**, or a browser reset). `coins.js` owns this.
- The project **gates nothing** on coins — the docs read fully at zero balance.
- Coin UI is **subtle** (a small button beside "Aa"; a "+1" pop) and doesn't clutter the docs.
- The `fairyfox:coins:a` store is **disclosed** — via the same-origin hub `/legal/coins/` page the panel
  links to (the docs site shares the hub origin).
