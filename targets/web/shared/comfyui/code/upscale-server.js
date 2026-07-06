/**
 * ComfyUI — **server-side** AI-upscale adapter (proxy / dev middleware). ComfyUI upscaling needs an
 * image **upload** (multipart) which the JSON forward proxy can't do, so this runs server-side: it
 * uploads the inlined image to ComfyUI's input folder, submits a minimal upscale-model graph
 * (LoadImage → UpscaleModelLoader → ImageUpscaleWithModel → SaveImage), polls `/history`, and returns
 * the `/view` URL (which the `/api/upscale` endpoint fetches back to a data URL).
 *
 * Requires an upscale model in `ComfyUI/models/upscale_models` (e.g. `RealESRGAN_x4plus.pth`,
 * `4x-UltraSharp.pth`). The model name self-heals against `/object_info/UpscaleModelLoader`.
 * Best-effort — verify against your ComfyUI.
 * @module gui/providers/comfyui/code/upscale-server
 */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @param {object} args `{ image (data URI), params: { base?, model? } }`.
 * @returns {Promise<{images: string[]}>} The upscaled image as a ComfyUI `/view` URL.
 * @throws {Error} On upload / submit / timeout / missing-model failures.
 */
export default async function upscaleServer({ image, params = {} }) {
  const base = (params.base || "http://127.0.0.1:8188").replace(/\/+$/, "");
  const m = typeof image === "string" && image.match(/^data:([^;]+);base64,(.*)$/s);
  if (!m) throw new Error("ComfyUI upscale expects an inlined image.");
  const buf = Buffer.from(m[2], "base64");

  // 1) upload the source image to ComfyUI's input folder.
  const fd = new FormData();
  fd.append("image", new Blob([buf], { type: m[1] }), "rap-upscale.png");
  fd.append("overwrite", "true");
  const upRes = await fetch(`${base}/upload/image`, { method: "POST", body: fd });
  const upData = await upRes.json().catch(() => ({}));
  if (!upRes.ok || !upData?.name) {
    throw new Error(upData?.error || `ComfyUI image upload failed (${upRes.status}).`);
  }
  const imageRef = upData.subfolder ? `${upData.subfolder}/${upData.name}` : upData.name;

  // 2) resolve the upscale model (self-heal against what's installed).
  let model = params.model;
  try {
    const info = await (await fetch(`${base}/object_info/UpscaleModelLoader`)).json();
    const list = info?.UpscaleModelLoader?.input?.required?.model_name?.[0] || [];
    if (!model || !list.includes(model)) model = list[0];
  } catch {
    // keep the configured model if the introspection call fails
  }
  if (!model) {
    throw new Error("ComfyUI has no upscale models — add one to ComfyUI/models/upscale_models.");
  }

  // 3) build + submit the minimal upscale graph.
  const g = {
    1: { class_type: "LoadImage", inputs: { image: imageRef } },
    2: { class_type: "UpscaleModelLoader", inputs: { model_name: model } },
    3: { class_type: "ImageUpscaleWithModel", inputs: { upscale_model: ["2", 0], image: ["1", 0] } },
    4: { class_type: "SaveImage", inputs: { images: ["3", 0] } },
  };
  const clientId = globalThis.crypto?.randomUUID?.() || String(Math.random()).slice(2);
  const subRes = await fetch(`${base}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: g, client_id: clientId }),
  });
  const sub = await subRes.json().catch(() => ({}));
  if (!subRes.ok || !sub?.prompt_id) {
    const msg = sub?.error?.message || sub?.error || `ComfyUI /prompt failed (${subRes.status}).`;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  const promptId = sub.prompt_id;

  // 4) poll /history until the SaveImage output appears.
  const deadline = Date.now() + 180000;
  for (;;) {
    const hist = await (await fetch(`${base}/history/${promptId}`)).json().catch(() => ({}));
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
    if (Date.now() > deadline) throw new Error("ComfyUI upscale timed out.");
    await sleep(1200);
  }
}
