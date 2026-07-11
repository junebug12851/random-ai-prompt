/**
 * UI metadata for the provider picker: a one-line description per provider and, for BYOK providers,
 * where to get an API key.
 *
 * This used to be a hand-kept table in the web target — which meant the mobile target kept its own
 * copy of the same facts, and a new provider folder could ship with no description on either. The
 * metadata now lives on each provider's **manifest** (`targets/shared/<id>/config.js` → `description`
 * / `keyUrl`), so it's declared once, next to the provider it describes, and every target reads it
 * from the shared registry. This module is just the web's lookup view over that.
 * @module gui/lib/providerMeta
 */
import { providers } from "./providers/index.js";

/**
 * Keyed by provider id — only providers that actually declare metadata appear (a provider with no
 * `description` on its manifest is simply absent, exactly as it was when this was a hand-kept table).
 * @type {Record<string, {description?: string, keyUrl?: string}>}
 */
export const PROVIDER_META = Object.fromEntries(
  providers
    .filter((p) => p.description || p.keyUrl)
    .map((p) => [
      p.id,
      {
        ...(p.description ? { description: p.description } : {}),
        ...(p.keyUrl ? { keyUrl: p.keyUrl } : {}),
      },
    ]),
);

/**
 * @param {string} id Provider id.
 * @returns {{ description?: string, keyUrl?: string }} The provider's UI metadata (empty if none).
 */
export const metaFor = (id) => PROVIDER_META[id] || {};
