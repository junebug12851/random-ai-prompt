/**
 * neural.love — **server-side** upscale adapter. Async: submit to `v1/images/process` (Bearer) with
 * a `quality_enhance` (4×) operation, get an order id, then poll `v1/images/orders/{id}` until the
 * result files appear. Best-effort — the exact request/response schema is approximate; adjust live.
 * @module gui/providers/neurallove/code/upscale-server
 */
import { submitPoll } from "../../_shared/transport/submitPoll.js";

const urlsOf = (s) =>
  (s?.output || s?.files || s?.data?.output || [])
    .map((f) => (typeof f === "string" ? f : f?.url || f?.src))
    .filter(Boolean);

/** @param {object} args `{ image (data URI), key }`. @returns {Promise<{images: string[]}>} */
export default function upscaleServer({ image, key }) {
  const headers = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  return submitPoll({
    submit: async () => {
      const res = await fetch("https://api.neural.love/v1/images/process", {
        method: "POST",
        headers,
        body: JSON.stringify({
          files: [image],
          quality_enhance: { multiplier: "4x", noise: true },
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.message || d?.error || `neural.love returned ${res.status}`);
      const id = d?.orderId || d?.id || d?.data?.orderId;
      if (!id) throw new Error("neural.love did not return an order id.");
      return { id };
    },
    poll: async (sub) => {
      const res = await fetch(`https://api.neural.love/v1/images/orders/${sub.id}`, { headers });
      return res.json().catch(() => ({}));
    },
    isDone: (s) => s?.status === "completed" || urlsOf(s).length > 0,
    isFailed: (s) => s?.status === "failed" || s?.status === "error",
    getImages: urlsOf,
    intervalMs: 3000,
    timeoutMs: 240000,
  });
}
