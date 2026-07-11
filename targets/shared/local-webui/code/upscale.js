/**
 * Local Stable Diffusion WebUI — AI-upscale adapter (shared by Forge + SD.Next). Uses the A1111
 * "Extras" single-image endpoint (`/sdapi/v1/extra-single-image`) to run an upscaler (default
 * `R-ESRGAN 4x+`). Local-direct: the JSON call is forwarded through the dev proxy (CORS), the source
 * image is read to base64 in the browser, and the base64 result becomes a data URL. No key.
 *
 * The Extras endpoint is independent of the (modernized) txt2img contract — it just needs the image
 * bytes + an upscaler name. Best-effort; verify the upscaler name exists on your WebUI.
 * @module gui/providers/local-webui/code/upscale
 */
import { postJson, normalizeBase } from "../../_shared/transport/localDirect.js";

/** Fetch an image URL and base64-encode its bytes (browser-side). */
async function toBase64(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Couldn't read the source image (${res.status}).`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/**
 * @param {object} args
 * @param {string} args.image The source image URL (served `/api/output/...` path or `data:` URL).
 * @param {object} args.settings Merged app settings (`localWebuiUrl`, optional `upscaler`/`upscaleFactor`).
 * @param {AbortSignal} [args.signal] Optional abort signal.
 * @returns {Promise<{images: string[]}>} The upscaled image as a base64 `data:` URL.
 * @throws {Error} When the source can't be read or the WebUI returns no image.
 */
export default async function upscale({ image, settings = {}, signal }) {
  const base = normalizeBase(settings.localWebuiUrl, "http://127.0.0.1:7860");
  const b64 =
    typeof image === "string" && image.startsWith("data:")
      ? image.split(",")[1]
      : await toBase64(image);

  const data = await postJson(
    `${base}/sdapi/v1/extra-single-image`,
    {
      image: b64,
      upscaling_resize: settings.upscaleFactor || 4,
      upscaler_1: settings.upscaler || "R-ESRGAN 4x+",
    },
    signal,
  );
  if (!data?.image) throw new Error("The WebUI returned no upscaled image.");
  return { images: [`data:image/png;base64,${data.image}`] };
}
