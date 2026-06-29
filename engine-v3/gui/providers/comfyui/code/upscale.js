/**
 * ComfyUI — client AI-upscale adapter. ComfyUI upscaling needs a multipart image upload + a graph
 * run, which can't go through the JSON forward proxy, so it routes through `/api/upscale` (the
 * server-side adapter does the upload + graph). The ComfyUI URL + upscale-model name travel as params.
 * @module gui/providers/comfyui/code/upscale
 */
import { callUpscaleProxy } from "../../_shared/transport/hostedProxy.js";

/**
 * @param {object} args `{ image, settings, signal }`.
 * @returns {Promise<{images: string[]}>}
 */
export default function upscale({ image, settings = {}, signal }) {
  const served =
    typeof image === "string" && image.startsWith("data:")
      ? image
      : String(image).replace(/^https?:\/\/[^/]+/, "");
  return callUpscaleProxy({
    providerId: "comfyui",
    image: served,
    signal,
    params: { base: settings.comfyUrl, model: settings.comfyUpscaleModel },
  });
}
