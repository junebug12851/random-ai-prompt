/**
 * @file React hooks for provider READINESS — "is this control usable right now?".
 *
 * Mirrors the web's gating: a control is usable only when its provider is **picked** AND (if the provider
 * needs one) a **key** is present. The web offers a key-gated provider but leaves it **disabled until
 * keyed**; we do the same. Anything not ready renders **LOCKED (🔒)** — never enabled-then-error-on-press.
 *
 * Kept out of `capabilities.js` on purpose: that module is pure + Node-importable (the parity check loads
 * it), while these hooks pull in React and the async secure-store key lookup.
 */
import { useEffect, useState } from "react";
import { canRewrite, canUpscale, canGenerateImages } from "./capabilities.js";
import { getTextProvider, getImageProvider, getUpscaleProvider } from "./imageProviders.js";
import { getKey } from "./keys.js";

// Local providers (ComfyUI / Forge / SD.Next) hit the user's own server and need no key.
function useKeyed(providerId, picked, resolve) {
  const [keyed, setKeyed] = useState(false);
  useEffect(() => {
    let alive = true;
    if (!picked) {
      setKeyed(false);
      return undefined;
    }
    const p = resolve(providerId);
    if (p?.local) {
      setKeyed(true);
      return undefined;
    }
    getKey(providerId)
      .then((k) => alive && setKeyed(!!k))
      .catch(() => alive && setKeyed(false));
    return () => {
      alive = false;
    };
  }, [providerId, picked, resolve]);
  return keyed;
}

/**
 * Readiness of the TEXT (rewrite) provider — gates auto-fix/keyword, Manage Refine/Modify/Draft/AI-Expand.
 * @param {string} rewriteProvider
 * @returns {{picked: boolean, keyed: boolean, ready: boolean, reason: string}}
 */
export function useTextReady(rewriteProvider) {
  const picked = canRewrite(rewriteProvider);
  const keyed = useKeyed(rewriteProvider, picked, getTextProvider);
  return {
    picked,
    keyed,
    ready: picked && keyed,
    reason: !picked ? "Pick a Text provider in the ⋯ menu to unlock." : keyed ? "" : "Add your API key in the ⋯ menu to unlock.",
  };
}

/**
 * Readiness of the IMAGE provider — gates generate / re-roll / make-variation.
 * @param {string} provider
 * @returns {{picked: boolean, keyed: boolean, ready: boolean, reason: string}}
 */
export function useImageReady(provider) {
  const picked = canGenerateImages(provider);
  const keyed = useKeyed(provider, picked, getImageProvider);
  return {
    picked,
    keyed,
    ready: picked && keyed,
    reason: !picked ? "Pick an Image provider in the ⋯ menu to unlock." : keyed ? "" : "Add your API key in the ⋯ menu to unlock.",
  };
}

/**
 * Readiness of the UPSCALE provider — gates the Single view's AI Upscale.
 * @param {string} upscaleProvider
 * @returns {{picked: boolean, keyed: boolean, ready: boolean, reason: string}}
 */
export function useUpscaleReady(upscaleProvider) {
  const picked = canUpscale(upscaleProvider);
  const keyed = useKeyed(upscaleProvider, picked, getUpscaleProvider);
  return {
    picked,
    keyed,
    ready: picked && keyed,
    reason: !picked ? "Pick an Upscale provider in the ⋯ menu to unlock." : keyed ? "" : "Add your API key in the ⋯ menu to unlock.",
  };
}
