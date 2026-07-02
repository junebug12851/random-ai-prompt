/**
 * Leonardo AI — client AI-upscale adapter (Universal Upscaler). Browser-direct, the heaviest of the
 * in-repo upscalers: Leonardo can't upscale an arbitrary URL, so the flow is
 *   1) `POST /init-image` → a presigned S3 upload target,
 *   2) upload the source image to S3,
 *   3) `POST /variations/universal-upscaler` with the uploaded `initImageId`,
 *   4) poll `GET /variations/{id}` until the variation is COMPLETE,
 *   5) fetch the result back as a `data:` URL so the central output folder can persist it.
 *
 * Leonardo addresses things by UUID and has shifted its API across versions — this is **best-effort**
 * (like the generate adapter) and may need adjusting against the current docs. `upscaleMultiplier` is
 * capped at 2 by the Universal Upscaler.
 * @module gui/providers/leonardo/code/upscale
 */
import { submitPoll } from "../../_shared/transport/submitPoll.js";

/** Fetch an image URL → base64 `data:` URL; on a cross-origin failure, fall back to the raw URL. */
async function toDataUrl(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return url;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => resolve(url);
      fr.readAsDataURL(blob);
    });
  } catch {
    return url; // CORS-blocked CDN — return the remote URL (displayed, just not saved locally)
  }
}

/**
 * @param {object} args
 * @param {string} args.image The source image URL (a served `/api/output/...` path or `data:` URL).
 * @param {string} args.key The user's Leonardo API key.
 * @returns {Promise<{images: string[]}>} The upscaled image (data URL when fetchable).
 * @throws {Error} When any step returns a non-OK response.
 */
export default async function upscale({ image, key }) {
  const headers = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    accept: "application/json",
  };

  // 1) presigned init-image upload target
  const initRes = await fetch("https://cloud.leonardo.ai/api/rest/v1/init-image", {
    method: "POST",
    headers,
    body: JSON.stringify({ extension: "png" }),
  });
  const initD = await initRes.json().catch(() => ({}));
  if (!initRes.ok) throw new Error(initD?.error || `Leonardo init-image returned ${initRes.status}`);
  const up = initD?.uploadInitImage;
  if (!up?.url || !up?.fields || !up?.id) throw new Error("Leonardo did not return an upload target.");

  // 2) upload the source image to S3 (presigned POST: provider fields + the file)
  const srcRes = await fetch(image);
  if (!srcRes.ok) throw new Error(`Couldn't read the source image (${srcRes.status}).`);
  const blob = await srcRes.blob();
  const fields = typeof up.fields === "string" ? JSON.parse(up.fields) : up.fields;
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  fd.append("file", blob);
  const s3 = await fetch(up.url, { method: "POST", body: fd });
  if (!s3.ok) throw new Error(`Leonardo image upload failed (${s3.status}).`);

  // 3+4) submit the Universal Upscaler and poll the variation to completion
  const result = await submitPoll({
    submit: async () => {
      const res = await fetch("https://cloud.leonardo.ai/api/rest/v1/variations/universal-upscaler", {
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
      const res = await fetch(`https://cloud.leonardo.ai/api/rest/v1/variations/${sub.id}`, { headers });
      return res.json().catch(() => ({}));
    },
    isDone: (s) => (s?.generated_image_variation_generic || []).some((v) => v?.status === "COMPLETE"),
    isFailed: (s) => (s?.generated_image_variation_generic || []).some((v) => v?.status === "FAILED"),
    getImages: (s) => (s?.generated_image_variation_generic || []).map((v) => v.url).filter(Boolean),
    intervalMs: 2500,
    timeoutMs: 180000,
  });

  // 5) bring results back as data URLs (best-effort) so the output folder can save them
  const images = await Promise.all((result.images || []).map(toDataUrl));
  if (!images.length) throw new Error("Leonardo returned no upscaled image.");
  return { images };
}
