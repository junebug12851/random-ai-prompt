/**
 * DeepAI — client AI-upscale adapter. DeepAI is upscale-only and we route it through the proxy
 * (`/api/upscale`), so the browser just hands off the served image path; the server inlines it and
 * calls DeepAI's super-resolution endpoint.
 * @module gui/providers/deepai/code/upscale
 */
import { callUpscaleProxy } from "../../_shared/transport/hostedProxy.js";

/**
 * @param {object} args `{ image, key, signal }` — `image` is an absolute/served output URL.
 * @returns {Promise<{images: string[]}>}
 */
export default function upscale({ image, key, signal }) {
  const served =
    typeof image === "string" && image.startsWith("data:")
      ? image
      : String(image).replace(/^https?:\/\/[^/]+/, "");
  return callUpscaleProxy({ providerId: "deepai", image: served, key, signal });
}
