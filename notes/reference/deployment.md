# Deployment / Releases (Netlify + GitHub Actions)

How the project ships. There are three independent pipelines, each with one home:

| Pipeline | Where | What it does |
|----------|-------|--------------|
| **CI** (test on every push) | `.github/workflows/ci.yml` | Lint + format check + smoke + Node/jsdom Vitest suites; builds the React SPA; Playwright E2E + a11y + visual-regression. |
| **Docs site** | `.github/workflows/pages.yml` | Builds the JSDoc doc-site (code API + the notes) and deploys it to **GitHub Pages** on every push to `main`. |
| **Software release** | `.github/workflows/release.yml` | Version-gated GitHub Release: source tarball + docs zip. |
| **Visual baselines** | `.github/workflows/visual-baselines.yml` | Manual (`workflow_dispatch`): regenerates the Linux Playwright visual baselines on the e2e runner and uploads them as an artifact to download + commit. |
| **Web app deploy** | `netlify.toml` | Builds + hosts the `gui/` SPA on **Netlify** (separate from the GitHub release). |

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

On every push to `main`, runs `npm ci` then `npm run docs` (`scripts/build-docs.mjs` → **JSDoc** with
the **docdash** template) and deploys `docs/jsdoc` to GitHub Pages. `README.md` is the home
(jsdoc `opts.readme`), so the site is the README + the **code API** (per-function JSDoc) + the **full
living notes** wired in as tutorial pages (hierarchy mirrors the `notes/` tree). See
[`documentation.md`](documentation.md).

**One-time repo setup:** Settings → Pages → Build and deployment → Source = **GitHub Actions**. The
workflow needs `pages: write` + `id-token: write` and the `github-pages` environment (already declared
in the workflow).

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
command   = npm --prefix gui install && npm --prefix gui run build
publish   = gui/dist
functions = gui/netlify/functions
```

`/api/*` routes to the serverless functions (the stateless BYOK generation proxy — see
[`../systems/gui.md`](../systems/gui.md)); every other path falls back to `index.html` for
client-side routing.

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

The Netlify functions (`gui/netlify/functions/`) and `server/dispatch.js` remain in the repo for the
**local** dev proxy (which the desktop full version uses for the non-CORS providers); the deployed
online site simply never calls them.

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

**Continuous deploy (optional, not set up):** the current site is a **manual CLI deploy** — it does
**not** rebuild on `git push`. To make pushes to `main` auto-deploy, either connect the repo in the
Netlify UI (*Site configuration → Build & deploy → Link repository*, which installs the Netlify GitHub
App), or add a deploy step to `ci.yml` using a `NETLIFY_AUTH_TOKEN` secret + the site id. Until then,
re-deploy a new release with `netlify deploy --prod --build` from the repo root.

## Policy (standing rules)

- **GitHub Releases are SOFTWARE releases only** — never a docs-only or images-only release. The
  versioned `release.yml` release is the only kind.
- **Every Release gets a clear, user-facing description by default** — `release.yml` composes it from
  the living changelog; keep that quality bar if you edit the step.
- **The docs site lives on GitHub Pages, not in git or a release** (no repo-size growth). The release
  attaches its own docs zip as an archival snapshot.

## Not done yet (intentional)

- **Netlify online deploy is LIVE (2026-06-27)** — site `prompt-fairyfox` is deployed and serving the
  online build at `prompt-fairyfox.netlify.app`, custom domain `prompt.fairyfox.io` attached. The only
  thing left is the owner adding the `prompt` CNAME at the `fairyfox.io` DNS host (see *Online demo
  deploy* above). It's a manual CLI deploy, not git-connected — see the continuous-deploy note.
- **Docs/release pipelines still deliberately dormant.** `main` advancing is the single trigger for the
  Pages docs deploy and the software Release; **GitHub Pages is not enabled** yet (Settings → Pages →
  Source still unset), so nothing ships there until the owner says go. Planned homes: **GitHub Pages for
  the docs** (like the sibling project), **Netlify for the app** (functions).
- The hosted BYOK provider dispatch in `gui/netlify/functions/generate.js` is a stub (migration
  phase 2). Local generation works today; the hosted path is wired but not yet pointed at a provider.
- No code signing / packaged installers (it's a Node app shipped as source). Revisit if a packaged
  binary is ever wanted.
