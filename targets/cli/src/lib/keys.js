/**
 * @file
 * @brief BYOK API-key storage for the CLI. Keys are stored in the CLI's own config namespace
 * (`user/settings/cli.json` → `keys` map) and are ALSO read from the GUI's `settings.json` `keys`
 * map, so a key saved in the desktop/web app works in the CLI and vice-versa (GUI parity). A key can
 * additionally come from an env var (`RAP_KEY_<PROVIDERID>`) for CI / one-off use without persisting.
 */
import * as store from "./store.js";
import { CLI_NS, GUI_NS } from "./settings.js";

/**
 * The effective key for a provider: env var → CLI store → GUI store. Env wins so a shell can inject a
 * key for one run without writing it to disk.
 * @param {string} id Provider id.
 * @returns {string} The key, or "".
 */
export function getKey(id) {
  const env =
    process.env[
      `RAP_KEY_${String(id)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "_")}`
    ];
  if (env) return env;
  const cli = store.read(CLI_NS) || {};
  if (cli.keys && cli.keys[id]) return cli.keys[id];
  const gui = store.read(GUI_NS) || {};
  if (gui.keys && gui.keys[id]) return gui.keys[id];
  return "";
}

/**
 * Persist a provider key into the CLI store (and optionally the shared GUI store).
 * @param {string} id Provider id.
 * @param {string} value The key value.
 * @param {boolean} [shared=false] Also write into the GUI's `settings.keys` (read-modify-write).
 * @returns {boolean} True on success.
 */
export function setKey(id, value, shared = false) {
  const cli = store.read(CLI_NS) || {};
  cli.keys = { ...(cli.keys || {}), [id]: value };
  const ok = store.write(CLI_NS, cli);
  if (shared) {
    const gui = store.read(GUI_NS) || {};
    gui.keys = { ...(gui.keys || {}), [id]: value };
    store.write(GUI_NS, gui);
  }
  return ok;
}

/**
 * Remove a stored key from the CLI store (and optionally the shared GUI store).
 * @param {string} id Provider id.
 * @param {boolean} [shared=false] Also remove from the GUI store.
 * @returns {boolean} True on success.
 */
export function removeKey(id, shared = false) {
  const cli = store.read(CLI_NS) || {};
  if (cli.keys) delete cli.keys[id];
  const ok = store.write(CLI_NS, cli);
  if (shared) {
    const gui = store.read(GUI_NS) || {};
    if (gui.keys) {
      delete gui.keys[id];
      store.write(GUI_NS, gui);
    }
  }
  return ok;
}

/**
 * List which providers have a stored key, and where it lives (env / cli / gui). Values are masked.
 * @returns {Array<{id: string, source: string, masked: string}>}
 */
export function listKeys() {
  const cli = (store.read(CLI_NS) || {}).keys || {};
  const gui = (store.read(GUI_NS) || {}).keys || {};
  const ids = new Set([...Object.keys(cli), ...Object.keys(gui)]);
  // Env-provided keys too.
  for (const k of Object.keys(process.env)) {
    if (k.startsWith("RAP_KEY_")) ids.add(k.slice("RAP_KEY_".length).toLowerCase());
  }
  const out = [];
  for (const id of ids) {
    const val = getKey(id);
    if (!val) continue;
    let source = "gui";
    if (process.env[`RAP_KEY_${id.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`]) source = "env";
    else if (cli[id]) source = "cli";
    out.push({ id, source, masked: mask(val) });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Mask a secret for display (first 3 + last 2 chars, middle elided).
 * @param {string} v The secret.
 * @returns {string} The masked form.
 */
export function mask(v) {
  if (!v) return "";
  if (v.length <= 6) return "•".repeat(v.length);
  return `${v.slice(0, 3)}${"•".repeat(Math.max(3, v.length - 5))}${v.slice(-2)}`;
}
