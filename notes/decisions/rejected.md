# Rejected / Considered-and-Declined

Things that were tried or considered and deliberately not done. Don't re-attempt without new reasons.

## Group entry lists / implied `{#folder}` groups for dynamic prompts (rejected 2026-06-21)

The list system makes a folder with 2+ entries an implied group (`{folder}` = a random member). This was
ported to dynamic prompts mid-2.4.0 (`{#scene}` = a random scene generator, plus `.group` files and
`_enable/_disable-group-list` markers) and then **removed** at the owner's direction: "no clickable group
folders for dynamic prompts — they're not lists of words, they're scripts with a specific input and output."
A dynamic-prompt folder is **organization only**; there is no `{#folder}` random-member token. A
catalog-wide `{#any}` random-pick wildcard was also added in this pass and then **removed** at the owner's
direction ("#any — this isn't a list where we need to pick out an entry among many"). Every `{#name}` names
one concrete generator. Don't re-add folder/`.group` grouping or an `{#any}` wildcard for dynamic prompts.

## Converting the plugin loaders to `await import()` (rejected 2026-06-18)

Would have forced the entire prompt pipeline async (it runs inside synchronous string-replace
callbacks). High risk, no user benefit. Used `createRequire` instead — Node 24 loads ESM synchronously.
See [`architecture.md`](architecture.md).

## Keeping the dynamic prompts as CommonJS `.cjs` (rejected 2026-06-18)

Would have left a CJS/ESM split. The owner asked for full ESM, and `createRequire(ESM)` removes the only
reason to keep them CJS. Rejected in favor of a uniform module system.

## Bulk-"fixing" the linter warnings in prompt files (rejected 2026-06-18)

`no-dupe-else-if` (dead branches) and `no-useless-escape` in `dynamic-prompts/*` and the `data/` scripts
look fixable, but each edit risks changing generated prompts. Left as warnings to review deliberately
rather than auto-fixed. (Tracked in [`../plans/next-steps.md`](../plans/next-steps.md).)

## Reformatting `web/frontend/*` as ES modules (not done 2026-06-18)

The browser scripts are classic multi-`<script>` files that share globals (jQuery, lodash, helpers
across files). They are out of scope for the Node ESM migration and were left as-is (Prettier-formatted,
linted loosely). Converting them to real modules/bundling is a separate, optional future task.

## Using the Cowork bash sandbox for file work (rejected 2026-06-18)

It returned a false truncation of `package.json` and risks data loss. All real file work uses PowerShell
+ the Read/Edit/Write tools. See [`../reference/fix-patterns.md`](../reference/fix-patterns.md).
