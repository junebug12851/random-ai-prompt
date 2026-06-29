/**
 * Local Stable Diffusion WebUI — generate adapter. POSTs the SD `txt2img` contract to the
 * user's WebUI (A1111 / Forge / SD.Next) and maps the base64 results to data URLs the browser
 * can display directly.
 *
 * Modernized 2026-06-29 (the original adapter was stale): current A1111/Forge/SD.Next use
 * **`sampler_name`** (the old `sampler_index` is deprecated and silently ignored — it was why the
 * sampler/seed appeared not to apply), plus a separate **`scheduler`** field ("Automatic" lets the
 * server pick, avoiding the sampler+scheduler "autocorrection" bug). `batch_size` is sent so the
 * per-run count applies. Verify against your live WebUI — the SD API still drifts.
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
      sampler_name: settings.sampler, // current field (replaces the deprecated `sampler_index`)
      scheduler: settings.scheduler || "Automatic",
      batch_size: Math.max(1, Number(settings.batchSize) || 1),
      seed: settings.seed ?? -1,
      send_images: true,
      save_images: false,
    },
    signal,
  );
  return { images: (data.images || []).map((b64) => `data:image/png;base64,${b64}`) };
}
