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
