/**
 * Image providers usable on mobile with NO backend of our own.
 *
 * Two families, both ported from targets/web/shared/<id>:
 *   1. `browser-direct` BYOK — openai / fal / stability / gemini. Called directly with the user's
 *      key (all CORS-enabled), each ported from that provider's web `code/server.js`.
 *   2. `local-direct` (marked `local: true`) — comfyui / forge / sdnext. Talk to the user's OWN
 *      generation server over the LAN / a private cloud (a power user's rigged-up PC, or even the
 *      phone itself). The web routes these through a dev-server proxy to dodge CORS; a native app
 *      has no CORS, so we fetch the local server DIRECTLY — no backend needed. No key; instead a
 *      "Server URL" setting (defaulted to 192.168.1.1 as a visual hint that it usually points at a
 *      PC on the same Wi-Fi — but localhost / 127.0.0.1 are silently accepted for on-device rigs).
 *
 * `generate({ prompt, key, settings })` → `{ images: string[] }` where each image is a `data:` URL
 * or an `https:`/`http:` URL (storage.saveImageSrc handles all). Local adapters ignore `key`.
 * Hosted-proxy providers are omitted — they need our backend, which mobile does not have.
 */

// ---------------------------------------------------------------------------------------------
// Browser-direct BYOK adapters
// ---------------------------------------------------------------------------------------------

async function openai({ prompt, key, settings = {} }) {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: settings.model || "gpt-image-1",
      prompt,
      size: settings.size || "1024x1024",
      n: settings.n || 1,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `OpenAI returned ${res.status}`);
  const images = (data.data || [])
    .map((d) => (d.b64_json ? `data:image/png;base64,${d.b64_json}` : d.url))
    .filter(Boolean);
  if (!images.length) throw new Error("OpenAI returned no image.");
  return { images };
}

async function fal({ prompt, key, settings = {} }) {
  const model = settings.model || "fal-ai/flux/schnell";
  const res = await fetch(`https://fal.run/${model}`, {
    method: "POST",
    headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      num_images: settings.n || 1,
      image_size: settings.imageSize || "square_hd",
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.detail || data?.message || `fal returned ${res.status}`);
  const images = (data.images || [])
    .map((i) => (typeof i === "string" ? i : i?.url))
    .filter(Boolean);
  if (!images.length) throw new Error("fal returned no image.");
  return { images };
}

async function stability({ prompt, key, settings = {} }) {
  const endpoint = settings.model || "core"; // core | sd3 | ultra
  const fd = new FormData();
  fd.append("prompt", prompt);
  fd.append("output_format", "png");
  fd.append("aspect_ratio", settings.aspectRatio || "1:1");
  const res = await fetch(`https://api.stability.ai/v2beta/stable-image/generate/${endpoint}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
    body: fd,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error(
      (data?.errors && data.errors[0]) ||
        data?.message ||
        data?.name ||
        `Stability returned ${res.status}`,
    );
  const images = data.image ? [`data:image/png;base64,${data.image}`] : [];
  if (!images.length) throw new Error("Stability returned no image.");
  return { images };
}

async function gemini({ prompt, key, settings = {} }) {
  const model = settings.model || "gemini-2.5-flash-image";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ["IMAGE"] },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `Gemini returned ${res.status}`);
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const images = parts
    .filter((p) => p.inlineData?.data || p.inline_data?.data)
    .map((p) => {
      const d = p.inlineData || p.inline_data;
      return `data:${d.mimeType || d.mime_type || "image/png"};base64,${d.data}`;
    });
  if (!images.length) throw new Error("Gemini returned no image (try the other image model).");
  return { images };
}

// ---------------------------------------------------------------------------------------------
// local-direct transport — direct fetch to the user's own server (no proxy; native has no CORS).
// Ported from targets/web/shared/_shared/transport/localDirect.js (minus the /api/forward hop).
// ---------------------------------------------------------------------------------------------

/** Trim trailing slashes so `${base}/path` is always well-formed. */
function normalizeBase(url, fallback) {
  return (url || fallback).replace(/\/+$/, "");
}

/** Pull the human-readable message out of a local server's error body (ComfyUI nests it). */
function readableError(data, url, status) {
  let msg = data?.error;
  if (msg && typeof msg === "object") msg = msg.message || JSON.stringify(msg);
  const nodeErrors = data?.node_errors;
  if (nodeErrors && typeof nodeErrors === "object") {
    const details = Object.values(nodeErrors)
      .flatMap((n) => (n?.errors || []).map((e) => e.details || e.message))
      .filter(Boolean);
    if (details.length) msg = `${msg || "Validation failed"} — ${details.join("; ")}`;
  }
  return msg || `${url} returned ${status}`;
}

async function localPostJson(url, body, signal) {
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new Error(`Can't reach ${url} — check the Server URL and that the server is on this Wi-Fi.`);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(readableError(data, url, res.status));
  return data;
}

async function localGetJson(url, signal) {
  let res;
  try {
    res = await fetch(url, { method: "GET", signal });
  } catch (e) {
    throw new Error(`Can't reach ${url} — check the Server URL and that the server is on this Wi-Fi.`);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(readableError(data, url, res.status));
  return data;
}

const num = (v, d) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

// ---------------------------------------------------------------------------------------------
// local-direct adapters
// ---------------------------------------------------------------------------------------------

// A1111 / Forge / SD.Next share the `/sdapi/v1/txt2img` contract — one adapter, ported from
// targets/web/shared/local-webui/code/generate.js.
async function localWebui({ prompt, settings = {} }) {
  const base = normalizeBase(settings.localWebuiUrl, "http://127.0.0.1:7860");
  const data = await localPostJson(`${base}/sdapi/v1/txt2img`, {
    prompt,
    negative_prompt: settings.negativePrompt || "",
    steps: num(settings.imageSteps, 32),
    cfg_scale: num(settings.cfg, 11),
    width: num(settings.imageWidth, 512),
    height: num(settings.imageHeight, 512),
    sampler_name: settings.sampler, // current field (replaces the deprecated `sampler_index`)
    scheduler: settings.scheduler || "Automatic",
    batch_size: Math.max(1, num(settings.batchSize, 1)),
    seed: num(settings.seed, -1),
    send_images: true,
    save_images: false,
  });
  return { images: (data.images || []).map((b64) => `data:image/png;base64,${b64}`) };
}

// ComfyUI default text→image graph (targets/web/shared/comfyui/data/default-workflow.json).
const COMFY_WORKFLOW = {
  "3": {
    class_type: "KSampler",
    inputs: {
      seed: 0, steps: 20, cfg: 7, sampler_name: "euler", scheduler: "normal", denoise: 1,
      model: ["4", 0], positive: ["6", 0], negative: ["7", 0], latent_image: ["5", 0],
    },
  },
  "4": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: "model.safetensors" } },
  "5": { class_type: "EmptyLatentImage", inputs: { width: 512, height: 512, batch_size: 1 } },
  "6": { class_type: "CLIPTextEncode", inputs: { text: "", clip: ["4", 1] } },
  "7": { class_type: "CLIPTextEncode", inputs: { text: "", clip: ["4", 1] } },
  "8": { class_type: "VAEDecode", inputs: { samples: ["3", 0], vae: ["4", 2] } },
  "9": { class_type: "SaveImage", inputs: { filename_prefix: "rap", images: ["8", 0] } },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ComfyUI — ported from targets/web/shared/comfyui/code/generate.js: patch the graph, submit to
// /prompt, poll /history/{id}, read /view. Self-heals checkpoint/sampler/scheduler against what
// this server actually accepts.
async function comfyui({ prompt, settings = {} }) {
  const base = normalizeBase(settings.comfyUrl, "http://127.0.0.1:8188");

  const g = JSON.parse(JSON.stringify(COMFY_WORKFLOW));
  g["6"].inputs.text = prompt;
  g["7"].inputs.text = settings.negativePrompt || "";
  g["5"].inputs.width = num(settings.imageWidth, 512);
  g["5"].inputs.height = num(settings.imageHeight, 512);
  g["5"].inputs.batch_size = num(settings.batchSize, 1);
  const seed = num(settings.seed, -1);
  g["3"].inputs.seed = seed >= 0 ? seed : Math.floor(Math.random() * 1e15);
  g["3"].inputs.steps = num(settings.imageSteps, 20);
  g["3"].inputs.cfg = num(settings.cfg, 7);
  g["3"].inputs.sampler_name = settings.sampler || "euler";
  g["3"].inputs.scheduler = settings.scheduler || "normal";

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
      localGetJson(`${base}/object_info/CheckpointLoaderSimple`),
      localGetJson(`${base}/object_info/KSampler`),
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

  const submitted = await localPostJson(`${base}/prompt`, { prompt: g, client_id: clientId });
  const promptId = submitted.prompt_id;
  if (!promptId) throw new Error("ComfyUI did not return a prompt id.");

  const deadline = Date.now() + 180000;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const hist = await localGetJson(`${base}/history/${promptId}`).catch(() => ({}));
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

// Shared A1111 sampler list (targets/web/shared/local-webui/data/samplers.json).
const A1111_SAMPLERS = [
  "Euler", "Euler a", "Heun", "LMS", "DPM++ 2M", "DPM++ 2M Karras", "DPM++ SDE",
  "DPM++ SDE Karras", "DPM++ 3M SDE", "DDIM", "UniPC",
];
// ComfyUI sampler + scheduler lists (targets/web/shared/comfyui/data/*.json).
const COMFY_SAMPLERS = [
  "euler", "euler_ancestral", "heun", "dpm_2", "dpmpp_2m", "dpmpp_2m_sde", "dpmpp_3m_sde",
  "dpmpp_sde", "ddim", "uni_pc",
];
const COMFY_SCHEDULERS = ["normal", "karras", "exponential", "sgm_uniform", "simple", "ddim_uniform", "beta"];

// A1111/Forge/SD.Next settings schema (mirrors local-webui/settings.js + local-webui.json), with
// the URL defaulted to 192.168.1.1 as the "point me at a PC" hint.
const LOCAL_WEBUI_SETTINGS = [
  { key: "localWebuiUrl", label: "Server URL", type: "text", default: "http://192.168.1.1:7860", placeholder: "http://192.168.1.1:7860" },
  { key: "sampler", label: "Sampler", options: A1111_SAMPLERS, default: "Euler" },
  { key: "imageSteps", label: "Steps", type: "number", default: 32 },
  { key: "cfg", label: "CFG scale", type: "number", default: 11 },
  { key: "imageWidth", label: "Width", type: "number", default: 512 },
  { key: "imageHeight", label: "Height", type: "number", default: 512 },
  { key: "seed", label: "Seed (-1 = random)", type: "number", default: -1 },
  { key: "negativePrompt", label: "Negative prompt", type: "text", default: "" },
];

export const IMAGE_PROVIDERS = [
  {
    id: "openai",
    label: "OpenAI (DALL·E / gpt-image)",
    keyHint: "sk-…",
    keyUrl: "https://platform.openai.com/api-keys",
    generate: openai,
    settings: [
      { key: "model", label: "Model", options: ["gpt-image-1", "dall-e-3", "dall-e-2"], default: "gpt-image-1" },
      { key: "size", label: "Size", options: ["1024x1024", "1536x1024", "1024x1536"], default: "1024x1024" },
    ],
  },
  {
    id: "fal",
    label: "fal.ai (FLUX / SD3.5)",
    keyHint: "fal key",
    keyUrl: "https://fal.ai/dashboard/keys",
    generate: fal,
    settings: [
      { key: "model", label: "Model", options: ["fal-ai/flux/schnell", "fal-ai/flux/dev", "fal-ai/fast-sdxl"], default: "fal-ai/flux/schnell" },
      { key: "imageSize", label: "Size", options: ["square_hd", "square", "portrait_4_3", "landscape_4_3"], default: "square_hd" },
    ],
  },
  {
    id: "stability",
    label: "Stability AI",
    keyHint: "sk-…",
    keyUrl: "https://platform.stability.ai/account/keys",
    generate: stability,
    settings: [
      { key: "model", label: "Model", options: ["core", "sd3", "ultra"], default: "core" },
      { key: "aspectRatio", label: "Aspect", options: ["1:1", "16:9", "9:16", "3:2", "2:3"], default: "1:1" },
    ],
  },
  {
    id: "gemini",
    label: "Google Gemini",
    keyHint: "AI…",
    keyUrl: "https://aistudio.google.com/apikey",
    generate: gemini,
    settings: [
      { key: "model", label: "Model", options: ["gemini-2.5-flash-image", "gemini-2.0-flash-preview-image-generation"], default: "gemini-2.5-flash-image" },
    ],
  },
  // --- local-direct: the user's own generation server over Wi-Fi / a private cloud (no key). ---
  {
    id: "comfyui",
    label: "ComfyUI (local server)",
    local: true,
    serverKey: "comfyUrl",
    generate: comfyui,
    settings: [
      { key: "comfyUrl", label: "Server URL", type: "text", default: "http://192.168.1.1:8188", placeholder: "http://192.168.1.1:8188" },
      { key: "comfyCheckpoint", label: "Checkpoint (.safetensors)", type: "text", default: "v1-5-pruned-emaonly-fp16.safetensors" },
      { key: "comfyUpscaleModel", label: "Upscale model (blank = auto)", type: "text", default: "" },
      { key: "sampler", label: "Sampler", options: COMFY_SAMPLERS, default: "euler" },
      { key: "scheduler", label: "Scheduler", options: COMFY_SCHEDULERS, default: "normal" },
      { key: "imageSteps", label: "Steps", type: "number", default: 20 },
      { key: "cfg", label: "CFG scale", type: "number", default: 7 },
      { key: "imageWidth", label: "Width", type: "number", default: 512 },
      { key: "imageHeight", label: "Height", type: "number", default: 512 },
      { key: "batchSize", label: "Batch size", type: "number", default: 1 },
      { key: "seed", label: "Seed (-1 = random)", type: "number", default: -1 },
      { key: "negativePrompt", label: "Negative prompt", type: "text", default: "" },
    ],
  },
  {
    id: "forge",
    label: "Forge WebUI (local server)",
    local: true,
    serverKey: "localWebuiUrl",
    generate: localWebui,
    settings: LOCAL_WEBUI_SETTINGS,
  },
  {
    id: "sdnext",
    label: "SD.Next (local server)",
    local: true,
    serverKey: "localWebuiUrl",
    generate: localWebui,
    settings: LOCAL_WEBUI_SETTINGS,
  },
];

export const getImageProvider = (id) => IMAGE_PROVIDERS.find((p) => p.id === id);

/** Default settings ({key: default}) for a provider. */
export function providerDefaults(id) {
  const p = getImageProvider(id);
  const out = {};
  if (p) for (const f of p.settings || []) out[f.key] = f.default;
  return out;
}
