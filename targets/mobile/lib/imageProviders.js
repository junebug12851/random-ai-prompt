/**
 * Browser-direct BYOK image providers — the ones that work on mobile with NO backend (the same set
 * the online web build can use). Each adapter is ported from targets/web/shared/<id>/code/server.js
 * and calls the provider's API directly from the client with the user's key (all are CORS-enabled).
 * `generate({ prompt, key, settings })` → `{ images: string[] }` where each image is a `data:` URL or
 * an `https:` URL (storage.saveImageSrc handles both). Hosted-proxy / local providers are omitted —
 * they need the desktop app's backend.
 */

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

export const IMAGE_PROVIDERS = [
  {
    id: "openai",
    label: "OpenAI (DALL·E / gpt-image)",
    keyHint: "sk-…",
    keyUrl: "https://platform.openai.com/api-keys",
    generate: openai,
  },
  {
    id: "fal",
    label: "fal.ai (FLUX / SD3.5)",
    keyHint: "fal key",
    keyUrl: "https://fal.ai/dashboard/keys",
    generate: fal,
  },
  {
    id: "stability",
    label: "Stability AI",
    keyHint: "sk-…",
    keyUrl: "https://platform.stability.ai/account/keys",
    generate: stability,
  },
  {
    id: "gemini",
    label: "Google Gemini",
    keyHint: "AI…",
    keyUrl: "https://aistudio.google.com/apikey",
    generate: gemini,
  },
];

export const getImageProvider = (id) => IMAGE_PROVIDERS.find((p) => p.id === id);
