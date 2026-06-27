/**
 * React hooks for the provider system: lazy-load a provider's owned settings schema
 * (`{ defaults, fields, data? }`) and resolve its option-data (sampler/model/size lists), and
 * merge the active provider's namespaced params for generation.
 * @module gui/lib/useProvider
 */
import { useEffect, useState } from "react";
import { getProvider, engineModeFor } from "./providers/index.js";

/**
 * Lazy-load a provider's settings schema and resolve its option-data lists.
 * @param {string} providerId The active provider id.
 * @returns {{ schema: object|null, options: Record<string, *>, ready: boolean }}
 */
export function useProviderSettings(providerId) {
  const [state, setState] = useState({ schema: null, options: {}, ready: false });

  useEffect(() => {
    let alive = true;
    const p = getProvider(providerId);
    if (!p || !p.loadSettings) {
      setState({ schema: null, options: {}, ready: true });
      return undefined;
    }
    p.loadSettings()
      .then(async (schema) => {
        const options = {};
        if (schema && schema.data) {
          await Promise.all(
            Object.entries(schema.data).map(async ([k, fn]) => {
              try {
                options[k] = await fn();
              } catch {
                options[k] = [];
              }
            }),
          );
        }
        if (alive) setState({ schema, options, ready: true });
      })
      .catch(() => alive && setState({ schema: null, options: {}, ready: true }));
    return () => {
      alive = false;
    };
  }, [providerId]);

  return state;
}

/**
 * The engine `mode` for a provider (its dialect), used so prompt generation runs in the
 * right syntax for the selected provider.
 * @param {string} providerId The provider id.
 * @returns {string} The engine mode.
 */
export function providerMode(providerId) {
  const p = getProvider(providerId);
  return engineModeFor(p ? p.dialect : "plain");
}

/**
 * Merge the active provider's namespaced params + dialect mode into a flat settings object
 * the engine and the provider adapters can read directly.
 * @param {object} settings The app settings (with `providerParams[id]`).
 * @param {object} [schemaDefaults] The provider's schema defaults (filled under saved params).
 * @returns {object} The flattened settings for this provider.
 */
export function flattenForProvider(settings, schemaDefaults = {}) {
  const id = settings.provider;
  const params = settings.providerParams?.[id] || {};
  return { ...settings, ...schemaDefaults, ...params, mode: providerMode(id) };
}
