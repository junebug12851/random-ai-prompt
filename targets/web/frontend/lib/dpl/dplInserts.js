/**
 * The DPL insert toolbar's catalog, **localized**.
 *
 * The catalog itself — which constructs exist, their DPL `syntax`, the editor `template`, the live
 * `example` — is the engine's, and lives in `engine/dplInsertCatalog.js`: it describes the grammar the
 * DPL compiler implements, not anything about this app. This module is the **label layer**: it takes
 * the shared grammar and hangs react-intl strings off it. (Until 2.60.0 the whole catalog lived here
 * and the mobile app hand-ported all 262 lines of it, guarded by a drift check. See
 * `notes/plans/de-duplication.md`.)
 *
 * Message keys are derived from the catalog ids (`one-of-nothing` → `oneOfNothingLabel` /
 * `oneOfNothingDesc`, category `flow` → `flowLabel` / `flowHint`), so a construct added to the engine
 * grammar without a matching message fails the coverage test rather than rendering `undefined`.
 *
 * Template conventions (`${1:foo}` tab stops, `${sel}` selection, `line` / `wrap` / `example`) are
 * documented on the engine catalog.
 * @module gui/lib/dpl/dplInserts
 */
import { buildInsertMenu, camelId } from "../../../../../engine/dplInsertCatalog.js";
import { m } from "./dplInsertsMessages.js";

/**
 * Build the localized DPL insert catalog.
 * @param {import("react-intl").IntlShape} intl The react-intl instance (from `useIntl()`).
 * @returns {Array<object>} The engine's categories with translated `label`/`hint`/`desc`.
 */
export function getDplInserts(intl) {
  const t = (d, values) => intl.formatMessage(d, values);
  return buildInsertMenu({
    category: (c) => ({
      label: t(m[`${camelId(c.key)}Label`]),
      hint: t(m[`${camelId(c.key)}Hint`]),
    }),
    item: (it) => ({
      label: t(m[`${camelId(it.id)}Label`]),
      desc: t(m[`${camelId(it.id)}Desc`], it.descValues),
    }),
  });
}

export default getDplInserts;
