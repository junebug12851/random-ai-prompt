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
the **online variant** with no extra dashboard config. In that build the local-only features —
Gallery / Single tabs, the local SD providers (ComfyUI/Forge/SDNext/local-webui), and the NSFW toggle
— are **not hidden but shown disabled**: greyed, with a hover tooltip and a click-through to the full
desktop version on GitHub (`gui/src/lib/online.js`). Generate still works via BYOK keys through the
serverless proxy. (Vite inlines `import.meta.env.VITE_ONLINE` at build time, so the flag must be
present for the build command, not at runtime.)

### Online demo deploy — `prompt.fairyfox.io`

The app is hosted off the main `fairyfox.io` domain (which is mostly docs) on the `prompt` subdomain.
One-time setup on Netlify:

1. **Create the site** — Netlify → *Add new site → Import an existing project* → pick the
   `junebug12851/random-ai-prompt` GitHub repo. Netlify reads `netlify.toml` for the build command,
   publish dir, and functions; no manual build settings needed. Set the **production branch** to
   `main` (the deploy gate is the same as the release gate — only shipped code goes live). Deploy.
2. **Confirm it's the online build** — the first deploy should show the Gallery/Single tabs, local
   providers, and NSFW switch greyed with the lock badge. If they're fully interactive, `VITE_ONLINE`
   didn't reach the build — check `[build.environment]` in `netlify.toml`.
3. **Add the custom domain** — site → *Domain management → Add a domain* → `prompt.fairyfox.io` →
   *Add domain* (Netlify will say it's an external domain; that's expected).
4. **Point DNS at Netlify** — at the `fairyfox.io` DNS host (where the apex/`www` records for the
   docs site live), add a **CNAME**: `prompt` → `<your-site>.netlify.app` (the value Netlify shows in
   the domain panel). The docs site on the apex is untouched — this only adds the `prompt` subdomain.
5. **HTTPS** — once DNS resolves (minutes to a couple hours), Netlify auto-provisions a Let's Encrypt
   certificate for `prompt.fairyfox.io`. Enable *Force HTTPS* in the domain panel.

Note: this is a normal subdomain CNAME, independent of GitHub Pages. If the docs site ever moves to a
subdomain too, that's a separate record — they don't conflict.

## Policy (standing rules)

- **GitHub Releases are SOFTWARE releases only** — never a docs-only or images-only release. The
  versioned `release.yml` release is the only kind.
- **Every Release gets a clear, user-facing description by default** — `release.yml` composes it from
  the living changelog; keep that quality bar if you edit the step.
- **The docs site lives on GitHub Pages, not in git or a release** (no repo-size growth). The release
  attaches its own docs zip as an archival snapshot.

## Not done yet (intentional)

- **Netlify online deploy is being stood up (2026-06-27)** at **`prompt.fairyfox.io`** — the build is
  now online-ready (`VITE_ONLINE=true` baked into `netlify.toml`, local-only features shown disabled).
  The remaining steps are dashboard/DNS actions on the owner's side (see *Online demo deploy* above):
  connect the repo, set the production branch to `main`, add the `prompt` subdomain + CNAME.
- **Docs/release pipelines still deliberately dormant.** `main` advancing is the single trigger for the
  Pages docs deploy and the software Release; **GitHub Pages is not enabled** yet (Settings → Pages →
  Source still unset), so nothing ships there until the owner says go. Planned homes: **GitHub Pages for
  the docs** (like the sibling project), **Netlify for the app** (functions).
- The hosted BYOK provider dispatch in `gui/netlify/functions/generate.js` is a stub (migration
  phase 2). Local generation works today; the hosted path is wired but not yet pointed at a provider.
- No code signing / packaged installers (it's a Node app shipped as source). Revisit if a packaged
  binary is ever wanted.
