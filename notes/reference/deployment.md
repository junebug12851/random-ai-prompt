# Deployment / Releases (Netlify + GitHub Actions)

How the project ships. There are three independent pipelines, each with one home:

| Pipeline | Where | What it does |
|----------|-------|--------------|
| **CI** (test on every push) | `.github/workflows/ci.yml` | Lint + format check + smoke + Node/jsdom Vitest suites; builds the React SPA; Playwright E2E + a11y + visual-regression. |
| **Docs site** | `.github/workflows/pages.yml` | Builds the JSDoc doc-site (code API + the notes) and deploys it to **GitHub Pages** on every push to `master`. |
| **Software release** | `.github/workflows/release.yml` | Version-gated GitHub Release: source tarball + docs zip. |
| **Visual baselines** | `.github/workflows/visual-baselines.yml` | Manual (`workflow_dispatch`): regenerates the Linux Playwright visual baselines on the e2e runner and uploads them as an artifact to download + commit. |
| **Web app deploy** | `netlify.toml` | Builds + hosts the `web-app/` SPA on **Netlify** (separate from the GitHub release). |

## CI — `.github/workflows/ci.yml`

Runs on push to `dev`/`master`, on PRs, and on demand. Node 24. Three jobs: (1) **check** — `npm ci`,
then `npm run lint`, `npm run format:check`, `npm run smoke` (the [import smoke test](../plans/testing.md)),
and `npm run test:unit` (the Node Vitest suite); (2) **web-app** — `npm --prefix web-app ci`, then
`npm --prefix web-app run build` (the SPA is proven to build) and `npm --prefix web-app run test` (the jsdom
Vitest suite); (3) **e2e** — installs root + web-app deps and the bundled Playwright chromium, then
`npm run test:e2e` (E2E + accessibility + **visual-regression**). Visual works cross-OS because baselines
are committed per platform — `*-chromium-win32.png` (local, system Chrome) and `*-chromium-linux.png` (CI,
bundled chromium); `playwright.config.js` picks the browser by `process.platform` and only skips visual when
`PLAYWRIGHT_SKIP_VISUAL` is set (an escape hatch for a platform without baselines). Regenerate the Linux set
with the **Update visual baselines (Linux)** workflow (see below) — never hand-edit the PNGs. Green here
means the same thing as green locally — it's the CI mirror of `npm test` + the build + the browser specs.

## Visual baselines — `.github/workflows/visual-baselines.yml`

Manual `workflow_dispatch`. Runs on **ubuntu-latest with the same setup as the e2e job** (Node 24, `npm ci`
+ web-app `npm ci`, `npx playwright install --with-deps chromium`), then `playwright test visual.spec.js
--update-snapshots`, and uploads `tests/e2e/visual.spec.js-snapshots/` as the `linux-visual-baselines`
artifact. Because it renders in the exact environment the e2e job checks against, the baselines match CI.
Workflow: trigger it (`gh workflow run visual-baselines.yml`), download the artifact, copy the
`*-chromium-linux.png` files into `tests/e2e/visual.spec.js-snapshots/`, and commit. Do this whenever the
SPA's stable chrome changes (the Windows `*-win32.png` set is refreshed locally with
`npm run test:e2e:update`).

## Docs site — `.github/workflows/pages.yml`

On every push to `master`, runs `npm ci` then `npm run docs` (`scripts/build-docs.mjs` → **JSDoc** with
the **docdash** template) and deploys `docs/jsdoc` to GitHub Pages. `README.md` is the home
(jsdoc `opts.readme`), so the site is the README + the **code API** (per-function JSDoc) + the **full
living notes** wired in as tutorial pages (hierarchy mirrors the `notes/` tree). See
[`documentation.md`](documentation.md).

**One-time repo setup:** Settings → Pages → Build and deployment → Source = **GitHub Actions**. The
workflow needs `pages: write` + `id-token: write` and the `github-pages` environment (already declared
in the workflow).

## Software release — `.github/workflows/release.yml`

### The version gate

Trigger: **push to `master`** (FF-only from green `dev`, so always all-green). Gate: the tag
**`v<VERSION>` must not already exist** — i.e. `VERSION` was bumped since the last release. So:

- Bump `VERSION` (+ `package.json`, same commit; see [`versioning.md`](versioning.md)) → the next time
  `master` advances, that commit cuts the release and creates tag `vX.Y.Z`.
- A `master` push that did **not** bump `VERSION` → the tag already exists → no-op (no duplicate
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

The `web-app/` SPA is built and hosted on Netlify, independent of the GitHub release:

```
command   = npm --prefix web-app install && npm --prefix web-app run build
publish   = web-app/dist
functions = web-app/netlify/functions
```

`/api/*` routes to the serverless functions (the stateless BYOK generation proxy — see
[`../systems/web-app.md`](../systems/web-app.md)); every other path falls back to `index.html` for
client-side routing. Set `VITE_ONLINE=true` in the Netlify build env so the deployed build hides the
local-only providers.

## Policy (standing rules)

- **GitHub Releases are SOFTWARE releases only** — never a docs-only or images-only release. The
  versioned `release.yml` release is the only kind.
- **Every Release gets a clear, user-facing description by default** — `release.yml` composes it from
  the living changelog; keep that quality bar if you edit the step.
- **The docs site lives on GitHub Pages, not in git or a release** (no repo-size growth). The release
  attaches its own docs zip as an archival snapshot.

## Not done yet (intentional)

- **No deployments yet — too early in the rewrite/re-adapt (owner's call, 2026-06-18).** All three
  pipelines are wired but deliberately dormant: `master` is held at the old `241a148` (work stays on
  `dev`, which only runs CI — build/test, not a deploy), **GitHub Pages is not enabled** on the repo
  (Settings → Pages → Source still unset), and **no Netlify site is connected**. Advancing `master` is
  the single trigger for both the Pages docs deploy and the software Release, so nothing ships until the
  owner says go. Planned homes when ready: **GitHub Pages for the docs** (like the sibling project),
  **Netlify for the app** (functions).
- The hosted BYOK provider dispatch in `web-app/netlify/functions/generate.js` is a stub (migration
  phase 2). Local generation works today; the hosted path is wired but not yet pointed at a provider.
- No code signing / packaged installers (it's a Node app shipped as source). Revisit if a packaged
  binary is ever wanted.
