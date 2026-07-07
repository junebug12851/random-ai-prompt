/**
 * @file
 * @brief Engine bootstrap for the CLI. Wires the framework-agnostic prompt engine to the Node fs
 * loader (the same path the smoke test and the SPA's Node-side loader use) and exposes prompt
 * generation plus catalog introspection (block / list names). One shared engine — no duplicated
 * prompt logic.
 */
import { createEngine } from "../../../../engine/core/engine.js";
import { nodeLoader } from "../../../../engine/core/nodeLoader.js";
import promptFiles from "../../../../engine/promptFilesAndSuggestions.js";
import baseSettings from "../../../../engine/settings.js";

let engine = null;
let booted = false;
let active = null; // the settings the current command is generating with (for NSFW gating/cleanup)

/**
 * Set the settings the suggestion builder / cleanup should read for gating (notably `includeAdult`).
 * Call before generating so NSFW gating honors the run's settings.
 * @param {object} settings The effective settings.
 * @returns {void}
 */
export function setActiveSettings(settings) {
  active = settings;
}

/**
 * Boot the engine + suggestion catalog once. Idempotent. The suggestion builder reads the live
 * settings (for NSFW gating) via {@link setActiveSettings}.
 * @returns {{expand: Function, generate: Function, generateWithSeed: Function, generateMany: Function}}
 */
export function boot() {
  if (!booted) {
    promptFiles.configure(nodeLoader);
    promptFiles.init(() => ({
      settings: active || baseSettings,
      imageSettings: {},
      upscaleSettings: {},
    }));
    promptFiles.loadAll();
    engine = createEngine(nodeLoader);
    booted = true;
  }
  return engine;
}

/** @returns {object} The engine's default settings (engine/settings.js). */
export const engineDefaults = () => baseSettings;

/** @returns {string[]} Every block generator name (natural sort). */
export function blockNames() {
  boot();
  return nodeLoader.blockNames();
}

/** @returns {string[]} Every list name (logical names + implied groups). */
export function listNames() {
  boot();
  return nodeLoader.listNames();
}

/**
 * The block generator names to suggest/complete, honoring adult gating via the suggestion builder's
 * classification (user-submitted + excluded generators are kept out of the random pool but still
 * shown here for reference).
 * @returns {string[]} Block token names.
 */
export function blockTokens() {
  boot();
  return promptFiles.loadBlockList().all;
}

/**
 * The picker-facing list names (honoring the current adult flag).
 * @returns {string[]} List names for the `{name}` reference.
 */
export function pickerLists() {
  boot();
  return promptFiles.pickerListNames();
}

export { nodeLoader };
