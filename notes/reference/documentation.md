# Documentation (generation, comment style)

Everything about the project's documentation: how the doc-site is generated, what the house JSDoc
comment style is, and how the living notes render into the site.

---

## 1. Generating the docs

Two generators, two purposes (run from the repo root):

```
npm run docs        # Doxygen  -> docs/html/    (the living-notes site + GitHub Pages)
npm run docs:api    # JSDoc    -> docs/jsdoc/   (the ESM-native code API)
```

- **Doxygen** (`Doxyfile`) hosts the **living notes** (this `notes/` tree, the changelog, the README)
  as a cross-linked, navigable site — its strength here — and is what `pages.yml` deploys to GitHub
  Pages. Open `docs/html/index.html`.
- **JSDoc** (`jsdoc.config.json`, the `jsdoc` devDependency) builds the **code API** from the ESM
  source, reusing the same `/** @file */` headers; one page per file, `README.md` as the homepage.
  Open `docs/jsdoc/index.html`. JSDoc parses `export default` / ESM properly where Doxygen does not.
  Today it renders **file-level** overviews (every file carries an `@file` header, but the functions
  don't yet carry per-function `@param`/`@returns`); adding function-level JSDoc to the named exports
  (helpers, `core/` factories, prompt-modules) would turn it into a true per-function API.

Both output dirs are git-ignored; `Doxyfile`, `jsdoc.config.json`, and the vendored theme are tracked.

Requirements on the machine running it:

- **Doxygen** 1.9.5+ (the theme's `HTML_COLORSTYLE = LIGHT` handling needs ≥1.9.5; CI pins 1.14.0).
- **Graphviz** (`dot`) is **not** required — `HAVE_DOT = NO` in the Doxyfile (call/include graphs are
  low-value for this JS codebase). Flip `HAVE_DOT = YES` if `dot` is on `PATH` and you want diagrams.

### What's covered / what's not

- **Covered:** the JavaScript under the source roots listed in the Doxyfile `INPUT` — the entry points
  (`index.js`, `server.js`, `common.js`, `chdir.js`, the `*-settings.js`), `core/`, `src/`,
  `prompt-modules/`, `dynamic-prompts/`, `helpers/`, `web/backend/`, and `web-app/src/`. `README.md` is
  the landing page (`USE_MDFILE_AS_MAINPAGE`).
- **Also covered:** the `notes/` tree is in `INPUT`, so the living notes build as cross-linked doc-site
  pages, and the changelog (`version.md` + `version/`) renders under Related Pages.
- **Not covered:** `node_modules/`, generated `output/`, `tmp/`, the local-only `assets/`, the built
  `web-app/dist/`, vendored `*.min.js`, and the Pug templates (Doxygen can't parse Pug).

### How JavaScript is documented (the file-level model)

Doxygen's JavaScript parser does **not** extract this code's symbols: the dynamic-prompt generators are
anonymous `export default function () {…}`, and Doxygen attaches no documentation to an anonymous default
export (it also doesn't reliably surface module-scope `function`/`const`). Verified empirically —
`city.js`'s File Reference page lists zero functions. So per-function API extraction is **not** what this
site provides, and chasing it (e.g. rewriting ~120 plugins to named exports just to satisfy the parser)
is out of bounds — a doc pass changes only comments.

What it provides instead, comprehensively:

- **A `/** @file @brief */` header on every authored `.js`** — all 165 under `src/` plus the 3
  `data/process-*.js` build scripts; the vendored `lib/*.min.js` are left untouched. Doxygen renders
  these in the **File List**, so every file has a one/two-line description — the tool-honest form of
  "every file documented."
- **Richer multi-line module headers** on the files with real logic (entry points, settings, loaders,
  `genImg`, the prompt-modules, helpers, `core/`, `indexImages`), each pointing to the relevant notes
  page for the how/why.
- **The notes pages carry the conceptual depth** Doxygen can't pull from the code — the prompt DSL
  ([prompt-dsl.md](prompt-dsl.md)), the dynamic-prompt catalog ([dynamic-prompts.md](dynamic-prompts.md)),
  and the system map ([`../systems/`](../systems/README.md)).

**JSDoc the _tool_** (jsdoc.app, `npm run docs:api`) is wired up alongside Doxygen for exactly this — a
no-TypeScript, ESM-native code API into `docs/jsdoc/` that reuses these same `@file` headers and **does**
extract per-function docs where Doxygen can't. The per-function pass is **complete for all server-side
code**: `@param`/`@returns`/descriptions on every function in the prompt engine (prompt-modules, helpers,
`core/`), the loaders, settings, `common`/`genImg`/`promptFilesAndSuggestions`, the `server.js` helpers,
and the self-healing image index — plus a uniform documented contract on all **113 dynamic-prompt**
generators. The one deliberate exception is the **legacy `web/frontend/*` browser scripts** (the jQuery
client being retired per [web-migration](../plans/web-migration.md)): those stay file-level for now.
Terminology note: the `/** … */` *comments* here are "JSDoc comments" regardless of which generator
consumes them — no TypeScript is involved either way.

### Build inputs vs. gitignored reference

`assets/` (the local-only reference area — e.g. the pinned pre-revival source snapshot) is **gitignored,
but ESLint / Prettier / Doxygen still walk the filesystem**, so it must be excluded in all three
(`eslint.config.js` `ignores`, `.prettierignore`, `Doxyfile` `EXCLUDE`) or it pollutes lint, format, and
the doc-site. **Gitignored ≠ tool-ignored.** See [`fix-patterns.md`](fix-patterns.md).

### Files (the entire doc footprint)

- `Doxyfile` — the one config file (root). Curated, not a full default dump; unlisted tags take
  defaults. Upgrade across Doxygen versions with `doxygen -u Doxyfile`.
- `docs/doxygen-awesome/doxygen-awesome.css` — vendored theme (MIT). See that folder's README.
- `docs/html/` — generated output. **git-ignored**, never committed.

### Markdown pages, links & navigation

- **Every Markdown page is placed in an explicit tree** by `notes/_nav.dox`, which builds the
  top-level "Related Pages" hubs: **Project Notes** (all of `notes/`) and **Project & Repository**
  (`list-credits.md`, `list-help.md`, `Upgrade-2-0.md`, `VERSION`, `LICENSE`). **Hard rule:** any
  Markdown file added to the Doxyfile `INPUT` must get a `\subpage` line in `_nav.dox` — never let
  Doxygen auto-append a page flat at the top of Related Pages. The index READMEs carry explicit
  `{#labels}` (`rap_notes_system`, `rap_sessions_about`, `rap_systems_about`); everything else uses
  Doxygen's path-derived IDs (`md_notes_2<dir>_2<file>`, where `_2` encodes a `/`).
- **`AUTOLINK_SUPPORT = NO`** — otherwise Doxygen turns every bare filename in the notes (even inside
  `backticks`) into a link to a near-empty "File Reference" stub. With it off, only real
  `[text](file.md)` links and `\ref` resolve. (Cost: prose mentions of code names don't auto-link; use
  `\ref`/`\see`.)
- **`MARKDOWN_ID_STYLE = GITHUB`** — heading anchors match the `#slug` style GitHub uses.
- **`LICENSE`, `VERSION`** (extensionless) are in `INPUT` + `FILE_PATTERNS` with
  `EXTENSION_MAPPING = no_extension=md`, so the README's `[LICENSE](LICENSE)` / `[VERSION](VERSION)`
  links resolve.
- **Doxygen version matters for CI** — apt's old 1.9.1 mis-parses some Markdown; `pages.yml` /
  `release.yml` install the current release from the **Doxygen GitHub release** so CI output matches a
  modern local toolchain. Bump the pinned version when the local toolchain moves.

---

## 2. Comment style (house rules — JSDoc)

The conventions documentation passes follow, so comments read as one consistent voice.

- **Module docs at the top of the file.** Open each module with a short block describing its *role* and
  any non-obvious wiring (ownership, the `createRequire` plugin-loading seam, the `chdir` ordering
  constraint, Express-5 route caveats). The existing `core/*.js` headers are the style reference.
- **Function docs with JSDoc tags** where the signature isn't self-explanatory: `@param`, `@returns`,
  `@see`. Keep them human — describe purpose, not the obvious restatement of the signature.
- **`//` inline notes** for the non-obvious "why" next to the code. Encouraged.
- **Describe purpose and role**, not the mechanics a reader can see. Call out the landmines documented
  in [`esm-patterns.md`](esm-patterns.md).

### Hard rules

- **Never delete an existing human-written comment.** Merge its meaning if it overlaps a new block;
  otherwise leave it untouched.
- **A documentation pass changes only comments — never a line of code.** Verify before committing.
- Preserve the licence header where present.

---

## 3. Status

Both doc generators build clean (`npm run docs` Doxygen, exit 0; `npm run docs:api` JSDoc, exit 0).
**File-level coverage is complete** (2026-06-18): every authored `.js` (165 under `src/` + 3 `data/`
build scripts) carries a `@file @brief`. **Per-function JSDoc is complete for all server-side code and
all 113 dynamic prompts** — the prompt engine, loaders, settings, `common`/`genImg`/
`promptFilesAndSuggestions`, the `server.js` helpers, and the image index all carry `@param`/`@returns`,
so they extract as a real per-function API in `docs/jsdoc/`. The remaining gap is the legacy
`web/frontend/*` browser scripts, kept file-level on purpose (jQuery client being retired). `core/`
remains the prose style reference. Doxygen's own symbol extraction is still not pursued (it can't parse
the anonymous default exports — see "the file-level model" above; JSDoc is the code-API generator).

Three build warnings remain and are **benign** (`WARN_AS_ERROR = NO`, so the build stays clean):

- `esm-patterns.md` — a Doxygen markdown backtick-pairing quirk; the page renders fully and correctly,
  and it's pre-existing. Not worth restructuring the notes prose to silence.
- `README.md` ×2 — the README's own TOC anchors (`#faq`, `#automattic1111-…`) resolve on GitHub but not
  in Doxygen, which would need `{#}` braces that GitHub renders literally. The public README is left as-is.
