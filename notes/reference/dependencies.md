# Dependencies

Current as of the 2.0.0 modernization (2026-06-18). Node **24 LTS**. Keep this in sync when you add,
remove, or bump a dependency.

## Runtime dependencies

| Package | Major | Used by | Notes |
|---------|-------|---------|-------|
| `express` | **5** | `server.js`, progress server in `index.js` | v5 uses a newer path-to-regexp. The routes here are all simple (`:param`, static mounts, `res.jsonp/render/download/json`) and v5-safe. If adding routes, avoid bare `*` and regex strings. |
| `yargs` | **18** | `common.js` | ESM-first. `import yargs from "yargs"` + `import { hideBin } from "yargs/helpers"`. `.argv` still works. |
| `open` | **11** | `server.js` | ESM-only; `import open from "open"`. Opens the browser to the UI on server start. |
| `lodash` | 4 | many | CJS; default import works (`import _ from "lodash"`). |
| `compromise` | 14 | `web/backend/indexImages.js` | NLP tokenization for the keyword index. Default import. |
| `crc` | 4 | `helpers/makeApng.js` | `import crc from "crc"; crc.crc32(...)`. |
| `cli-progress` | 3 | `src/genImg.js`, `indexImages.js` | Default import; `new cliProgress.SingleBar/MultiBar(...)`. |
| `pug` | 3 | `server.js` (view engine) | Templates in `web/views/`. |

### Removed

- **`node-fetch`** — replaced by Node's global `fetch` (Node 18+). Removed in 2.0.0. Do not re-add.

## Dev dependencies

| Package | Major | Purpose |
|---------|-------|---------|
| `eslint` | 9 | Linting (flat config in `eslint.config.js`). |
| `@eslint/js` | 9 | ESLint recommended ruleset. |
| `globals` | 16 | Node + browser global sets for the flat config. |
| `prettier` | 3 | Formatting (`.prettierrc.json`). |
| `eslint-config-prettier` | 10 | Turns off ESLint rules that conflict with Prettier. |

## Bumping deps

- Update `package.json`, run `npm install`, then **re-run the verification** in
  [`../plans/testing.md`](../plans/testing.md) (`node --check`, `npm run lint`, the import smoke test).
- For a dep with a breaking major, read its migration notes and grep for its usage first
  (`server.js`, `genImg.js`, `imageUpscaler.js`, `indexImages.js`, `common.js`, `makeApng.js` are the
  files that touch third-party APIs).
- Record the change here and in the changelog.
