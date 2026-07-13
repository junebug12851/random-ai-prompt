/**
 * @file Wires the on-device Manage overlay (custom lists + block generators) into the engine's
 * metroLoader at runtime, so `{name}` / `{#name}` in a prompt draw from the user's own content — the
 * mobile counterpart of the web runtime overlay. `refreshOverlay()` reads every user list + block (nested
 * folders included) from storage and pushes them into the loader via `setMetroOverlay`; call it at app
 * start and after any Manage save/delete. User content wins over a built-in of the same name.
 */
import { setMetroOverlay } from "engine/core/metroLoader.js";
import { readUserTree, readUserList, readUserBlock, readUserSidecar } from "./storage.js";

// Flatten a readUserTree node into its entry keys (nested included).
function flattenKeys(node, out = []) {
  for (const e of node.entries) out.push(e.key);
  for (const f of node.folders) flattenKeys(f, out);
  return out;
}

/**
 * Read the whole user overlay from storage and install it into the loader. Safe to call repeatedly.
 * @returns {Promise<{lists:number, blocks:number}>} counts installed (handy for tests/status).
 */
export async function refreshOverlay() {
  const [listTree, blockTree] = await Promise.all([readUserTree("lists"), readUserTree("blocks")]);
  const lists = {};
  const listMeta = {};
  const blocks = {};
  const blockMeta = {};

  for (const key of flattenKeys(listTree)) {
    lists[key] = await readUserList(key);
    const m = await readUserSidecar("lists", key);
    if (m && Object.keys(m).length) listMeta[key] = m;
  }
  for (const key of flattenKeys(blockTree)) {
    blocks[key] = await readUserBlock(key);
    const m = await readUserSidecar("blocks", key);
    if (m && Object.keys(m).length) blockMeta[key] = m;
  }

  setMetroOverlay({ lists, listMeta, blocks, blockMeta });
  return { lists: Object.keys(lists).length, blocks: Object.keys(blocks).length };
}
