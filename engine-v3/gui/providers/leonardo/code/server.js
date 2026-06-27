/**
 * Leonardo AI — server-side adapter (runs in the proxy). Create a generation, then poll it until
 * COMPLETE and return the image URLs. Key used once, never stored.
 * @module gui/providers/leonardo/code/server
 */
import { submitPoll } from "../../_shared/transport/submitPoll.js";

/**
 * @param {object} args `{ prompt, key, params }`.
 * @returns {Promise<{images: string[]}>}
 */
export default function server({ prompt, key, params = {} }) {
  const headers = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    accept: "application/json",
  };
  return submitPoll({
    submit: async () => {
      const res = await fetch("https://cloud.leonardo.ai/api/rest/v1/generations", {
        method: "POST",
        headers,
        body: JSON.stringify({
          prompt,
          modelId: params.model,
          num_images: params.n || 1,
          width: params.width || 1024,
          height: params.height || 1024,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error || d?.message || `Leonardo returned ${res.status}`);
      const id = d?.sdGenerationJob?.generationId;
      if (!id) throw new Error("Leonardo did not return a generation id.");
      return { id };
    },
    poll: async (sub) => {
      const res = await fetch(`https://cloud.leonardo.ai/api/rest/v1/generations/${sub.id}`, {
        headers,
      });
      return res.json().catch(() => ({}));
    },
    isDone: (s) => s?.generations_by_pk?.status === "COMPLETE",
    isFailed: (s) => s?.generations_by_pk?.status === "FAILED",
    getImages: (s) =>
      (s?.generations_by_pk?.generated_images || []).map((i) => i.url).filter(Boolean),
    intervalMs: 2000,
    timeoutMs: 150000,
  });
}
