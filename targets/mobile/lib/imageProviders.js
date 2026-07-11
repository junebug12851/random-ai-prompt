/**
 * Mobile provider registry — the counterpart to the web's shared/ provider folders + ProvidersMenu.
 * The phone has no backend of ours, so it exposes exactly the providers that can run without one:
 * `browser-direct` (BYOK, CORS-enabled), `local-direct` (the user's own server), and copy-prompt
 * (`transport: "none"`). Hosted-proxy providers need a backend and are correctly absent.
 *
 * Three roles, mirroring the web (scripts/mobile-parity-check.mjs asserts completeness against the
 * web configs):
 *   • IMAGE_PROVIDERS   — render a picture. generate({prompt,key,settings}) -> {images:[dataUrl|url]}.
 *   • TEXT_PROVIDERS    — rewrite the prompt / keywords. rewrite({prompt,key,mode}) -> text.
 *   • UPSCALE_PROVIDERS — enlarge a saved image. upscale({image,key,settings}) -> {images:[...]}.
 * Copy-prompt image providers (plain / novelai) don't call an API — they just mean "prompts only".
 */

// =============================================================================================
// Shared transport helpers
// =============================================================================================

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

// Every network call goes through this: React Native's fetch has no built-in timeout, so a hung
// server or dead Wi-Fi would block a generation forever (submitPoll only checks its deadline between
// cycles). Wrap fetch with an AbortController-backed timeout, merged with any caller-supplied signal,
// so a single stalled request aborts with a clear error instead of hanging.
const FETCH_TIMEOUT_MS = 120_000;
function fetchWithTimeout(url, options = {}) {
  const { timeoutMs = FETCH_TIMEOUT_MS, signal: external, ...rest } = options;
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (external) {
    if (external.aborted) controller.abort();
    else external.addEventListener?.("abort", onAbort, { once: true });
  }
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...rest, signal: controller.signal }).finally(() => {
    clearTimeout(timer);
    external?.removeEventListener?.("abort", onAbort);
  });
}

async function localPostJson(url, body, signal) {
  let res;
  try {
    res = await fetchWithTimeout(url, {
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
    res = await fetchWithTimeout(url, { method: "GET", signal });
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Generic submit-then-poll (ported from _shared/transport/submitPoll.js). */
async function submitPoll({ submit, poll, isDone, isFailed = () => false, getImages, intervalMs = 1500, timeoutMs = 150000 }) {
  const submitted = await submit();
  const deadline = Date.now() + timeoutMs;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const status = await poll(submitted);
    if (isFailed(status)) throw new Error("Generation failed upstream.");
    if (isDone(status)) return { images: getImages(status) };
    if (Date.now() > deadline) throw new Error("Generation timed out.");
    await sleep(intervalMs);
  }
}

// ---------------------------------------------------------------------------------------------
// hosted-proxy transport — for providers whose API a client can't call directly (CORS / key
// safety). The web routes these through its own backend (/api/generate|rewrite|upscale). Mobile
// has no backend of ours, so the user points at one "hosted elsewhere" (their desktop app or a
// self-hosted online edition) via a Backend URL; we POST the same contract to it.
// ---------------------------------------------------------------------------------------------

function proxyBase(settings = {}) {
  const b = (settings.backendUrl || "").replace(/\/+$/, "");
  if (!b)
    throw new Error(
      "Set a Backend URL in the ⋯ menu to use this hosted provider (your desktop app or a self-hosted server).",
    );
  return b;
}

async function proxyPost(settings, path, body) {
  let res;
  try {
    res = await fetchWithTimeout(`${proxyBase(settings)}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new Error(`Can't reach the Backend URL${path} — check it's running and reachable.`);
  }
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || `Backend returned ${res.status}`);
  return d;
}

// Build a hosted-proxy image adapter for a provider id (params via its buildParams(settings)).
const proxyImage = (providerId, buildParams) => async ({ prompt, key, settings = {} }) => {
  const d = await proxyPost(settings, "/api/generate", { providerId, prompt, key, params: buildParams(settings) });
  return { images: d.images || [] };
};
// Hosted-proxy rewrite adapter (text role) — forwards mode (fix/keyword) to /api/rewrite.
const proxyRewrite = (providerId) => async ({ prompt, key, mode, settings = {} }) => {
  const d = await proxyPost(settings, "/api/rewrite", { providerId, prompt, key, mode: mode || "fix" });
  return { text: d.text || "" };
};
// Hosted-proxy upscale adapter — forwards the image (data URL) to /api/upscale.
const proxyUpscale = (providerId) => async ({ image, key, settings = {} }) => {
  const d = await proxyPost(settings, "/api/upscale", { providerId, image, key, params: {} });
  return { images: d.images || [] };
};

// =============================================================================================
// IMAGE adapters (browser-direct BYOK)
// =============================================================================================

async function openaiImage({ prompt, key, settings = {} }) {
  const res = await fetchWithTimeout("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: settings.model || "gpt-image-1", prompt, size: settings.size || "1024x1024", n: settings.n || 1 }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `OpenAI returned ${res.status}`);
  const images = (data.data || []).map((d) => (d.b64_json ? `data:image/png;base64,${d.b64_json}` : d.url)).filter(Boolean);
  if (!images.length) throw new Error("OpenAI returned no image.");
  return { images };
}

async function falImage({ prompt, key, settings = {} }) {
  const model = settings.model || "fal-ai/flux/schnell";
  const res = await fetchWithTimeout(`https://fal.run/${model}`, {
    method: "POST",
    headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, num_images: settings.batchSize || 1, image_size: settings.imageSize || "square_hd" }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.detail || data?.message || `fal returned ${res.status}`);
  const images = (data.images || []).map((i) => (typeof i === "string" ? i : i?.url)).filter(Boolean);
  if (!images.length) throw new Error("fal returned no image.");
  return { images };
}

async function stabilityImage({ prompt, key, settings = {} }) {
  const endpoint = settings.model || "core"; // core | sd3 | ultra
  const fd = new FormData();
  fd.append("prompt", prompt);
  fd.append("output_format", "png");
  fd.append("aspect_ratio", settings.aspectRatio || "1:1");
  if (settings.negativePrompt) fd.append("negative_prompt", settings.negativePrompt);
  const res = await fetchWithTimeout(`https://api.stability.ai/v2beta/stable-image/generate/${endpoint}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
    body: fd,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data?.errors && data.errors[0]) || data?.message || data?.name || `Stability returned ${res.status}`);
  const images = data.image ? [`data:image/png;base64,${data.image}`] : [];
  if (!images.length) throw new Error("Stability returned no image.");
  return { images };
}

async function geminiImage({ prompt, key, settings = {} }) {
  const model = settings.model || "gemini-2.5-flash-image";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ["IMAGE"] } }),
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

// Grok (xAI) — OpenAI-compatible images endpoint (ported from grok/code/server.js).
async function grokImage({ prompt, key, settings = {} }) {
  const res = await fetchWithTimeout("https://api.x.ai/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: settings.model || "grok-2-image", prompt, n: num(settings.batchSize, 1) }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || data?.error || `xAI returned ${res.status}`);
  const images = (data.data || []).map((d) => (d.b64_json ? `data:image/jpeg;base64,${d.b64_json}` : d.url)).filter(Boolean);
  if (!images.length) throw new Error("Grok returned no image.");
  return { images };
}

// Leonardo — submit-then-poll (ported from leonardo/code/server.js).
async function leonardoImage({ prompt, key, settings = {} }) {
  const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json", accept: "application/json" };
  return submitPoll({
    submit: async () => {
      const res = await fetchWithTimeout("https://cloud.leonardo.ai/api/rest/v1/generations", {
        method: "POST",
        headers,
        body: JSON.stringify({
          prompt,
          modelId: settings.model,
          num_images: num(settings.batchSize, 1),
          width: num(settings.imageWidth, 1024),
          height: num(settings.imageHeight, 1024),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error || d?.message || `Leonardo returned ${res.status}`);
      const id = d?.sdGenerationJob?.generationId;
      if (!id) throw new Error("Leonardo did not return a generation id.");
      return { id };
    },
    poll: async (sub) => {
      const res = await fetchWithTimeout(`https://cloud.leonardo.ai/api/rest/v1/generations/${sub.id}`, { headers });
      return res.json().catch(() => ({}));
    },
    isDone: (s) => s?.generations_by_pk?.status === "COMPLETE",
    isFailed: (s) => s?.generations_by_pk?.status === "FAILED",
    getImages: (s) => (s?.generations_by_pk?.generated_images || []).map((i) => i.url).filter(Boolean),
    intervalMs: 2000,
    timeoutMs: 150000,
  });
}

// ---- local-direct image adapters (ComfyUI / A1111-Forge/SD.Next) ----

async function localWebuiImage({ prompt, settings = {} }) {
  const base = normalizeBase(settings.localWebuiUrl, "http://127.0.0.1:7860");
  const data = await localPostJson(`${base}/sdapi/v1/txt2img`, {
    prompt,
    negative_prompt: settings.negativePrompt || "",
    steps: num(settings.imageSteps, 32),
    cfg_scale: num(settings.cfg, 11),
    width: num(settings.imageWidth, 512),
    height: num(settings.imageHeight, 512),
    sampler_name: settings.sampler,
    scheduler: settings.scheduler || "Automatic",
    batch_size: Math.max(1, num(settings.batchSize, 1)),
    seed: num(settings.seed, -1),
    send_images: true,
    save_images: false,
  });
  return { images: (data.images || []).map((b64) => `data:image/png;base64,${b64}`) };
}

const COMFY_WORKFLOW = {
  "3": { class_type: "KSampler", inputs: { seed: 0, steps: 20, cfg: 7, sampler_name: "euler", scheduler: "normal", denoise: 1, model: ["4", 0], positive: ["6", 0], negative: ["7", 0], latent_image: ["5", 0] } },
  "4": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: "model.safetensors" } },
  "5": { class_type: "EmptyLatentImage", inputs: { width: 512, height: 512, batch_size: 1 } },
  "6": { class_type: "CLIPTextEncode", inputs: { text: "", clip: ["4", 1] } },
  "7": { class_type: "CLIPTextEncode", inputs: { text: "", clip: ["4", 1] } },
  "8": { class_type: "VAEDecode", inputs: { samples: ["3", 0], vae: ["4", 2] } },
  "9": { class_type: "SaveImage", inputs: { filename_prefix: "rap", images: ["8", 0] } },
};

async function comfyImage({ prompt, settings = {} }) {
  const base = normalizeBase(settings.comfyUrl, "http://127.0.0.1:8188");
  const g = JSON.parse(JSON.stringify(COMFY_WORKFLOW));
  g["6"].inputs.text = prompt;
  g["7"].inputs.text = settings.negativePrompt || "";
  g["5"].inputs.width = num(settings.imageWidth, 512);
  g["5"].inputs.height = num(settings.imageHeight, 512);
  g["5"].inputs.batch_size = Math.max(1, num(settings.batchSize, 1));
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
    if (!ckpt) throw new Error("ComfyUI has no checkpoint models installed — add one to ComfyUI/models/checkpoints.");
    g["3"].inputs.sampler_name = pick(samplerList, settings.sampler, "euler");
    g["3"].inputs.scheduler = pick(schedList, settings.scheduler, "normal");
  } catch (e) {
    if (!ckpt) throw e;
  }
  g["4"].inputs.ckpt_name = ckpt;

  const clientId = (typeof crypto !== "undefined" && crypto.randomUUID && crypto.randomUUID()) || String(Math.random()).slice(2);
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
          const q = new URLSearchParams({ filename: im.filename, subfolder: im.subfolder || "", type: im.type || "output" });
          images.push(`${base}/view?${q.toString()}`);
        }
      }
      if (images.length) return { images };
    }
    if (Date.now() > deadline) throw new Error("ComfyUI generation timed out.");
    await sleep(1200);
  }
}

// =============================================================================================
// UPSCALE adapters
// =============================================================================================

// fal.ai Real-ESRGAN (browser-direct). `image` is a data: URL.
async function falUpscale({ image, key }) {
  const res = await fetchWithTimeout("https://fal.run/fal-ai/esrgan", {
    method: "POST",
    headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ image_url: image, scale: 4, model: "RealESRGAN_x4plus", output_format: "png" }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.detail || data?.message || `fal upscale returned ${res.status}`);
  const out = data?.image?.url || (Array.isArray(data?.images) ? data.images[0]?.url || data.images[0] : null);
  if (!out) throw new Error("fal returned no upscaled image.");
  return { images: [out] };
}

// Stability fast upscaler (browser-direct). `imageFile` = RN FormData file part {uri,name,type}.
async function stabilityUpscale({ imageFile, key }) {
  const fd = new FormData();
  fd.append("image", imageFile);
  fd.append("output_format", "png");
  const res = await fetchWithTimeout("https://api.stability.ai/v2beta/stable-image/upscale/fast", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
    body: fd,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data?.errors && data.errors[0]) || data?.message || data?.name || `Stability upscale returned ${res.status}`);
  const images = data.image ? [`data:image/png;base64,${data.image}`] : [];
  if (!images.length) throw new Error("Stability returned no upscaled image.");
  return { images };
}

// Leonardo Universal Upscaler (browser-direct, S3 upload → submit → poll). `imageFile` = RN file part.
async function leonardoUpscale({ imageFile, key }) {
  const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json", accept: "application/json" };
  const initRes = await fetchWithTimeout("https://cloud.leonardo.ai/api/rest/v1/init-image", {
    method: "POST",
    headers,
    body: JSON.stringify({ extension: "png" }),
  });
  const initD = await initRes.json().catch(() => ({}));
  if (!initRes.ok) throw new Error(initD?.error || `Leonardo init-image returned ${initRes.status}`);
  const up = initD?.uploadInitImage;
  if (!up?.url || !up?.fields || !up?.id) throw new Error("Leonardo did not return an upload target.");
  const fields = typeof up.fields === "string" ? JSON.parse(up.fields) : up.fields;
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  fd.append("file", imageFile);
  const s3 = await fetchWithTimeout(up.url, { method: "POST", body: fd });
  if (!s3.ok) throw new Error(`Leonardo image upload failed (${s3.status}).`);
  const result = await submitPoll({
    submit: async () => {
      const res = await fetchWithTimeout("https://cloud.leonardo.ai/api/rest/v1/variations/universal-upscaler", {
        method: "POST",
        headers,
        body: JSON.stringify({ initImageId: up.id, upscaleMultiplier: 2 }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error || `Leonardo upscaler returned ${res.status}`);
      const id = d?.universalUpscaler?.id || d?.sdUpscaleJob?.id || d?.sdUpscaleGenerationJob?.id;
      if (!id) throw new Error("Leonardo did not return an upscale job id.");
      return { id };
    },
    poll: async (sub) => {
      const res = await fetchWithTimeout(`https://cloud.leonardo.ai/api/rest/v1/variations/${sub.id}`, { headers });
      return res.json().catch(() => ({}));
    },
    isDone: (s) => (s?.generated_image_variation_generic || []).some((v) => v?.status === "COMPLETE"),
    isFailed: (s) => (s?.generated_image_variation_generic || []).some((v) => v?.status === "FAILED"),
    getImages: (s) => (s?.generated_image_variation_generic || []).map((v) => v.url).filter(Boolean),
    intervalMs: 2500,
    timeoutMs: 180000,
  });
  if (!result.images?.length) throw new Error("Leonardo returned no upscaled image.");
  return { images: result.images };
}

// A1111/Forge/SD.Next Extras upscaler (local-direct). `imageBase64` = raw base64 (no data: prefix).
async function localWebuiUpscale({ imageBase64, settings = {} }) {
  const base = normalizeBase(settings.localWebuiUrl, "http://127.0.0.1:7860");
  const data = await localPostJson(`${base}/sdapi/v1/extra-single-image`, {
    image: imageBase64,
    upscaling_resize: num(settings.upscaleFactor, 4),
    upscaler_1: settings.upscaler || "R-ESRGAN 4x+",
  });
  if (!data?.image) throw new Error("The WebUI returned no upscaled image.");
  return { images: [`data:image/png;base64,${data.image}`] };
}

// ComfyUI upscale (local-direct; ported from comfyui/code/upscale-server.js). `imageFile` = RN file part.
async function comfyUpscale({ imageFile, settings = {} }) {
  const base = normalizeBase(settings.comfyUrl, "http://127.0.0.1:8188");
  const fd = new FormData();
  fd.append("image", imageFile);
  fd.append("overwrite", "true");
  let upRes;
  try {
    upRes = await fetchWithTimeout(`${base}/upload/image`, { method: "POST", body: fd });
  } catch (e) {
    throw new Error(`Can't reach ${base} — check the Server URL and that ComfyUI is on this Wi-Fi.`);
  }
  const upData = await upRes.json().catch(() => ({}));
  if (!upRes.ok || !upData?.name) throw new Error(upData?.error || `ComfyUI image upload failed (${upRes.status}).`);
  const imageRef = upData.subfolder ? `${upData.subfolder}/${upData.name}` : upData.name;

  let model = settings.comfyUpscaleModel;
  try {
    const info = await localGetJson(`${base}/object_info/UpscaleModelLoader`);
    const list = info?.UpscaleModelLoader?.input?.required?.model_name?.[0] || [];
    if (!model || !list.includes(model)) model = list[0];
  } catch {
    /* keep configured model */
  }
  if (!model) throw new Error("ComfyUI has no upscale models — add one to ComfyUI/models/upscale_models.");

  const g = {
    1: { class_type: "LoadImage", inputs: { image: imageRef } },
    2: { class_type: "UpscaleModelLoader", inputs: { model_name: model } },
    3: { class_type: "ImageUpscaleWithModel", inputs: { upscale_model: ["2", 0], image: ["1", 0] } },
    4: { class_type: "SaveImage", inputs: { images: ["3", 0] } },
  };
  const clientId = (typeof crypto !== "undefined" && crypto.randomUUID && crypto.randomUUID()) || String(Math.random()).slice(2);
  const sub = await localPostJson(`${base}/prompt`, { prompt: g, client_id: clientId });
  const promptId = sub.prompt_id;
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
          const q = new URLSearchParams({ filename: im.filename, subfolder: im.subfolder || "", type: im.type || "output" });
          images.push(`${base}/view?${q.toString()}`);
        }
      }
      if (images.length) return { images };
    }
    if (Date.now() > deadline) throw new Error("ComfyUI upscale timed out.");
    await sleep(1200);
  }
}

// =============================================================================================
// TEXT / prompt-rewrite adapters
// =============================================================================================

// Ported from shared/_shared/rewriteSystem.js — the two modes the mobile composer uses.
const REWRITE_SYSTEM =
  "You are a prompt engineer for text-to-image models. Rewrite the user's raw, mechanical prompt into " +
  "ONE clean, well-structured image-generation prompt that will produce a better result: fix grammar, " +
  "remove redundancy and contradictions, group related ideas, and keep every important subject, style, " +
  "and detail. Reply with ONLY the rewritten prompt — no preamble, no quotes, no explanation.";
const KEYWORD_SYSTEM =
  "You convert image-generation prompts into a clean keyword/tag list. Break the user's prompt into its " +
  "distinct concepts — subjects, attributes, setting, style, lighting, composition, medium, quality — and " +
  "output them as a single comma-separated list of short lowercase tags (one to a few words each). Remove " +
  "weighting syntax such as parentheses, brackets, ':1.2' weights, and LoRA/embedding tags; expand them to " +
  "their plain meaning. No duplicates, no numbering, no sentences. Reply with ONLY the comma-separated " +
  "keywords — no preamble, no quotes, no explanation.";
// Grow a word list — invent 25 new entries in a sample's style (Manage list editor's AI Expand).
// Kept verbatim in lockstep with the web EXPAND_SYSTEM (shared/_shared/rewriteSystem.js).
const EXPAND_SYSTEM =
  "You extend a word list. The user gives a sample of entries from one list (each a short word or " +
  "phrase, one per line). Infer the list's theme/category and style, then invent NEW entries that fit " +
  "right in. Reply with EXACTLY 25 new entries, one per line, matching the sample's style, length, and " +
  "casing. Do NOT repeat any of the sample entries and do NOT repeat yourself. No numbering, no bullets, " +
  "no commentary, no blank lines — only the 25 entries, one per line.";

// DPL syntax primer + per-mode task instructions for the Manage block editor's Refine / Modify / Draft.
// Ported VERBATIM from the web shared/_shared/rewriteSystem.js (DPL_PRIMER + DPL_TASKS); the parity check
// (scripts/mobile-parity-check.mjs → checkRewriteSystems) asserts systemFor() matches the web for every
// mode, so these can't drift.
const DPL_PRIMER =
  "DPL is a small line-based template language for image prompts. Work IN DPL and reply with ONLY the " +
  "DPL — no markdown fences, no preamble, no commentary. The grammar:\n" +
  "- Front matter: an optional leading block delimited by `---` lines (e.g. `---` / `description: ...` / " +
  "`---`). Preserve it.\n" +
  "- Sections: a line of text immediately followed by a line of only `===` is a section heading; " +
  "templates usually open with `Start` then `===`.\n" +
  "- Plain lines are literal prompt text; a line beginning with `- ` is a detail fragment.\n" +
  "- Tokens (keep verbatim — never invent list or generator names that were not already present): " +
  "`{list}` inserts a random entry from a word list, `{#name}` runs another generator, `{salt}` adds " +
  "uniqueness.\n" +
  "- Chance gates: `maybe X`, `NN% chance X`, `NN% X`, and `otherwise X` (fallback for the gate above).\n" +
  "- Choices: `one of:`, `N of:`, or `A to B of:` followed by indented `- option` lines; append " +
  "`(NN% nothing)` for a chance of nothing.\n" +
  "- Repeat: `repeat N times` or `repeat A to B times` with an indented body.\n" +
  "- References / flow: `+name` or `insert name` runs a generator; `go to Section` / `go back`.\n" +
  "- Emphasis: `(text)` strengthens, `((text))` strengthens more, `[text]` weakens, `(text:1.2)` weights.\n" +
  "- Dials — a leading `[...]` bracket may carry a weight and/or dial conditions; the two dials each run " +
  "1..100 (default 50): intensity `i` = how much / how lavish, focus `f` = how pure / how narrow. " +
  "`[i>70%] ornate gilded detail` only appears at high intensity; `[i<25%] plain and sparse` only at low " +
  "intensity; `[f<40%] distant background garnish` only appears at low focus (fluff), while high focus " +
  "keeps only the essential subject. Stack them: `[100 i<10% f<40%]`.\n" +
  "- Comments start with `;`. Keep indentation consistent (spaces or tabs, not both).\n" +
  "When refining, preserve the subject and every existing `{list}` / `{#name}` token unless the " +
  "instruction is specifically to remove detail.";

const DPL_TASKS = {
  "dpl-detail-more":
    "TASK: Enrich this template with MORE concrete detail. Add descriptive `- ` fragments and sharpen " +
    "existing lines with texture, material, lighting, and mood cues that fit the subject. Prefer adding " +
    "the extra richness behind gates (`maybe` / `NN% chance`) or `[i>70%]` so it only shows sometimes or " +
    "at high intensity, rather than bloating every roll. Keep the subject and all existing tokens.",
  "dpl-detail-less":
    "TASK: Pare this template DOWN. Remove redundant, weak, or over-specific fragments and tighten " +
    "wording so only the strong, essential detail remains. Keep the subject, the section structure, and " +
    "the most important tokens; drop filler.",
  "dpl-complex-more":
    "TASK: Make this template structurally RICHER so each roll differs meaningfully. Turn flat lines into " +
    "`one of:` choices, add `maybe` / `NN% chance` gates and the occasional `repeat`, and introduce " +
    "intensity/focus-gated variants. Reuse existing tokens and keep the subject.",
  "dpl-complex-less":
    "TASK: SIMPLIFY this template's structure. Collapse choices, gates, and repeats into a smaller, " +
    "clearer set of lines while keeping the subject and its strongest attributes. Fewer moving parts, " +
    "same intent.",
  "dpl-focus-more":
    "TASK: SHARPEN focus. Keep only what is essential to the subject; strip or gate atmospheric fluff, " +
    "distant background, and unrelated garnish. Move any non-essential lines behind `[f<40%]` so they " +
    "only appear at low focus, and lead with the pure subject so the generator stacks cleanly as a layer.",
  "dpl-focus-less":
    "TASK: LOOSEN focus. Add atmospheric and contextual garnish — setting, background, mood, incidental " +
    "extras — as `[f<40%]`-gated lines, so richer scene-setting appears when focus is dialed down without " +
    "disturbing the essential subject spine.",
  "dpl-intensity-more":
    "TASK: Raise the INTENSITY ceiling. Add lavish, dialed-up variants behind `[i>70%]` (ornate, " +
    "dramatic, maximal wording) and let counts/choices scale up, so cranking intensity yields a richer " +
    "image. Leave the default and low-intensity output intact.",
  "dpl-intensity-less":
    "TASK: Add restraint at low INTENSITY. Introduce `[i<25%]` pared-back, plain, minimal variants so " +
    "dialing intensity down yields a clean, simple image, while leaving the default output intact.",
  "dpl-variety-more":
    "TASK: Increase per-roll VARIETY. Replace fixed attributes with `one of:` / `N of:` choices over " +
    "sensible alternatives, add `{salt}` if it is missing, and gate optional flourishes with `maybe` / " +
    "`NN%` — so repeated generations look meaningfully different. Keep the subject.",
  "dpl-variety-less":
    "TASK: Make this template more CONSISTENT. Reduce randomness by narrowing or fixing the most variable " +
    "choices to their single strongest option, so repeated generations look alike. Keep the subject and " +
    "overall look.",
  "dpl-tighten":
    "TASK: CLEAN UP this template without changing its intent. Fix indentation, remove duplicate or " +
    "contradictory lines, repair malformed tokens or brackets, and tidy wording. Keep every section, " +
    "token, and behaviour.",
  "dpl-custom":
    "TASK: The user message has two parts — an INSTRUCTION describing a change, then, after a line " +
    "reading `--- TEMPLATE ---`, the current DPL template. Apply the instruction to that template and " +
    "return the full revised DPL. Follow the instruction precisely; keep everything it does not ask you " +
    "to change — the subject, the sections, and every existing `{list}` / `{#name}` token. If the " +
    "instruction is unrelated to the template, make the smallest sensible change and otherwise leave it " +
    "as-is.",
  "dpl-create":
    "TASK: The user message is a plain-English description of a subject or scene. Produce ONE complete, " +
    "well-formed DPL template that is a strong STARTING point — good enough to use as-is and easy to " +
    "refine further. Follow this winning formula:\n" +
    "1. Open with front matter: `---`, then `description: <a short label>`, then `---`.\n" +
    "2. Start a section: `Start` then a line of `===`.\n" +
    "3. Lead line: the core subject as a few strong comma-separated nouns/attributes — the spine of the " +
    "image.\n" +
    "4. Add a handful of always-on essentials as `- ` bullets (things that MUST be true of the subject).\n" +
    "5. VARIETY: turn the key variable attributes (material, colour, wardrobe, pose, expression) into " +
    "`one of:` choices with 3–6 solid options each, so every roll differs.\n" +
    "6. GARNISH sparingly with `maybe` / `NN% chance` gates for optional mood, lighting, and extras.\n" +
    "7. FOCUS: put a line or two of atmospheric/background fluff behind `[f<40%]` so it only shows at low " +
    "focus, keeping the subject spine pure.\n" +
    "8. INTENSITY: add a `[i>70%]` line for lavish, dialed-up richness and a `[i<25%]` line for a " +
    "pared-back, minimal version.\n" +
    "9. Stay composable: describe the SUBJECT, not a global art style; several short comma lists beat one " +
    "giant line. Aim for roughly 10–20 lines.",
};

export function systemFor(mode) {
  if (mode === "keyword") return KEYWORD_SYSTEM;
  if (mode === "expand") return EXPAND_SYSTEM;
  if (mode && Object.prototype.hasOwnProperty.call(DPL_TASKS, mode)) {
    return `${DPL_PRIMER}\n\n${DPL_TASKS[mode]}`;
  }
  return REWRITE_SYSTEM;
}

/** Strip markdown fences the model sometimes wraps DPL in. Mirrors the web cleanDplOutput. */
export function cleanDplOutput(out) {
  let s = (out || "").trim();
  const fence = s.match(/^```[a-z]*\n([\s\S]*?)\n```$/i);
  if (fence) s = fence[1].trim();
  return s;
}

// OpenAI-compatible chat rewrite factory (Groq / OpenRouter / xAI / OpenAI all speak this shape).
function makeChatRewrite({ url, model, label }) {
  return async function rewrite({ prompt, key, system }) {
    const res = await fetchWithTimeout(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system || REWRITE_SYSTEM },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
      }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d?.error?.message || d?.message || (typeof d?.error === "string" ? d.error : null) || `${label} returned ${res.status}`);
    const text = d?.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error(`${label} returned no rewrite.`);
    return { text };
  };
}

const openaiRewrite = makeChatRewrite({ url: "https://api.openai.com/v1/chat/completions", model: "gpt-4o-mini", label: "OpenAI" });
const grokRewrite = makeChatRewrite({ url: "https://api.x.ai/v1/chat/completions", model: "grok-2-latest", label: "Grok" });
const groqRewrite = makeChatRewrite({ url: "https://api.groq.com/openai/v1/chat/completions", model: "llama-3.3-70b-versatile", label: "Groq" });
const openrouterRewrite = makeChatRewrite({ url: "https://openrouter.ai/api/v1/chat/completions", model: "openai/gpt-4o-mini", label: "OpenRouter" });

async function geminiRewrite({ prompt, key, system }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: system || REWRITE_SYSTEM }] }, contents: [{ parts: [{ text: prompt }] }] }),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d?.error?.message || `Gemini rewrite returned ${res.status}`);
  const text = (d?.candidates?.[0]?.content?.parts || []).map((p) => p.text).filter(Boolean).join("").trim();
  if (!text) throw new Error("Gemini returned no rewrite.");
  return { text };
}

// =============================================================================================
// Settings schemas
// =============================================================================================

const A1111_SAMPLERS = ["Euler", "Euler a", "Heun", "LMS", "DPM++ 2M", "DPM++ 2M Karras", "DPM++ SDE", "DPM++ SDE Karras", "DPM++ 3M SDE", "DDIM", "UniPC"];
const COMFY_SAMPLERS = ["euler", "euler_ancestral", "heun", "dpm_2", "dpmpp_2m", "dpmpp_2m_sde", "dpmpp_3m_sde", "dpmpp_sde", "ddim", "uni_pc"];
const COMFY_SCHEDULERS = ["normal", "karras", "exponential", "sgm_uniform", "simple", "ddim_uniform", "beta"];
const LEONARDO_MODELS = [
  { value: "de7d3faf-762f-48e0-b3b7-9d0ac3a3fcf3", label: "Leonardo Phoenix 1.0" },
  { value: "b24e16ff-06e3-43eb-8d33-4416c2d75876", label: "Leonardo Lightning XL" },
  { value: "1e60896f-3c26-4296-8ecc-53e2afecc132", label: "Leonardo Diffusion XL" },
  { value: "e71a1c2f-4f80-4800-934f-2c68979d8cc8", label: "Leonardo Anime XL" },
];

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

// =============================================================================================
// Registries
// =============================================================================================

export const IMAGE_PROVIDERS = [
  // --- Local group ---
  { id: "plain", label: "None — prompts only", group: "local", copy: true, description: "No API — just rolls prompts you can copy.", settings: [] },
  { id: "comfyui", label: "ComfyUI (local server)", group: "local", local: true, negative: true, serverKey: "comfyUrl", generate: comfyImage,
    description: "Local ComfyUI — node-based SD/FLUX. Free, runs on your machine.",
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
    ] },
  { id: "forge", label: "Forge WebUI (local server)", group: "local", local: true, negative: true, serverKey: "localWebuiUrl", generate: localWebuiImage,
    description: "Local Forge WebUI (Stable Diffusion). Free, runs on your machine.", settings: LOCAL_WEBUI_SETTINGS },
  { id: "sdnext", label: "SD.Next (local server)", group: "local", local: true, negative: true, serverKey: "localWebuiUrl", generate: localWebuiImage,
    description: "Local SD.Next (Stable Diffusion). Free, runs on your machine.", settings: LOCAL_WEBUI_SETTINGS },
  // --- Online group (browser-direct BYOK) ---
  { id: "openai", label: "OpenAI (DALL·E / gpt-image)", group: "online", keyHint: "sk-…", keyUrl: "https://platform.openai.com/api-keys", generate: openaiImage,
    description: "OpenAI DALL·E / gpt-image — strong prompt following.",
    settings: [
      { key: "model", label: "Model", options: ["gpt-image-1", "dall-e-3", "dall-e-2"], default: "gpt-image-1" },
      { key: "size", label: "Size", options: ["1024x1024", "1536x1024", "1024x1536"], default: "1024x1024" },
    ] },
  { id: "fal", label: "fal.ai (FLUX / SD3.5)", group: "online", keyHint: "fal key", keyUrl: "https://fal.ai/dashboard/keys", generate: falImage,
    description: "Fast hosted inference (FLUX, SD3.5, Recraft, …).",
    settings: [
      { key: "model", label: "Model", options: ["fal-ai/flux/schnell", "fal-ai/flux/dev", "fal-ai/fast-sdxl"], default: "fal-ai/flux/schnell" },
      { key: "imageSize", label: "Size", options: ["square_hd", "square", "portrait_4_3", "portrait_16_9", "landscape_4_3", "landscape_16_9"], default: "square_hd" },
      { key: "batchSize", label: "Images", type: "number", default: 1 },
    ] },
  { id: "stability", label: "Stability AI", group: "online", negative: true, keyHint: "sk-…", keyUrl: "https://platform.stability.ai/account/keys", generate: stabilityImage,
    description: "Stability AI — Stable Image Core / SD3 / Ultra.",
    settings: [
      { key: "model", label: "Model", options: ["core", "sd3", "ultra"], default: "core" },
      { key: "aspectRatio", label: "Aspect ratio", options: ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "21:9", "9:21"], default: "1:1" },
      { key: "negativePrompt", label: "Negative prompt", type: "text", default: "" },
    ] },
  { id: "gemini", label: "Google Gemini (image)", group: "online", keyHint: "AI…", keyUrl: "https://aistudio.google.com/app/apikey", generate: geminiImage,
    description: "Google Gemini image generation (Nano Banana).",
    settings: [{ key: "model", label: "Model", options: ["gemini-2.5-flash-image", "gemini-2.0-flash-preview-image-generation"], default: "gemini-2.5-flash-image" }] },
  { id: "grok", label: "Grok (xAI image)", group: "online", keyHint: "xai-…", keyUrl: "https://console.x.ai/", generate: grokImage,
    description: "xAI Grok / Aurora image generation.",
    settings: [
      { key: "model", label: "Model", options: ["grok-2-image", "grok-imagine-image-quality"], default: "grok-2-image" },
      { key: "batchSize", label: "Images", type: "number", default: 1 },
    ] },
  { id: "leonardo", label: "Leonardo AI", group: "online", keyHint: "leonardo key", keyUrl: "https://app.leonardo.ai/api-access", generate: leonardoImage,
    description: "Leonardo AI — game / concept-art models.",
    settings: [
      { key: "model", label: "Model", options: LEONARDO_MODELS, default: "de7d3faf-762f-48e0-b3b7-9d0ac3a3fcf3" },
      { key: "imageWidth", label: "Width", type: "number", default: 1024 },
      { key: "imageHeight", label: "Height", type: "number", default: 1024 },
      { key: "batchSize", label: "Images", type: "number", default: 1 },
    ] },
  // Online (hosted-proxy — route through a Backend URL, key BYOK)
  { id: "replicate", label: "Replicate", group: "online", proxy: true, keyHint: "r8_…", keyUrl: "https://replicate.com/account/api-tokens",
    generate: proxyImage("replicate", (s) => ({ model: s.model || "black-forest-labs/flux-schnell", aspect_ratio: s.aspectRatio || "1:1", n: num(s.batchSize, 1) })),
    description: "Hosted open models (FLUX, SDXL, SD3.5, …) — needs a Backend URL.",
    settings: [
      { key: "model", label: "Model (owner/name)", type: "text", default: "black-forest-labs/flux-schnell" },
      { key: "aspectRatio", label: "Aspect ratio", options: ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"], default: "1:1" },
      { key: "batchSize", label: "Images", type: "number", default: 1 },
    ] },
  { id: "bfl", label: "FLUX (Black Forest Labs)", group: "online", proxy: true, keyHint: "bfl key", keyUrl: "https://dashboard.bfl.ai/",
    generate: proxyImage("bfl", (s) => ({ model: s.model || "flux-dev", aspect_ratio: s.aspectRatio || "1:1" })),
    description: "FLUX direct from Black Forest Labs — needs a Backend URL.",
    settings: [
      { key: "model", label: "Model", options: ["flux-dev", "flux-pro-1.1", "flux-pro", "flux-schnell"], default: "flux-dev" },
      { key: "aspectRatio", label: "Aspect ratio", options: ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"], default: "1:1" },
    ] },
  { id: "ideogram", label: "Ideogram", group: "online", proxy: true, keyHint: "ideogram key", keyUrl: "https://ideogram.ai/manage-api",
    generate: proxyImage("ideogram", (s) => ({ model: s.model || "V_2", aspect_ratio: s.aspectRatio || "ASPECT_1_1" })),
    description: "Ideogram — best in-image text rendering — needs a Backend URL.",
    settings: [
      { key: "model", label: "Model", options: ["V_2", "V_2_TURBO", "V_1", "V_1_TURBO"], default: "V_2" },
      { key: "aspectRatio", label: "Aspect ratio", options: ["ASPECT_1_1", "ASPECT_16_9", "ASPECT_9_16", "ASPECT_4_3", "ASPECT_3_4"], default: "ASPECT_1_1" },
    ] },
  { id: "midjourney", label: "Midjourney (copy prompt)", group: "online", copy: true, description: "No API — copies a full Midjourney prompt to paste into Discord.", settings: [] },
  { id: "novelai", label: "NovelAI (copy prompt)", group: "online", copy: true, description: "No API — copies a NovelAI-dialect prompt.", settings: [] },
];

// Hosted-proxy text (rewrite) providers — LLMs that run through a Backend URL (/api/rewrite).
const PROXY_TEXT = [
  ["ai21", "AI21 (jamba-large)"],
  ["anthropic", "Claude (3.5 Haiku)"],
  ["cerebras", "Cerebras (llama-3.3-70b)"],
  ["cohere", "Cohere (command-r)"],
  ["deepseek", "DeepSeek (deepseek-chat)"],
  ["fireworks", "Fireworks (Llama-3.3-70B)"],
  ["huggingface", "Hugging Face (Llama-3.3-70B)"],
  ["llama", "Llama (3.3-70B)"],
  ["mistral", "Mistral (small-latest)"],
  ["moonshot", "Moonshot (moonshot-v1-8k)"],
  ["perplexity", "Perplexity (sonar)"],
  ["qwen", "Qwen (qwen-plus)"],
  ["together", "Together (Llama-3.3-70B)"],
].map(([id, label]) => ({ id, label, proxy: true, keyHint: "API key", rewrite: proxyRewrite(id), description: `${label.split(" (")[0]} — rewrites via a Backend URL.` }));

// Hosted-proxy upscale / enhancer providers — run through a Backend URL (/api/upscale).
const PROXY_UPSCALE = [
  ["replicate", "Replicate (Real-ESRGAN)"],
  ["claid", "Claid / Let's Enhance"],
  ["clipdrop", "Clipdrop (Upscale)"],
  ["deepai", "DeepAI (Super Resolution)"],
  ["deepimage", "Deep-Image.ai (Upscale)"],
  ["neurallove", "neural.love (Upscale)"],
  ["picsart", "Picsart (Upscale)"],
  ["segmind", "Segmind (ESRGAN)"],
  ["vanceai", "VanceAI (Upscale)"],
  ["venice", "Venice AI (Upscale)"],
  ["wavespeed", "WaveSpeed (Real-ESRGAN)"],
].map(([id, label]) => ({ id, label, group: "online", proxy: true, mode: "dataurl", keyHint: "API key", upscale: proxyUpscale(id), description: `${label.split(" (")[0]} — upscales via a Backend URL.` }));

// Text / prompt-rewrite providers (the web's "Text" role). A provider shown here in the text role
// uses its chat model, so the label is the rewriteLabel. `sharesImageKey` providers reuse the same
// secure key id as the image provider of the same name.
export const TEXT_PROVIDERS = [
  { id: "openai", label: "OpenAI (GPT-4o mini)", keyHint: "sk-…", keyUrl: "https://platform.openai.com/api-keys", rewrite: openaiRewrite, description: "Rewrites prompts with GPT-4o mini." },
  { id: "gemini", label: "Google Gemini (2.0 Flash)", keyHint: "AI…", keyUrl: "https://aistudio.google.com/app/apikey", rewrite: geminiRewrite, description: "Rewrites prompts with Gemini 2.0 Flash." },
  { id: "grok", label: "Grok (xAI · Grok 2)", keyHint: "xai-…", keyUrl: "https://console.x.ai/", rewrite: grokRewrite, description: "Rewrites prompts with Grok 2." },
  { id: "groq", label: "Groq (llama-3.3-70b)", keyHint: "gsk_…", keyUrl: "https://console.groq.com/keys", rewrite: groqRewrite, description: "Very fast open-model rewrite (Llama 3.3 70B)." },
  { id: "openrouter", label: "OpenRouter (gpt-4o-mini)", keyHint: "sk-or-…", keyUrl: "https://openrouter.ai/keys", rewrite: openrouterRewrite, description: "One key, hundreds of models." },
  ...PROXY_TEXT,
];

// Upscale / enhance providers (the web's "Upscaler / Enhancer" role, used in the single-image view).
export const UPSCALE_PROVIDERS = [
  // Local
  { id: "comfyui", label: "ComfyUI (local server)", group: "local", local: true, serverKey: "comfyUrl", mode: "file", upscale: comfyUpscale, description: "Local ComfyUI upscale-model graph." },
  { id: "forge", label: "Forge WebUI (local server)", group: "local", local: true, serverKey: "localWebuiUrl", mode: "base64", upscale: localWebuiUpscale, description: "A1111 Extras upscaler (R-ESRGAN 4x+)." },
  { id: "sdnext", label: "SD.Next (local server)", group: "local", local: true, serverKey: "localWebuiUrl", mode: "base64", upscale: localWebuiUpscale, description: "A1111 Extras upscaler (R-ESRGAN 4x+)." },
  // Online (browser-direct BYOK)
  { id: "fal", label: "fal.ai (Real-ESRGAN)", group: "online", keyHint: "fal key", keyUrl: "https://fal.ai/dashboard/keys", mode: "dataurl", upscale: falUpscale, description: "fal Real-ESRGAN 4× super-resolution." },
  { id: "stability", label: "Stability (fast upscaler)", group: "online", keyHint: "sk-…", keyUrl: "https://platform.stability.ai/account/keys", mode: "file", upscale: stabilityUpscale, description: "Stability fast ~4× upscaler." },
  { id: "leonardo", label: "Leonardo (Universal Upscaler)", group: "online", keyHint: "leonardo key", keyUrl: "https://app.leonardo.ai/api-access", mode: "file", upscale: leonardoUpscale, description: "Leonardo Universal Upscaler (≤2×)." },
  ...PROXY_UPSCALE,
];

// =============================================================================================
// Lookups
// =============================================================================================

export const getImageProvider = (id) => IMAGE_PROVIDERS.find((p) => p.id === id);
export const getTextProvider = (id) => TEXT_PROVIDERS.find((p) => p.id === id);
export const getUpscaleProvider = (id) => UPSCALE_PROVIDERS.find((p) => p.id === id);

/** Default settings ({key: default}) for an image provider. */
export function providerDefaults(id) {
  const p = getImageProvider(id);
  const out = {};
  if (p) for (const f of p.settings || []) out[f.key] = f.default;
  return out;
}
