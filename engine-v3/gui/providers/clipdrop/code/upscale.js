/**
 * Clipdrop — client AI-upscale adapter (proxy path; upscale-only enhancer).
 * @module gui/providers/clipdrop/code/upscale
 */
import { callUpscaleProxy } from "../../_shared/transport/hostedProxy.js";

/**
 * @param {object} args `{ image, key, signal }`.
 * @returns {Promise<{images: string[]}>}
 */
export default function upscale({ image, key, signal }) {
  const served =
    typeof image === "string" && image.startsWith("data:")
      ? image
      : String(image).replace(/^https?:\/\/[^/]+/, "");
  return callUpscaleProxy({ providerId: "clipdrop", image: served, key, signal });
}
