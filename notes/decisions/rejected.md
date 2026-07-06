# Rejected / Considered-and-Declined

Things that were tried or considered and deliberately not done. Don't re-attempt without new reasons.

## Pick-one groups + `{#any}` for blocks — rejected, then RECONSIDERED (2026-06-21)

Briefly removed mid-2.4.0 on the reasoning "a block is a script, not a word pool," then
**reinstated in 2.5.0** once the owner reframed it: a folder group / `{#any}` picks ONE *generator* (not one
word) and runs it — the generator-level analog of the lists' pick-one group. So implied `{#folder}` groups,
`.group` files, the `{#any}` / `{#any-sfw}` / `{#any-nsfw}` wildcard, and the same for expansions (`<folder>`)
ARE implemented. See [`../reference/blocks-architecture.md`](../reference/blocks-architecture.md).
The lasting decision: such a group/wildcard always resolves to **one concrete generator/snippet** (never a
union or a UI "pool"); it is the pick-one rule, not list-style line unions.

## Converting the plugin loaders to `await import()` (rejected 2026-06-18)

Would have forced the entire prompt pipeline async (it runs inside synchronous string-replace
callbacks). High risk, no user benefit. Used `createRequire` instead — Node 24 loads ESM synchronously.
See [`architecture.md`](architecture.md).

## Keeping the blocks as CommonJS `.cjs` (rejected 2026-06-18)

Would have left a CJS/ESM split. The owner asked for full ESM, and `createRequire(ESM)` removes the only
reason to keep them CJS. Rejected in favor of a uniform module system.

## Bulk-"fixing" the linter warnings in prompt files (rejected 2026-06-18)

`no-dupe-else-if` (dead branches) and `no-useless-escape` in `blocks/*` and the `data/` scripts
look fixable, but each edit risks changing generated prompts. Left as warnings to review deliberately
rather than auto-fixed. (Tracked in [`../plans/next-steps.md`](../plans/next-steps.md).)

## Reformatting `web/frontend/*` as ES modules (not done 2026-06-18)

The browser scripts are classic multi-`<script>` files that share globals (jQuery, lodash, helpers
across files). They are out of scope for the Node ESM migration and were left as-is (Prettier-formatted,
linted loosely). Converting them to real modules/bundling is a separate, optional future task.

## Using the Cowork bash sandbox for file work (rejected 2026-06-18)

It returned a false truncation of `package.json` and risks data loss. All real file work uses PowerShell
+ the Read/Edit/Write tools. See [`../reference/fix-patterns.md`](../reference/fix-patterns.md).
