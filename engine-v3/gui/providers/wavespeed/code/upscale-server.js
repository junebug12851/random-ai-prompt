/**
 * WaveSpeed AI (Real-ESRGAN) — **server-side** upscale adapter. Async: submit the image to
 * `api/v3/wavespeed-ai/real-esrgan` (Bearer), get a prediction id, then poll
 * `api/v3/predictions/{id}/result` until `status === "completed"` and read `outputs[0]`. Best-effort.
 * @module gui/providers/wavespeed/code/upscale-server
 */
import { submitPoll } from "../../_shared/transport/submitPoll.js";

/** @param {object} args `{ image (data URI), key }`. @returns {Promise<{images: string[]}>} */
export default function upscaleServer({ image, key }) {
  const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  return submitPoll({
    submit: async () => {
      const res = await fetch("https://api.wavespeed.ai/api/v3/wavespeed-ai/real-esrgan", {
        method: "POST",
        headers,
        body: JSON.stringify({ image }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.message || `WaveSpeed returned ${res.status}`);
      const id = d?.data?.id || d?.id;
      if (!id) throw new Error("WaveSpeed did not return a prediction id.");
      return { id };
    },
    poll: async (sub) => {
      const res = await fetch(`https://api.wavespeed.ai/api/v3/predictions/${sub.id}/result`, { headers });
      const d = await res.json().catch(() => ({}));
      return d?.data || d;
    },
    isDone: (s) => s?.status === "completed",
    isFailed: (s) => s?.status === "failed" || s?.status === "error",
    getImages: (s) => (s?.outputs || []).filter(Boolean),
    intervalMs: 2000,
    timeoutMs: 180000,
  });
}
