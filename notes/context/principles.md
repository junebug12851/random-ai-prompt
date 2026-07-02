# Project Principles

What this project values, and what to avoid. (Phrased so an AI working on the repo applies them by
default.)

## Do

- **Keep it data-driven and easy to extend.** Adding a prompt should mean dropping a file in
  `dynamic-prompts/`, `lists/`, `expansions/`, or `presets/` — not editing core logic. Preserve that.
- **Preserve generated output and user data.** A user's `output/` images (+ their `.json` sidecars) and
  `user-settings.json` are precious. Never delete, overwrite, or corrupt them as a side effect. Image
  metadata is the source of truth for the search index and for re-rolls/variations.
- **Fail loudly, not silently.** Surface errors (the WebUI being down, a bad file) clearly; don't
  swallow them in a way that hides a problem or loses work.
- **Match the existing module shapes.** Dynamic prompts are `export default function (settings,
  imageSettings, upscaleSettings)`; settings are `export default {…}`; the loader contracts in
  `src/core/` expect those. Keep new files consistent so the scanners/loaders keep working.
- **One engine, no duplicated logic.** The isomorphic `src/core/` engine is the single source of prompt
  behavior — the SPA runs it in the browser and the Node side runs the same code for tests and the local
  `/api`. Keep new behavior in the engine so both surfaces (and a future CLI) stay in sync.

## Avoid

- **No CommonJS.** This is ES modules now. No `require`/`module.exports`/`__dirname` — the only
  `require` allowed is the deliberate `createRequire` for synchronous config-driven plugin loading and
  the legacy settings migration. See [`../reference/esm-patterns.md`](../reference/esm-patterns.md).
- **No `node-fetch` or other already-removed deps.** Use the global `fetch`.
- **No hacks or silent fallbacks in the prompt pipeline.** It's the heart of the tool; keep it correct
  and readable.
- **Don't reformat or "fix" creative prompt logic just because a linter flags it.** Redundant regex
  escapes and duplicate `else if` branches are flagged as warnings on purpose — changing them can
  change the prompts users get. Review deliberately, don't bulk-rewrite.

## Working environment

- Use **PowerShell** and the **file tools (Read/Edit/Write)** on this machine. The Cowork bash sandbox
  has reported false file truncations and risks data loss — don't use it for real file work. See
  [`../reference/fix-patterns.md`](../reference/fix-patterns.md).
