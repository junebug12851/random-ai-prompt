/**
 * Local Stable Diffusion WebUI — generate adapter. POSTs the SD `txt2img` contract to the
 * user's WebUI and maps the base64 results to data URLs the browser can display directly.
 * @module gui/providers/local-webui/code/generate
 */
import { postJson, normalizeBase } from "../../_shared/transport/localDirect.js";

/**
 * @param {object} args
 * @param {string} args.prompt The expanded prompt.
 * @param {object} args.settings The merged settings (image params).
 * @param {AbortSignal} [args.signal] Optional abort signal.
 * @returns {Promise<{images: string[]}>}
 */
export default async function generate({ prompt, settings, signal }) {
  const base = normalizeBase(settings.localWebuiUrl, "http://127.0.0.1:7860");
  const data = await postJson(
    `${base}/sdapi/v1/txt2img`,
    {
      prompt,
      negative_prompt: settings.negativePrompt || "",
      steps: settings.imageSteps,
      cfg_scale: settings.cfg,
      width: settings.imageWidth,
      height: settings.imageHeight,
      sampler_index: settings.sampler,
      seed: settings.seed ?? -1,
    },
    signal,
  );
  return { images: (data.images || []).map((b64) => `data:image/png;base64,${b64}`) };
}
