# Deployment / Releases (Netlify + GitHub Actions)

How the project ships. There are three independent pipelines, each with one home:

| Pipeline | Where | What it does |
|----------|-------|--------------|
| **CI** (test on every push) | `.github/workflows/ci.yml` | Lint + format check + smoke + Node/jsdom Vitest suites; builds the React SPA; Playwright E2E + a11y + visual-regression. |
| **Docs site** | `.github/workflows/pages.yml` | Builds the JSDoc doc-site (code API + the notes) and deploys it to **GitHub Pages** on every push to `main`. |
| **Software release** | `.github/workflows/release.yml` | Version-gated GitHub Release: source tarball + docs zip. |
| **Visual baselines** | `.github/workflows/visual-baselines.yml` | Manual (`workflow_dispatch`): regenerates the Linux Playwright visual baselines on the e2e runner and uploads them as an artifact to download + commit. |
| **Web app deploy** | `.github/workflows/netlify-deploy.yml` + `netlify.toml` | Builds + hosts the `gui/` SPA on **Netlify** (`prompt.fairyfox.io`); auto-deploys on push to `main` (gated on the `NETLIFY_AUTH_TOKEN` secret). |

## Local edition — the release stage (`gui/server/serve.js`)

**Editions vs. stages.** One code pool builds into two editions — the full **local** build and the
**online** build (same code, local-only features gated off via `VITE_ONLINE`). Each edition has dev
and release stages. The **online** edition's release is the static Netlify build above (no backend —
BYOK calls go straight from the browser). The **local** edition needs a real release stage too, and
this is it.

- **Dev stage:** `npm run web` → the Vite dev server, with the `/api/*` backend attached as a plugin
  middleware (`gui/vite-plugin-api.js`). For development only — **not** what end users run.
- **Release stage:** `npm start` → `npm run web:build` (a real `vite build`) then `node
  gui/server/serve.js` — a dependency-free standalone Node server that serves the built `dist/` as
  static files (SPA fallback) **and** mounts the same `/api/*` backend. `npm run serve` serves an
  already-built `dist/`. Port = `PORT` (default 4173); `NO_OPEN=1` skips opening the browser.
- **One backend, two transports.** The handler lives once in `gui/server/apiHandler.js` and is mounted
  by both the dev plugin and the release server, so the local backend can't drift between stages. This
  fixed the earlier defect where the dev server was the *only* thing with a working backend, so it was
  being used as the de-facto release — unprofessional and wrong. (Extracting the handler also fixed a
  latent bug: the convert/resize/reveal/open routes used `exec`/`execP` that were never imported.)
- **File-watch hot reload** rides the same backend: `/api/manage/watch` is an SSE stream tagging each
  change with a scope — `data` (lists/dynamic-prompts → live catalog refresh), `output` (the gallery
  feed), `settings` (re-read user settings, ignoring the app's own writes and guarded by atomic
  storage writes so it never clobbers `user-settings`). The app opens one stream in `App.jsx`.

## CI — `.github/workflows/ci.yml`

Runs on push to `dev`/`main`, on PRs, and on demand. Node 24. Three jobs: (1) **check** — `npm ci`,
then `npm run lint`, `npm run format:check`, `npm run smoke` (the [import smoke test](../plans/testing.md)),
and `npm run test:unit` (the Node Vitest suite); (2) **gui** — `npm --prefix gui ci`, then
`npm --prefix gui run build` (the SPA is proven to build) and `npm --prefix gui run test` (the jsdom
Vitest suite); (3) **e2e** — installs root + gui deps and the bundled Playwright chromium, then
`npm run test:e2e` (E2E + accessibility + **visual-regression**). Visual works cross-OS because baselines
are committed per platform — `*-chromium-win32.png` (local, system Chrome) and `*-chromium-linux.png` (CI,
bundled chromium); `playwright.config.js` picks the browser by `process.platform` and only skips visual when
`PLAYWRIGHT_SKIP_VISUAL` is set (an escape hatch for a platform without baselines). Regenerate the Linux set
with the **Update visual baselines (Linux)** workflow (see below) — never hand-edit the PNGs. Green here
means the same thing as green locally — it's the CI mirror of `npm test` + the build + the browser specs.

## Visual baselines — `.github/workflows/visual-baselines.yml`

Manual `workflow_dispatch`. Runs on **ubuntu-latest with the same setup as the e2e job** — the run steps use
`defaults.run.working-directory: engine-v3` and `npm install` + gui `npm install` (NOT `npm ci`, same
Windows-lock/@emnapi reason as `ci.yml`; this was fixed for the engine-v3 split — the old root-level `npm ci`
broke once there was no root `package.json`), `npx playwright install --with-deps chromium`, then `playwright
test visual.spec.js --update-snapshots`. It uploads the snapshots as the `linux-visual-baselines` artifact —
the `upload-artifact` path is **repo-root-relative** (`engine-v3/tests/e2e/visual.spec.js-snapshots/`), since
`actions/*` steps ignore `working-directory`. Because it renders in the exact environment the e2e job checks
against, the baselines match CI.
Workflow: trigger it (`gh workflow run visual-baselines.yml`), download the artifact, copy the
`*-chromium-linux.png` files into `tests/e2e/visual.spec.js-snapshots/`, and commit. Do this whenever the
SPA's stable chrome changes (the Windows `*-win32.png` set is refreshed locally with
`npm run test:e2e:update`).

## Docs site — `.github/workflows/pages.yml`

On every push to `main` (re-enabled 2026-06-29), installs deps then runs `npm run docs`
(`scripts/build-docs.mjs` → **JSDoc** with the **docdash** template) and deploys `docs/jsdoc` to
GitHub Pages. `README.md` is the home (jsdoc `opts.readme`), so the site is the README + the **code
API** (per-function JSDoc) + the **full living notes** wired in as tutorial pages (hierarchy mirrors
the `notes/` tree). See [`documentation.md`](documentation.md).

**The engine-v3 split straddle (fixed 2026-06-29):** `build-docs.mjs` keeps two roots — `root`
(engine-v3: code `src/`+`data/`, the transpiled-JSX `tmp/`, the docdash binary) and `repoRoot`
(engine-v3's parent: `notes/`, `assets/`, `README.md`, `list-credits.md`, **and `jsdoc.config.json`**).
JSDoc runs from `repoRoot` via the engine-v3-pinned binary (`node engine-v3/node_modules/jsdoc/jsdoc.js`,
**not** `npx jsdoc`, which would fetch a different version); `jsdoc.config.json` `source.include`
reaches into `engine-v3/src` etc., and the site is written to the repo-root `docs/jsdoc` (so
`pages.yml` uploads `docs/jsdoc`, not `engine-v3/docs/jsdoc`). JSDoc exits non-zero on **recoverable**
TS-style type-expression warnings (`import("react").Ref`, `() => string`, `Error & {…}`, deep
generics) yet still writes the full site; the build **tolerates** that when `index.html` landed
(only a missing index is fatal). The remaining cleanup is tightening those JSDoc types so JSDoc is
silent — cosmetic, deferred.

**One-time repo setup (already done):** Settings → Pages → Source = **GitHub Actions** (`pages` API
`build_type: "workflow"`). The workflow needs `pages: write` + `id-token: write` and the
`github-pages` environment (declared in the workflow).

## Software release — `.github/workflows/release.yml`

### The version gate

Trigger: **push to `main`** (every commit on `main` is a tagged release reached by `--no-ff` merge from
green `dev` or a `release/`/`hotfix/` branch, so always all-green). Gate: the tag **`v<VERSION>` must not
already exist** — i.e. `VERSION` was bumped since the last release. So:

- Bump `VERSION` (+ `package.json`, same commit; see [`versioning.md`](versioning.md)) → the next time
  `main` advances, that commit cuts the release and creates tag `vX.Y.Z`.
- A `main` push that did **not** bump `VERSION` → the tag already exists → no-op (no duplicate
  release). This is exactly why tags key off `VERSION`.
- A `VERSION` carrying `-alpha`/`-beta`/`-rc` marks the GitHub Release as a **prerelease**.

### What it publishes

- **`random-ai-prompt-<v>.tar.gz`** — a clean source tarball via `git archive` (tracked files only;
  no `node_modules`, `output/`, or build junk). Run it with Node 24: `npm install` then `npm start` /
  `npm run server`.
- **`random-ai-prompt-<v>-docs.zip`** — the generated JSDoc doc-site (archival snapshot; the live site
  is on Pages).

The release body is composed automatically: a plain-English "what it is", a prerelease note, **"What's
new in this release"** pulled from the lines added to `notes/version/` since the previous tag
(`git diff <prev>..HEAD`), and a downloads list — then `softprops/action-gh-release` appends the auto
"What's Changed" commit list.

### Dry run

`workflow_dispatch` with `dry_run = true` (the default for manual runs) builds + uploads everything as
**workflow artifacts** but does **not** create the Release — use it to shake out the build without
publishing: `gh workflow run release.yml -f dry_run=true`, then `gh run watch`.

## Web app deploy — `netlify.toml`

The `gui/` SPA is built and hosted on Netlify, independent of the GitHub release:

```
command = npm --prefix gui install && npm --prefix gui run build
publish = gui/dist
```

The deployed site is fully static — **no `functions` and no `/api/*` redirect** (both were removed once
the serverless proxy was retired, 2.30.1). Every path falls back to `index.html` for client-side
routing, except real files in the publish dir (`/legal/*.html`, `/fonts/*`), which are served directly
and take precedence over the SPA fallback.

**`VITE_ONLINE=true` is set in `netlify.toml` itself** (`[build.environment]`), so a Netlify build is
the **online variant** with no extra dashboard config. (Vite inlines `import.meta.env.VITE_ONLINE` at
build time, so the flag must be present for the build command, not at runtime.)

**The online build is a fully static, backend-free site (2.11.0).** Image generation and the AI
rewrite run **browser-direct**: the SPA calls the provider's API straight from the visitor's browser
with their own BYOK key (the key never touches our infra), so the deployed site uses **no serverless
functions at all**. This sidesteps the Netlify free-tier function limits entirely — the invocation cap
and the 10-second function timeout — which made the old proxy model unusable for heavy/bulk runs. It
only works for providers whose APIs send CORS headers; a live preflight check (2026-06-27) found:

- **Browser-direct (online-capable):** OpenAI, Google Gemini, xAI Grok, Stability AI, Leonardo AI,
  fal.ai — `transport: "browser-direct"`. Covers image gen *and* rewrite (OpenAI/Gemini/Grok chat).
- **Not CORS-capable (need the desktop app):** Replicate, Black Forest Labs (FLUX), Ideogram — kept on
  `transport: "hosted-proxy"`. They work locally (via the Vite dev proxy) but are **locked online**.

In the online build the disabled-with-tooltip set is therefore: Gallery / Single tabs, the local SD
providers (ComfyUI/Forge/SDNext/local-webui), the three non-CORS hosted providers above, and the NSFW
toggle — all greyed with a click-through to the full desktop version (`gui/src/lib/online.js`).

The standalone Netlify function files (`gui/netlify/functions/generate.js` + `rewrite.js`) were
**removed (2.30.1)** — they were only ever invoked by Netlify's runtime, and the online site no longer
uses them. `server/dispatch.js` and the Vite dev middleware (`gui/vite-plugin-api.js`, serving
`/api/generate` + `/api/rewrite`) **remain** as the **local** dev proxy that the desktop full version
uses for the non-CORS providers.

### Online demo deploy — `prompt.fairyfox.io`

The app is hosted off the main `fairyfox.io` domain (which is mostly docs) on the `prompt` subdomain.

**`netlify.toml` paths are repo-root-relative with an explicit `engine-v3/` prefix** (no `base`). The
active project moved under `engine-v3/` in the split, but the toml still pointed at a root-level `gui/`;
since the toml lives at the repo root the CLI/@netlify/build resolves `publish`/`functions` from the
root (not from `base`), so spelling the paths out as `engine-v3/gui/...` and using
`npm --prefix engine-v3/gui ...` is the unambiguous fix (corrected 2026-06-27, first real deploy).

**Set up (done 2026-06-27):** the site **`prompt-fairyfox`** (→ `prompt-fairyfox.netlify.app`,
team `junebug12851`) was created and deployed via the Netlify CLI:

```sh
netlify link --id <site-id>          # link the repo folder to the site
netlify deploy --prod --build        # runs netlify.toml build (VITE_ONLINE=true) → dist + functions
```

The custom domain was attached with `netlify api updateSite` (`custom_domain = prompt.fairyfox.io`).

**The one remaining manual step — DNS (owner, at the `fairyfox.io` DNS host):** add a **CNAME**
record `prompt` → `prompt-fairyfox.netlify.app`. `fairyfox.io` is **not** on Netlify DNS (the docs
apex lives elsewhere), so this record can't be created from the API. Once it resolves, Netlify
auto-provisions a Let's Encrypt cert for `prompt.fairyfox.io`; enable *Force HTTPS* in the domain
panel. This only adds the `prompt` subdomain — the apex/docs records are untouched.

**Continuous deploy (set up 2026-06-29 — `.github/workflows/netlify-deploy.yml`):** the site is **not
git-connected** (manual-CLI history), so a dedicated workflow IS the continuous deploy. On every push
to `main` it runs `netlify deploy --build --prod --site <id>` (the site id `927e1b3b-…` is public, in
the workflow `env`). It's a **gated no-op until the owner adds the `NETLIFY_AUTH_TOKEN` repo secret**
(Settings → Secrets and variables → Actions → New repository secret; generate the token at Netlify →
User settings → Applications → Personal access tokens). Once the secret is present, pushes to `main`
auto-publish to `prompt.fairyfox.io`. A manual deploy is still available any time:
`netlify deploy --prod --build` from the repo root (the CLI is linked via `.netlify/state.json`).
Alternatively the repo can be git-connected in the Netlify UI instead of using the token workflow.

## Policy (standing rules)

- **GitHub Releases are SOFTWARE releases only** — never a docs-only or images-only release. The
  versioned `release.yml` release is the only kind.
- **Every Release gets a clear, user-facing description by default** — `release.yml` composes it from
  the living changelog; keep that quality bar if you edit the step.
- **The docs site lives on GitHub Pages, not in git or a release** (no repo-size growth). The release
  attaches its own docs zip as an archival snapshot.

## Not done yet (intentional)

- **Netlify online deploy is LIVE (2026-06-27)** — site `prompt-fairyfox` serves the online build at
  `prompt.fairyfox.io`. **Continuous deploy on push to `main` is now wired** (`netlify-deploy.yml`),
  pending the owner adding the `NETLIFY_AUTH_TOKEN` secret (see *Continuous deploy* above). The `prompt`
  CNAME at the `fairyfox.io` DNS host is already resolving (cert approved).
- **Docs + release pipelines are LIVE.** `main` advancing triggers the Pages docs deploy (`pages.yml`,
  re-enabled 2026-06-29 after the engine-v3 doc-build straddle fix) and the version-gated software
  Release (`release.yml`). GitHub Pages source is **GitHub Actions** (already configured); the docs
  serve under `fairyfox.io/random-ai-prompt/`.
- The serverless hosted-proxy path was **retired** (its `gui/netlify/functions/` files removed, 2.30.1);
  the online build is browser-direct only, and non-CORS providers are locked online (use the desktop
  app). `server/dispatch.js` + the Vite dev middleware remain for the local dev proxy.
- No code signing / packaged installers (it's a Node app shipped as source). Revisit if a packaged
  binary is ever wanted.
