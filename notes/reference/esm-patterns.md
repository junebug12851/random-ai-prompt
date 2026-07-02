# ESM Patterns — the CommonJS → ES-module landmine catalog

The rules and gotchas for module wiring in this repo, learned during the 2026-06-18 migration. Read
this before changing how modules import/export or how dynamic prompts/prompt modules are loaded.

## The basics (non-negotiable)

- `"type": "module"` is set. Files are ES modules.
- **Relative imports need a file extension:** `import x from "./foo.js"` — `"./foo"` throws
  `ERR_MODULE_NOT_FOUND`.
- **Builtins use the `node:` prefix:** `import fs from "node:fs"`.
- No `require`, `module.exports`, `exports`, `__dirname`, `__filename`. Use `import`/`export`,
  `import.meta.url`, `import.meta.dirname` (Node 20.11+).
- Default import of a CommonJS dependency gives its `module.exports` (interop): `import _ from "lodash"`,
  `import express from "express"`, `import crc from "crc"` (then `crc.crc32(...)`).

## Landmine 1 — import ordering vs `process.chdir`

> **Historical:** the specific `chdir.js` / `common.js` example below was part of the pre-revival classic
> system, now removed from the tree. The active engine has **no** `chdir` shim (its loaders resolve
> content module-relative via `import.meta.url`, cwd-independent). The general rule at the end still holds
> and is the reason this entry stays.

**Symptom:** code that depended on `process.chdir(__dirname)` running before settings load broke,
because in ESM all `import`s are evaluated (depth-first, in source order) **before** any top-level
statement in the importing file.

The old `common.js` did `process.chdir(__dirname)` on line 1 of its body, then `require`d settings.
Converting `require`→`import` would hoist the settings module *above* the chdir, so it would read
`./user-settings.json` from the wrong cwd.

**Fix:** extract the side effect into its own module and import it first.

```js
// chdir.js
process.chdir(import.meta.dirname);

// common.js (first line)
import "./chdir.js";
import loadSettings from "./src/loadSettings.js"; // now evaluated after the chdir
```

Rule: **any setup that must precede other modules' evaluation goes in a module imported first**, not in
a top-level statement.

## Landmine 2 — synchronous, config-driven plugin loading

Dynamic prompts and prompt modules are loaded by a **runtime path** and called **synchronously** inside
string-replace callbacks (`prompt.replaceAll(/#(\w+)/, (m, name) => require(...)(...))`).
`await import()` can't be used there without rewriting the whole pipeline async.

**Fix:** Node 24 can `require()` ES modules synchronously (no top-level await in the target). Use a
scoped require:

```js
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const mod = require(`../${settings.dynamicPromptFiles}/${name}`); // returns the ESM namespace
mod.default(settings, imageSettings, upscaleSettings);            // call the default export
mod.full;                 // read named exports too
mod.suggestion_exclude;
```

Used in `prompt-modules/dynamic-prompt.js`, `common.js` (prompt modules), and
`src/promptFilesAndSuggestions.js` (the classification scan). **Do not** "modernize" these into
`await import()`.

## Landmine 3 — default vs named exports must match the consumer

- `helpers/listFiles.js` → **`export default { … }`** (an object), because consumers index it
  dynamically: `listFiles[\`${keyword}Alias\`]`. A namespace of named exports can't be flipped to that
  shape cleanly.
- `helpers/keywordRepeater.js` → **named exports** (`export { keywordRepeater, artistRepeater }`),
  because consumers destructure: `import { artistRepeater } from "../helpers/keywordRepeater.js"`.
- Dynamic prompts → `export default function (...)` plus `export const full = true;` /
  `export const suggestion_exclude = true;`. The loader reads `.default`, `.full`, `.suggestion_exclude`
  off the namespace.
- Settings files → `export default { … }`; `src/loadSettings.js` imports them as defaults.

When you convert or add a module, check **how it's consumed** before choosing default vs named.

## Landmine 4 — dynamic JSON requires

`require("./foo.json")` is gone. Two replacements:

- **Data that changes at runtime** (image sidecars, presets read on demand):
  `JSON.parse(fs.readFileSync(path, "utf8"))`. Watch the **base path** — `require` resolved relative to the *file*;
  `fs.readFileSync` resolves relative to **cwd** (which is the project root thanks to `chdir.js`). The
  old `../${saveTo}/${name}.json` (relative to `src/`) became `${saveTo}/${name}.json` (from root).
- **Static JSON shipped with a module:** `import data from "./file.json" with { type: "json" };`
  (Node 24 import attributes). Used in `data/process-nai-tag-expirement.js`. This resolves relative to
  the *module*, so it's the right choice when cwd shouldn't matter.

## Landmine 5 — dropped/changed dependencies

- **`node-fetch` removed** — Node 24 has a global `fetch`. Just delete the import and use `fetch(...)`.
- **`open` v11, `yargs` v18** are ESM-first: `import open from "open"`, `import yargs from "yargs"` +
  `import { hideBin } from "yargs/helpers"`.
- **Express 5** — the route patterns used here (`:param`, static mounts, `res.jsonp/render/download`)
  are all v5-compatible. Beware bare `*` wildcards and regex route strings if you add routes (v5 uses a
  newer path-to-regexp). See [`dependencies.md`](dependencies.md).

## Verifying module wiring

There's no unit suite. Validate ESM changes with:

1. `node --check path/to/file.js` — syntax.
2. `npm run lint` — unresolved/undeclared issues, 0 errors expected.
3. The **import smoke test** (described next).

The import smoke test is a tiny script that does:

```js
import common from "./common.js";
import promptFiles from "./src/promptFilesAndSuggestions.js";
promptFiles.init(common.settings);
promptFiles.loadAll();
// …then expand a prompt with dynamic-prompt.js
```

This exercises the entire graph — including loading every dynamic prompt via the synchronous require(ESM) path and the default/named export contracts — without starting a server or hitting the network.
