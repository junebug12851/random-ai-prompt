/*
    Copyright 2026 1fairyfox

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
*/

/**
 * @file
 * @brief List metadata + virtual (composite) lists — the public barrel. The implementation is split
 * across three focused, browser-safe modules (no Node-only imports), re-exported here so the rest of
 * the app keeps importing everything from `listManifest.js`:
 *   - `listTags.js`    — per-list metadata (category + anime/nsfw flags), pure data.
 *   - `nameOrder.js`   — variant suffixes, the reserved `keyword` wildcard, the natural-order
 *                        comparator, physical→logical names, suffix-path resolution, display tokens.
 *   - `listResolve.js` — `{name}` → lines (SFW/NSFW model, composite `.group` unions, implied groups).
 *
 * See data/lists/README.md for the composite-list / SFW-NSFW naming model.
 */

export { listTags } from "./listTags.js";
export {
  SFW_SUFFIX,
  NSFW_SUFFIX,
  RESERVED_WILDCARD,
  isReservedWildcard,
  compareNames,
  allListNames,
  hasVariantSuffix,
  logicalListNames,
  resolveName,
  computeButtonNames,
} from "./nameOrder.js";
export { MAX_GROUP_DEPTH, autoGroupListDirs, resolveListLines } from "./listResolve.js";
