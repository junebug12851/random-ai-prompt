/**
 * Shared tooltip text for provider controls, keyed by field `key`. Keeps the help copy in one
 * place (most keys are shared across providers). A field can override with its own `info`.
 * @module gui/providers/_shared/fieldInfo
 */
export const FIELD_INFO = {
  localWebuiUrl:
    "Address of your local Stable Diffusion WebUI (started with --api). Default http://127.0.0.1:7860.",
  comfyUrl: "Address of your local ComfyUI server. Default http://127.0.0.1:8188.",
  comfyCheckpoint:
    "The checkpoint (model) file ComfyUI loads. Leave blank to auto-pick the first one installed.",
  sampler: "The sampling algorithm. Different samplers trade speed for quality/character.",
  scheduler:
    "Controls how noise is removed across steps (ComfyUI). 'normal' or 'karras' are common.",
  imageSteps: "How many denoising steps. More = more detail/time; ~20–30 is usually plenty.",
  cfg: "Prompt adherence (CFG scale). Higher sticks closer to the prompt; too high looks fried. ~7 is a good start.",
  imageWidth: "Output width in pixels. SD 1.5 likes ~512; SDXL ~1024.",
  imageHeight: "Output height in pixels. SD 1.5 likes ~512; SDXL ~1024.",
  batchSize: "How many images to make per run.",
  seed: "Randomness seed. -1 picks a new random seed each run; a fixed number reproduces a result.",
  negativePrompt:
    "What to push AWAY from. Supports DPL — it's rolled out like the main prompt before sending.",
  model: "Which model to generate with.",
  size: "Output image size.",
  // Midjourney parameters
  ar: "Aspect ratio, e.g. 16:9 (--ar).",
  stylize: "How strongly Midjourney applies its house aesthetic (--stylize, 0–1000).",
  chaos: "Variety between the 4 results (--chaos, 0–100).",
  weird: "Pushes toward unusual, offbeat aesthetics (--weird, 0–3000).",
  quality: "Render quality/time (--quality).",
  version: "Midjourney model version (--v). Mutually exclusive with Niji.",
  niji: "Niji (anime) model (--niji). Overrides the version when set.",
  tile: "Make a seamless, tileable pattern (--tile).",
  no: "Things to exclude (--no), comma-separated.",
  iw: "Image-prompt weight (--iw, 0–3).",
  sref: "Style reference image URL or style seed (--sref).",
  cref: "Character reference image URL (--cref).",
};

/**
 * @param {object} f A field descriptor.
 * @returns {string|undefined} The tooltip text for a field (its own `info`, else the shared one).
 */
export function infoFor(f) {
  return f.info || FIELD_INFO[f.key];
}
