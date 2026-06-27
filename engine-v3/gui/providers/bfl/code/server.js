/**
 * Black Forest Labs (FLUX) — server-side adapter (runs in the proxy). Submit → poll the
 * `polling_url` until status "Ready", then return `result.sample` (a temporary image URL — it
 * expires ~10 min, but we ingest it into the output folder right away). Auth header `x-key`.
 * @module gui/providers/bfl/code/server
 */
import { submitPoll } from "../../_shared/transport/submitPoll.js";

/**
 * @param {object} args `{ prompt, key, params }`.
 * @returns {Promise<{images: string[]}>}
 */
export default function server({ prompt, key, params = {} }) {
  const model = params.model || "flux-dev";
  const headers = { "x-key": key, accept: "application/json" };
  return submitPoll({
    submit: async () => {
      const res = await fetch(`https://api.bfl.ai/v1/${model}`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          ...(params.aspect_ratio ? { aspect_ratio: params.aspect_ratio } : {}),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.detail || `BFL returned ${res.status}`);
      if (!d.polling_url) throw new Error("BFL did not return a polling URL.");
      return d;
    },
    poll: async (sub) => {
      const res = await fetch(sub.polling_url, { headers });
      return res.json().catch(() => ({}));
    },
    isDone: (s) => s?.status === "Ready",
    isFailed: (s) =>
      ["Error", "Failed", "Content Moderated", "Request Moderated"].includes(s?.status),
    getImages: (s) => (s?.result?.sample ? [s.result.sample] : []),
    intervalMs: 1500,
    timeoutMs: 120000,
  });
}
