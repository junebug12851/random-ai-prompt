/**
 * @file
 * @brief Engine bootstrap for the CLI — a thin re-export of the shared **Node** engine boot
 * (`engine/nodeEngine.js`). The CLI, the local backend's `/api/prompt` route, and the smoke test all
 * boot the one engine the same way, so there's no re-ported bootstrap. `boot` is the shared
 * `bootNodeEngine`; the catalog helpers (`blockNames` / `listNames` / `blockTokens` / `pickerLists`) and
 * `engineDefaults` come straight through for the CLI's `list` / `config` / completion commands.
 */
export {
  bootNodeEngine as boot,
  setActiveSettings,
  engineDefaults,
  blockNames,
  listNames,
  blockTokens,
  pickerLists,
  nodeLoader,
} from "../../../../engine/nodeEngine.js";
