# Fix Patterns — error → fix lookup

Quick table of errors hit and how they were resolved. Add a row whenever you fix something reusable.

| Error / symptom | Cause | Fix |
|-----------------|-------|-----|
| `ERR_MODULE_NOT_FOUND` for a local import | ESM relative import without a file extension | Add `.js`: `import x from "./foo.js"`. |
| `require is not defined in ES module scope` | Leftover CommonJS `require` in an ESM file | Convert to `import`, or — only for synchronous config-driven plugin loading / legacy migration — `const require = createRequire(import.meta.url)`. See [`esm-patterns.md`](esm-patterns.md). |
| `__dirname is not defined` | `__dirname`/`__filename` don't exist in ESM | Use `import.meta.dirname` / `import.meta.url`. |
| A dynamic prompt loaded but `fn is not a function` | `require(esm)` returns a namespace, not the function | Call `.default(...)`; read `.full` / `.suggestion_exclude` as named exports. |
| Settings read from the wrong directory after ESM conversion | Imports evaluate before top-level `process.chdir` | Move the chdir into `chdir.js` and import it first in `common.js`. |
| `Cannot find package 'node-fetch'` | Dependency removed in 2.0.0 | Delete the import; use the global `fetch`. |
| ESLint: `'console' is not defined` in a stray `.mjs` | A scratch file got no Node globals from the flat config | It's a temp file — delete it, or add Node globals / ignore it. |
| ESLint errors `no-useless-escape` / `no-dupe-else-if` in prompt files | Pre-existing redundant escapes / duplicate `else if` branches | Left as **warnings** on purpose (changing them can change generated prompts). Review deliberately; don't bulk-rewrite. |
| Bash sandbox reports `package.json` truncated / "Unterminated string" | The Cowork **bash** mount returned a false, truncated view of a file the host had written correctly (risk of acting on bad data / data loss) | **Don't use the bash sandbox** for file work here. Use PowerShell + the Read/Edit/Write tools, which see the real host files. |
| `npm run lint` / `format` / `docs` suddenly flooded with errors after adding files under `assets/` | `assets/` is **gitignored but the tools walk the filesystem** — ESLint/Prettier/Doxygen indexed the local reference snapshot (old CommonJS/jQuery → 100s of `no-undef`). Gitignored ≠ tool-ignored. | Exclude `assets/` in **all three**: `eslint.config.js` `ignores`, `.prettierignore`, and `Doxyfile` `EXCLUDE`. Restore a tool-modified snapshot from its own `.git` (`git checkout -- .` inside it). |
| Doxygen: `Reached end of file while still inside a (nested) comment` from a JS file | A `/** @file @brief … */` block whose text contains `/*` (e.g. a glob like `presets/*.json` or `output/*.json`) — the `/*` opens a nested comment that breaks the block | Reword the brief to avoid `/*` and `*/` sequences (drop the `*`: write `data/presets` or `the output/ sidecars`). |
| Source files show mojibake (em-dash → `â€—`, `Â `, `Ã©`) after a PowerShell edit script | Windows PowerShell `Get-Content -Raw` reads as **ANSI (Windows-1252)**, not UTF-8; writing back as UTF-8 double-encodes any non-ASCII char | Read/write UTF-8 explicitly: `[IO.File]::ReadAllText(p,[Text.Encoding]::UTF8)` / `WriteAllText(p,s,(New-Object Text.UTF8Encoding $false))` — or just use the Read/Edit tools. **Repair** a single round-trip: `[Text.Encoding]::UTF8.GetString([Text.Encoding]::GetEncoding(1252).GetBytes($s))`. |
