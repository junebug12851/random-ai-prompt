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
 * @param {Object<string,object>} [data.dynamicPrompts] name -> module ({ default, full? }).
 * @param {Object<string,string>} [data.dpl] name -> raw .dpl source (compiled on demand).
 * @returns {object} A loader usable with createEngine().
 */
export function makeFakeLoader(data = {}) {
  const lists = data.lists || {};
  const dynamicPrompts = data.dynamicPrompts || {};
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
    loadDynamicPrompt(key) {
      if (key in dynamicPrompts) return dynamicPrompts[key];
      if (key in dpl) return compileDpl(dpl[key], { resolveJs: () => "" });
      return null;
    },
    dynamicPromptNames() {
      return [...new Set([...Object.keys(dynamicPrompts), ...Object.keys(dpl)])];
    },
  };
}
