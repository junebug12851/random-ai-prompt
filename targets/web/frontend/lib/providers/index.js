/**
 * Back-compat shim. The image-provider registry moved to `gui/providers/` (a self-contained
 * folder per provider: config + settings + presets + code + data, auto-discovered). This
 * keeps the old import path (`lib/providers`) working for existing consumers.
 * @module gui/lib/providers
 */
export {
  providers,
  availableProviders,
  getProvider,
  rewriteProviders,
  ONLINE,
  DIALECTS,
  engineModeFor,
} from "../../../shared/index.js";
