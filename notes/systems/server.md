# The web UI — `server.js`, `web/`

The local web UI: an **Express 5 + Pug** app on `serverSettings.port` (7861, npm: `npm run server` /
`webui.bat`). It serves the pages + a JSON API + the `output/` images, and **spawns the CLI** for any
actual generation — it does not generate in-process.

## `server.js`

- Express 5 app (note: Express 5 route patterns — no bare `*` path strings; see
  [`../reference/dependencies.md`](../reference/dependencies.md) /
  [`../reference/fix-patterns.md`](../reference/fix-patterns.md) if a route throws at boot).
- Renders Pug views from `web/views/` (layouts + fragments + per-page templates).
- JSON API: settings (`/api/setting`, `/api/merge-settings`, `/api/replace-settings`,
  `/api/reload-settings`), generation (spawns `index.js`), progress (HTTP-polls the CLI's progress
  server on 7862 and merges with its own `execAppOngoing` flag), and the image feed/search.
- Serves `output/` (generated PNGs + `.json` sidecars).

## `web/frontend/` — the browser client

Classic jQuery-era scripts + CSS (one pair per page: `generate`, `feed`, `results`, `single`,
`settings`, `progress`, `re-index`), plus vendored `lib/` (jQuery, lodash). This talks to the JSON API.
It is the **legacy** client; the modern front end is the React SPA ([web-app.md](web-app.md)), and the
web migration plan ([`../plans/web-migration.md`](../plans/web-migration.md)) tracks retiring Express +
this client in favor of the isomorphic engine + SPA.

## `web/backend/indexImages.js` — the image index

Builds an **in-memory index** from every `output/*.json`: a keyword→files map (tokenized via
`compromise`/lodash), per-image data, deep links (upscales / variations / rerolls / animation frames),
and stats. The web API queries this index.

It **self-heals**: invalid deep links and orphaned upscales are pruned, the affected `.json` files are
**minimally rewritten** (byte-respectful — only what changed), and it re-indexes up to 5×. This matters
because the index is the source of truth for the feed/search UI.

## Verification

Like the CLI, the server is verified by lint + `node --check` + Express-5-safe route patterns + the
import smoke test; it is not launched live in CI (launching opens a browser). See
[`../plans/testing.md`](../plans/testing.md).
