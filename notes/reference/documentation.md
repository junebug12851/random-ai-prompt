# Documentation (generation, comment style)

Everything about the project's documentation: how the doc-site is generated, what the house JSDoc
comment style is, and how the living notes render into the site.

---

## 1. Generating the docs

One generator, one command (from the repo root):

```
npm run docs        # node scripts/build-docs.mjs -> docs/jsdoc/
```

The project's single doc-site is **JSDoc** with the **docdash** template. `npm run docs` runs
`scripts/build-docs.mjs`, which:

1. **Wires the `notes/` tree (and the repo docs) in as JSDoc *tutorials*.** It walks `notes/**`, copies
   each Markdown page into a flat tutorials dir (`tmp/jsdoc-tutorials/`, git-ignored) with a path-derived
   id, builds a `tutorials.json` hierarchy that mirrors the folder tree (the role the old Doxygen
   `_nav.dox` played), and **rewrites the inter-note Markdown links** (`[x](../reference/foo.md)`) to the
   generated `tutorial-*.html` pages so cross-links resolve.
2. **Runs `jsdoc -c jsdoc.config.json`**, which renders the **code API** (from the `@file` + per-function
   JSDoc comments) plus those tutorial pages into `docs/jsdoc/`, with `README.md` as the home.

Open `docs/jsdoc/index.html`. The docdash sidebar carries **Tutorials** (the whole notes tree, under
*Project Notes* and *Project & Repository*) and a **Global** list of every documented function, with a
search box.

Requirements: **Node 24** + the dev dependencies (`jsdoc`, `docdash`) from `npm install`. No Doxygen, no
Graphviz — JSDoc parses ESM / `export default` natively, which is why it replaced Doxygen here.

### The fairyfox docs-site theme

The doc-site is **themed to match fairyfox.io** (this project is a node in the fairyfox mesh — see
[`cross-project-sync.md`](cross-project-sync.md)). The theme lives in `assets/docs-theme/` and is authored
**from scratch — it replaces docdash's stylesheet rather than overriding it** (so there's no
`!important` whack-a-mole against docdash's defaults, which is what leaked white backgrounds before):

- **`fairyfox-docs.css`** is the single authoritative stylesheet. It reproduces the hub's docs-site
  design tokens (dark-first warm palette with an OS-driven light theme, Fraunces/Inter/JetBrains type,
  the accent + focus ring) **and** drives docdash's whole DOM — the fixed sidebar `<nav>`, `#main`, the
  `#nav-trigger` mobile drawer, the API member/signature/param blocks, tables, code. It also carries the
  ported hub `.site-header` + `.subnav` styles for the injected chrome (below).
- **`fairyfox-docs.js`** injects, on every page, a **copy of the fairyfox.io site-header** (the Fairy Fox
  brand → `fairyfox.io` + the hub's primary nav: Home/Projects/Docs/Downloads/Updates/About) **and a
  well-organized project subnav** (the in-docs section bar: Overview · Project Notes · Systems ·
  Reference · Changelog + Repository/Notes links, with the active item tracked by page). This mirrors the
  sibling **`fairyfox-games`** project, which copied the hub header and added an organized subnav to its
  static site. The header + subnav go in one fixed `.ff-top` container whose measured height feeds a
  `--ff-header-h` CSS var so docdash's sidebar/`#main` clear it exactly (even when the subnav wraps); the
  docdash layout rules are scoped to `body > nav` / `.ff-top .wrap` so they don't collide with the
  injected `<nav>`s (docdash's sidebar is itself `<nav class="wrap">`). A footer at the bottom of `#main`
  links back to the main site. The script also injects the **self-hosted** shared fonts
  (`assets/docs-theme/fonts/fonts.css` — Fraunces/Inter/JetBrains served from this origin, **no Google
  Fonts request**, matching the project's privacy stance) + the light/dark `theme-color` metas, so
  crossing the boundary from fairyfox.io has no visible jump. On narrow screens (≤820px) the primary hub
  nav collapses (brand still links home) and the subnav scrolls horizontally, leaving docdash's own
  hamburger as the only one.
- **The module sidebar is confined to the API pages.** docdash's generated sidebar (Search + Modules +
  Global) shows only on the **code-reference** pages, reached via the subnav's **`API`** item (landing
  `global.html`). The Overview home and every notes tutorial render full-width with no sidebar —
  `fairyfox-docs.js` tags those pages with `.ff-no-sidebar` (`isApiPage()` = not `index.html` and not a
  `tutorial-*` page) and the CSS hides `body > nav` + the mobile hamburger and centres `#main`. On the
  API pages the sidebar is decluttered: the `GitHub ↗` `docdash.menu` entry is gone, and the script
  prunes docdash's `Home` link (Overview is home) and the `Tutorials` section (now the subnav). The
  subnav's external group carries `Download ↗` (→ GitHub releases), `Repository ↗`, `Notes ↗`.
- **Reading experience + Kindle-style reader menu.** Overview + notes render in a centred reading column
  with gentle typography driven by tunable `--reading-*` CSS vars (font-size, line-height, letter-spacing,
  width); README/notes images are framed + sized to the column. `build-docs.mjs` strips each tutorial's
  duplicate leading H1 + `{#anchor}` heading syntax, and `fairyfox-docs.js` drops docdash's `Tutorial:`
  prefix + duplicate `<h2>`. The palette adds a softer light (no stark white) and a **sepia** theme. An
  **"Aa"** button in the header opens a reader panel (Theme Auto/Light/Sepia/Dark · Text size · Line
  spacing · Width) that writes those vars + `data-theme`; prefs persist under the **origin-wide**
  `localStorage` key `fairyfox:reader`, so the choice is **shared across all same-origin fairyfox.io
  sites** (the hub + `fairyfox-games` need only read the same key).

Wiring (in `build-docs.mjs`, after JSDoc runs): the from-scratch `fairyfox-docs.css` is **copied over the
generated `docs/jsdoc/styles/jsdoc.css`**, replacing docdash's default sheet entirely; `fairyfox-docs.js`
+ the vendored `fonts/` (self-hosted Fraunces/Inter/JetBrains woff2 + `fonts.css`) are copied to
`docs/jsdoc/assets/docs-theme/` (the path `jsdoc.config.json` → `docdash.scripts` links).
`jsdoc.config.json` also sets `docdash.meta`. This runs both locally and in the
`pages.yml` CI build. The generated API reference is a
deliberately *boundaried* zone — fully themed via our sheet rather than a bespoke Jekyll shell. Published
at `fairyfox.io/random-ai-prompt/` (GitHub Pages inherits the user-site custom domain; base path = repo
slug — no project `CNAME`).

### Theme is modular (CSS `@import` partials + JS ES modules)

The theme is **small, focused, browser-imported files** — no bundler:

- **CSS:** `assets/docs-theme/fairyfox-docs.css` is a tiny entry of `@import`s. The real styles live in
  `assets/docs-theme/theme/*.css` — `tokens.css` (design tokens + the light/sepia/dark palettes +
  `--reading-*`), `base.css` (reset/type/links/code + the prettify syntax palette + skip link),
  `layout.css` (the docdash `body > nav` sidebar + `#main` + mobile drawer), `chrome.css` (the injected
  header/subnav/footer), `content.css` (reading column + API blocks), `reader.css` (the Aa menu), and
  `download.css`. The build copies them into `docs/jsdoc/styles/theme/` (so the `@import`s resolve).
- **JS:** `assets/docs-theme/fairyfox-docs.js` is an **ES-module entry** that `import`s from
  `assets/docs-theme/modules/*.js` — `util.js` (constants + DOM helpers + page-type checks), `chrome.js`
  (skip link + header/subnav/footer + fonts/theme-color), `sidebar.js` (prune docdash's sidebar +
  de-dupe tutorial titles), `reader.js` (the Aa reader menu). The build copies `modules/` alongside and
  **post-processes docdash's `<script>` tag to `type="module"`** (docdash emits a plain script).

### SEO / social + accessibility

`build-docs.mjs` post-processes **every** generated HTML page (crawler-visible, not JS-injected): a
per-page `<meta name="description">` (pulled from the page's first paragraph), `<link rel="canonical">`,
Open Graph + Twitter Card tags, `robots`, and a JSON-LD `WebPage`/`TechArticle` block; it also ensures
`<html lang="en">`, gives docdash's icon-only drawer checkbox an accessible name, and writes a
`sitemap.xml` + `robots.txt`. The pages meet **WCAG 2.1 AA** — verified with `@axe-core/playwright`
(0 violations across Overview/notes/API/Download in both light and dark): visible focus, a skip link,
underlined in-text links (1.4.1), AA colour contrast on every token, keyboard-operable reader menu
(roles/labels, Escape, focus handling), and landmark/heading structure.

### What's covered / what's not

- **Code API:** every authored `.js` under `src/` + the `data/process-*.js` build scripts, **and the
  `gui/` React SPA** (config `jsdoc.config.json`: `source.include` adds `tmp/webapp-docs`). JSDoc
  can't parse JSX, so `build-docs.mjs` babel-transpiles `gui/src` + the Netlify function into
  `tmp/webapp-docs` (JSX stripped, comments kept) and JSDoc reads that mirror; the `@module` tags give
  clean nav names. `README.md` is the landing page (`opts.readme`).
- **Notes:** the entire `notes/` tree + `list-credits.md` / `list-help.md` / `Upgrade-2-0.md` render as
  tutorial pages, auto-discovered by `build-docs.mjs` (no manual nav file to maintain).
- **Not covered:** `node_modules/`, `output/`, `tmp/` source (only the generated `tmp/webapp-docs`
  mirror is read), the local-only `assets/`, the built `gui/dist/`, the vendored `web/frontend/lib`
  + `*.min.js`, and the Pug templates / CSS (no JS doc generator parses Pug or CSS — those are covered
  conceptually in [`../systems/`](../systems/README.md)).

### How the code is documented

JSDoc extracts a real **per-function API** (it handles ESM / `export default` where Doxygen could not):

- **A `/** @file */` header on every authored `.js`** — 165 under `src/` + the 3 `data/process-*.js`
  scripts; the vendored `lib/*.min.js` are left untouched. Each file gets a description, with richer
  multi-line module headers on the files with real logic.
- **Per-function JSDoc** (`@param`/`@returns`/description) on **all server-side code, all 113
  dynamic-prompt generators, all top-level `web/frontend/*` functions, and the entire `gui/` SPA**
  (every lib function + provider + the Netlify handler + every React component, each file an `@module`).
  The only things without per-function docs are anonymous callbacks (Express route arrows, jQuery
  closures, `$(document).ready`, React inline event handlers), which no generator extracts. Quality
  varies by layer: the engine / core-logic / gui docs are bespoke; the dynamic-prompts and the
  classic frontend handlers are accurate generated scaffolds (correct params/returns, humanized
  descriptions).
- **The notes pages carry the conceptual depth** the code comments don't — the prompt DSL
  ([prompt-dsl.md](prompt-dsl.md)), the dynamic-prompt catalog ([dynamic-prompts.md](dynamic-prompts.md)),
  and the system map ([`../systems/`](../systems/README.md)) — and they live in the **same site**, as
  tutorials.

Terminology note: the `/** … */` *comments* are "JSDoc comments" — pure JavaScript, no TypeScript.

### Build inputs vs. gitignored reference

`assets/` (the local-only reference area — e.g. the pinned pre-revival source snapshot) is **gitignored,
but ESLint / Prettier still walk the filesystem**, so it must be excluded in both (`eslint.config.js`
`ignores`, `.prettierignore`). JSDoc only reads its configured `source.include`, so it isn't affected.
**Gitignored ≠ tool-ignored.** See [`fix-patterns.md`](fix-patterns.md).

### Files (the doc footprint)

- `jsdoc.config.json` — the JSDoc config (source roots, the docdash template + options, `opts.tutorials`).
- `scripts/build-docs.mjs` — generates the note tutorials (+ link rewriting), babel-transpiles the
  `gui/` JSX into a JSDoc-readable mirror, and runs JSDoc.
- `docdash` (devDependency) — the template (sidebar nav, search box). `@babel/core` + `@babel/preset-react`
  — used by `build-docs.mjs` only, to strip JSX for documentation (not part of the app build).
- `docs/jsdoc/`, `tmp/jsdoc-tutorials/`, and `tmp/webapp-docs/` — generated output. **git-ignored**.

### Adding or renaming a note

Nothing extra to maintain — `build-docs.mjs` auto-discovers every `notes/**.md` and places it in the
tutorial tree by its folder path (a folder's `README.md` becomes that section's hub; folders without one
get a synthetic hub). Keep cross-links **relative** (`[x](../reference/foo.md)`, `[x](sibling.md)`) so the
build rewrites them to tutorial links.

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

The doc-site builds clean — `npm run docs` (JSDoc + docdash, exit 0, ~244 pages): the README home, the
per-function code API, and the whole `notes/` tree as tutorial pages with working cross-links.
**Documentation coverage is complete** (2026-06-18): `@file` on every authored `.js`, and per-function
JSDoc across the **whole repo** — all server-side code, all 113 dynamic prompts, all top-level
`web/frontend/*` functions, **and the entire `gui/` React SPA** (16 modules: every lib function +
provider + the Netlify handler + each React component, via the babel-transpile-then-JSDoc path). Only
anonymous callbacks remain, which no generator extracts. **Doxygen was retired here** (2026-06-18) in
favour of the single JSDoc site — it couldn't parse the anonymous `export default` plugins, and one tool
now does the code API (incl. JSX) and the notes.
