/**
 * @file
 * An in-memory loader implementing the engine's loader interface, for hermetic
 * integration tests that don't touch the filesystem. Mirrors the contract that
 * `nodeLoader` / `browserLoader` implement (see src/core/engine.js).
 *
 * Construct one with plain data and hand it to `createEngine(loader)`.
 */
import compileDpl from "../../engine/core/dpl/dpl.js";

/**
 * Build a fake loader from in-memory data.
 * @param {object} [data]
 * @param {Object<string,string[]>} [data.lists] name -> lines.
 * @param {Object<string,object>} [data.blocks] name -> module ({ default, full? }).
 * @param {Object<string,string>} [data.dpl] name -> raw .dpl source (compiled on demand).
 * @returns {object} A loader usable with createEngine().
 */
export function makeFakeLoader(data = {}) {
  const lists = data.lists || {};
  const blocks = data.blocks || {};
  const dpl = data.dpl || {};

  return {
    readListLines(name) {
      return name in lists ? lists[name].slice() : null;
    },
    listNames() {
      return Object.keys(lists);
    },
    groupListDirs() {
      return [];
    },
    loadBlock(key) {
      if (key in blocks) return blocks[key];
      if (key in dpl) return compileDpl(dpl[key], { resolveJs: () => "" });
      return null;
    },
    blockNames() {
      return [...new Set([...Object.keys(blocks), ...Object.keys(dpl)])];
    },
  };
}
