# Documentation (generation, comment style)

Everything about the project's documentation: how the doc-site is generated, what the house JSDoc
comment style is, and how the living notes render into the site.

---

## 1. Generating the docs

The doc-site is generated with **Doxygen** (Doxygen documents JavaScript as well as C/C++/Java). From
the repo root:

```
npm run docs        # == doxygen Doxyfile
```

Open `docs/html/index.html`. One command, one config file.

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
- **Not covered:** `node_modules/`, generated `output/`, `tmp/`, the built `web-app/dist/`, vendored
  `*.min.js`, and the Pug templates / classic `web/frontend/` browser scripts (not run through a doc
  generator — they carry plain inline comments).

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

The doc-site builds (`npm run docs`) and renders both the API docs and the living notes. The
project-wide JSDoc comment pass is **ongoing** — `core/` is the style reference; other layers gain
module/function docs as they're studied (mirror the system-map deep-dives in
[`../systems/`](../systems/README.md)). Record progress here as layers are completed.
