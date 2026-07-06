/**
 * The **shared provider-settings** system: settings that every applicable provider gets, declared
 * once here instead of copied into all ~40 provider folders. Each shared setting is its own module
 * in this folder exporting a descriptor (see the {@link SharedSetting} typedef); they're
 * **auto-discovered** by globbing this folder — the same drop-a-file-in plugin pattern the providers
 * (`gui/providers/`) and blocks use. Add a file here and it applies to all providers; no
 * central edit.
 *
 * The registry (`gui/providers/index.js`) calls {@link applySharedSettings} to fold every applicable
 * shared field + default into a provider's `settings.js` schema, so the fields flow consistently to
 * both the gear UI (`ProviderBox`) and the flattened generation settings (`flattenForProvider`).
 * @module gui/providers/_shared/settings
 */

/**
 * @typedef {object} SharedSetting
 * @property {string} key The settings key (namespaced under `providerParams[providerId]`).
 * @property {(provider: object) => boolean} applies Whether this setting applies to a provider.
 * @property {(provider: object) => *} defaultFor The provider's default value for this setting.
 * @property {(provider: object) => object} field The schema field descriptor (rendered in the gear).
 */

// Auto-discover every shared-setting module in this folder (its default export is the descriptor),
// excluding this index. Eager so the list is synchronous, like the provider config glob.
const modules = import.meta.glob("./*.js", { eager: true });

/** @type {SharedSetting[]} All registered shared settings. */
export const SHARED_SETTINGS = Object.entries(modules)
  .filter(([path]) => !path.endsWith("/index.js"))
  .map(([, m]) => m.default)
  .filter((s) => s && typeof s.key === "string" && typeof s.applies === "function");

/**
 * Fold every applicable shared setting's field + default into a provider's settings schema. Idempotent
 * and non-destructive: a provider that already declares a field with the same key keeps its own (an
 * escape hatch for a provider that needs a bespoke version).
 * @param {object|null} schema The provider's `{ defaults, fields, data }` schema (or null/undefined).
 * @param {object} provider The provider manifest.
 * @returns {object} The schema with shared fields/defaults folded in.
 */
export function applySharedSettings(schema, provider) {
  let out = schema || { defaults: {}, fields: [] };
  for (const setting of SHARED_SETTINGS) {
    if (!setting.applies(provider)) continue;
    const fields = out.fields || [];
    if (fields.some((f) => f.key === setting.key)) continue; // provider declares its own — leave it
    out = {
      ...out,
      // The provider-declared default (if any) wins over the shared default.
      defaults: { [setting.key]: setting.defaultFor(provider), ...(out.defaults || {}) },
      fields: [...fields, setting.field(provider)],
    };
  }
  return out;
}
