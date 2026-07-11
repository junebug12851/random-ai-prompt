/**
 * Replicate — client AI-upscale adapter. Replicate isn't CORS-callable from a browser, so (like its
 * generate adapter) this goes through our proxy: it POSTs the served image path to `/api/upscale`,
 * where the upscale-server adapter runs Real-ESRGAN and the result comes back as a `data:` URL.
 * @module gui/providers/replicate/code/upscale
 */
import { callUpscaleProxy } from "../../_shared/transport/hostedProxy.js";

/**
 * @param {object} args `{ image, key, signal }` — `image` is an absolute/served output URL.
 * @returns {Promise<{images: string[]}>}
 */
export default function upscale({ image, key, signal }) {
  // The proxy resolves the local file by its served `/api/output/...` path; strip any origin.
  const served =
    typeof image === "string" && image.startsWith("data:")
      ? image
      : String(image).replace(/^https?:\/\/[^/]+/, "");
  return callUpscaleProxy({
    providerId: "replicate",
    image: served,
    key,
    signal,
    params: { scale: 4 },
  });
}
