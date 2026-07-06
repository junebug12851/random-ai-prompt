# `user/` — your content, kept separate from the app's

This folder is **yours**. It sits beside the app's built-in content (`data/`) and the app watches
both. Anything you drop in here overlays the built-ins, so you can add and tweak prompt content
freely without editing — or fighting merge conflicts with — the files that ship with the app.

```
user/
  lists/      your word lists         (overlays data/lists)
  blocks/     your dynamic prompts     (overlays data/dynamic-prompts — "blocks" in the app)
  settings/   your settings + app state (the local per-namespace store)
```

## How the overlay works

- **Additive by default.** A new file here — a list like `user/lists/place/secret-cove.txt`, or a block
  like `user/blocks/user/beach-merk.dpl` (Merk's community beach scene ships here) — simply shows up as
  a new list/block, grouped at the **top** of the Manage tab under **Your content**.
- **User wins on a name clash.** If one of your files has the **same name** as a built-in
  (e.g. `user/lists/place/beach.txt` vs the built-in `beach`), **your version is used** and the
  built-in is hidden — the same "your override wins" rule settings already follow. Delete your file
  to fall back to the built-in.
- **Same shape as `data/`.** Lists are `<name>.txt` (one entry per line); blocks are `<name>.dpl`
  (or a `.js` generator) under a category folder (`scene/`, `subject/`, `style/`, `fragment/`,
  `prompt/`, `user/`). Folder markers (`_force-prefix`, `_enable/_disable-group-list`) and `<name>.json`
  description sidecars work here too.

## Scope

The overlay is a **local / desktop** feature — it's read from disk by the app running on your machine
(and surfaced live in the **Manage** tab). The hosted online build has no filesystem, so it ignores
`user/` and ships only the built-in `data/` content.

## What's tracked in git

`user/lists/` and `user/blocks/` are tracked, so **community-contributed** content committed by the
maintainer ships with the app. `user/settings/` is your private runtime data and is **git-ignored**
(never committed) — like a browser's local storage, but as plain files you can read and back up.
