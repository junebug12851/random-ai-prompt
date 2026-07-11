/**
 * ComfyUI — generate adapter. Patches the default workflow graph with the prompt + params,
 * submits it to `/prompt`, polls `/history/{id}`, and returns `/view` image URLs.
 * @module gui/providers/comfyui/code/generate
 */
import { postJson, getJson, normalizeBase } from "../../_shared/transport/localDirect.js";
import workflow from "../data/default-workflow.json";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @param {object} args
 * @param {string} args.prompt The expanded prompt.
 * @param {object} args.settings The merged settings.
 * @param {AbortSignal} [args.signal] Optional abort signal.
 * @returns {Promise<{images: string[]}>}
 */
export default async function generate({ prompt, settings, signal }) {
  const base = normalizeBase(settings.comfyUrl, "http://127.0.0.1:8188");

  // Clone the template and inject the prompt + params into the known node ids.
  const g = JSON.parse(JSON.stringify(workflow));
  g["6"].inputs.text = prompt;
  g["7"].inputs.text = settings.negativePrompt || "";
  g["5"].inputs.width = settings.imageWidth ?? 512;
  g["5"].inputs.height = settings.imageHeight ?? 512;
  g["5"].inputs.batch_size = settings.batchSize ?? 1;
  g["3"].inputs.seed =
    settings.seed != null && settings.seed >= 0 ? settings.seed : Math.floor(Math.random() * 1e15);
  g["3"].inputs.steps = settings.imageSteps ?? 20;
  g["3"].inputs.cfg = settings.cfg ?? 7;
  g["3"].inputs.sampler_name = settings.sampler || "euler";
  g["3"].inputs.scheduler = settings.scheduler || "normal";

  // Resolve checkpoint + sampler + scheduler against what THIS ComfyUI actually accepts, so a
  // missing/blank/stale or SD-style value (e.g. "Euler" vs ComfyUI's "euler") self-heals instead
  // of failing validation.
  const pick = (list, value, fallback) => {
    if (!list || !list.length) return value || fallback;
    if (list.includes(value)) return value;
    const ci = list.find((x) => String(x).toLowerCase() === String(value || "").toLowerCase());
    if (ci) return ci;
    return list.includes(fallback) ? fallback : list[0];
  };
  let ckpt = settings.comfyCheckpoint;
  try {
    const [ckptInfo, ksInfo] = await Promise.all([
      getJson(`${base}/object_info/CheckpointLoaderSimple`, signal),
      getJson(`${base}/object_info/KSampler`, signal),
    ]);
    const ckptList = ckptInfo?.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0] || [];
    const samplerList = ksInfo?.KSampler?.input?.required?.sampler_name?.[0] || [];
    const schedList = ksInfo?.KSampler?.input?.required?.scheduler?.[0] || [];
    if (!ckpt || !ckptList.includes(ckpt)) ckpt = ckptList[0];
    if (!ckpt) {
      throw new Error(
        "ComfyUI has no checkpoint models installed — add one to ComfyUI/models/checkpoints.",
      );
    }
    g["3"].inputs.sampler_name = pick(samplerList, settings.sampler, "euler");
    g["3"].inputs.scheduler = pick(schedList, settings.scheduler, "normal");
  } catch (e) {
    if (!ckpt) throw e; // only fatal if there's also no configured fallback to try
  }
  g["4"].inputs.ckpt_name = ckpt;

  const clientId =
    (typeof crypto !== "undefined" && crypto.randomUUID && crypto.randomUUID()) ||
    String(Math.random()).slice(2);

  const submitted = await postJson(`${base}/prompt`, { prompt: g, client_id: clientId }, signal);
  const promptId = submitted.prompt_id;
  if (!promptId) throw new Error("ComfyUI did not return a prompt id.");

  const deadline = Date.now() + 180000;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const hist = await getJson(`${base}/history/${promptId}`, signal).catch(() => ({}));
    const entry = hist?.[promptId];
    if (entry?.outputs) {
      const images = [];
      for (const node of Object.values(entry.outputs)) {
        for (const im of node.images || []) {
          const q = new URLSearchParams({
            filename: im.filename,
            subfolder: im.subfolder || "",
            type: im.type || "output",
          });
          images.push(`${base}/view?${q.toString()}`);
        }
      }
      if (images.length) return { images };
    }
    if (Date.now() > deadline) throw new Error("ComfyUI generation timed out.");
    await sleep(1200);
  }
}
