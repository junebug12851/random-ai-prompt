/**
 * @file Provider-capability gating — the ONE source of truth for "can this control actually do its job
 * right now?". Mirrors the web's gating model (`SingleView.jsx`, `Home.jsx`): a control whose provider
 * isn't picked, or can't perform the role, is **LOCKED (disabled + 🔒)** — it is NOT left enabled to pop a
 * "pick a provider" error on press. Errors-on-press are a parity bug; locking is the web behaviour.
 *
 * Roles (each has its own picker in the ⋯ menu, each defaults to off):
 *   - image   (`provider`)        — "plain"/copy tiers emit prompts only and CANNOT render.
 *   - text    (`rewriteProvider`) — "none" = off. Gates auto-fix/keyword, Manage Refine/Modify/Draft/AI-Expand.
 *   - upscale (`upscaleProvider`) — "none" = off. Gates the Single view's AI Upscale.
 */
import { getImageProvider, getTextProvider, getUpscaleProvider } from "./imageProviders.js";

/**
 * Can the selected IMAGE provider actually render an image? (copy/syntax/plain tiers cannot.)
 * @param {string} providerId
 * @returns {boolean}
 */
export function canGenerateImages(providerId) {
  const p = getImageProvider(providerId);
  return !!p && !p.copy && typeof p.generate === "function";
}

/**
 * Is a TEXT (rewrite) provider selected and usable? `"none"`/unset = off.
 * @param {string} rewriteProviderId
 * @returns {boolean}
 */
export function canRewrite(rewriteProviderId) {
  if (!rewriteProviderId || rewriteProviderId === "none") return false;
  return !!getTextProvider(rewriteProviderId);
}

/**
 * Is an UPSCALE provider selected and usable? `"none"`/unset = off.
 * @param {string} upscaleProviderId
 * @returns {boolean}
 */
export function canUpscale(upscaleProviderId) {
  if (!upscaleProviderId || upscaleProviderId === "none") return false;
  return !!getUpscaleProvider(upscaleProviderId);
}

/**
 * The upscalers offered in the Single view — the web offers only what can actually run (its
 * `providers.filter(p => p.capabilities?.upscale && p.loadUpscale)`), NOT the whole static registry.
 * On mobile the user picks ONE upscaler, so this is `[]` (locked) or that one.
 * @param {string} upscaleProviderId
 * @returns {Array<{id: string, label: string}>}
 */
export function upscalersFor(upscaleProviderId) {
  if (!canUpscale(upscaleProviderId)) return [];
  const up = getUpscaleProvider(upscaleProviderId);
  return [{ id: up.id, label: up.label }];
}
