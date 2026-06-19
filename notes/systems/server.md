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

## Image lifecycle & the metadata deep-link graph

Every generated image is a PNG plus a sibling `.json` **metadata sidecar** (`helpers/saveImage.js`),
epoch-named (`<epoch>.png` / `<epoch>-upscaled.png`). The sidecar carries the WebUI generation params
(seed, sampler, cfg, size, …) **plus relationship + provenance fields** that turn a flat folder into a
graph:

| Sidecar field | Meaning |
|---------------|---------|
| `variationOf` / `rerollOf` / `upscaleOf` | this image is a variation / reroll / upscale of that file id |
| `animationFrameOf` + `animatonFrameNumber` | this image is a frame of that animation (number from the salt) |
| `animationOf` / `isAnimation` | the stitched APNG and its parent image link |
| `origPrompt` / `origPostPrompt` / `origRandomPrompt` | the prompt before list-expansion / before any expansion / the random seed prompt — used by **reroll** |
| `cmd` | the exact `node . …` command that produced it (shown + copyable in the UI) |

`indexImages.js` reads those fields and builds the inverse **deep-link** map (`upscales`, `variations`,
`rerolls`, `animationFrames`, `animations`) hanging off each parent, plus a keyword→files index and
stats. Upscales are *not* indexed as their own entries — they attach to the original; an orphaned upscale
(parent deleted) is "promoted" by renaming `-upscaled` off and stripping `upscaleOf`. The **single**
page (`web/frontend/single.js`) renders this graph: the metadata table, the prompt-selection dropdown
(prompt / negative / original / post / random / cmd / info-md / info-txt), the popularity-sized keyword
cloud, the related-image galleries, and the action menu.

The five generation **run modes** all flow CLI-side and write sidecars the index then links:

- **variation** (`loadVariationData.js`) — reuse a saved image's seed/size and vary via subseed.
- **reroll** (`loadRerollData.js`) — re-generate a chosen prompt field (prompt/orig/post/random) fresh.
- **upscale** (`upscaleExisting.js` → `helpers/imageUpscaler.js`) — `extra-single-image` API.
- **to-animation** (`toAnimation.js`) and **extend-animation** (`extendAnimation.js`) — salt-marched
  frames stitched into an APNG (`helpers/makeApng.js`), extendable, and **externalizable** (the server
  copies numbered frames + an `info.txt` to a folder for AI-interpolation tools like FlowFrames / DAIN).

ImageMagick (optional, detected via `magick -version`) converts animations to gif/webp/mp4/mng and
single images to gif/webp/jpg on demand (`/api/magick-*`).

## Verification

Like the CLI, the server is verified by lint + `node --check` + Express-5-safe route patterns + the
import smoke test; it is not launched live in CI (launching opens a browser). See
[`../plans/testing.md`](../plans/testing.md).
