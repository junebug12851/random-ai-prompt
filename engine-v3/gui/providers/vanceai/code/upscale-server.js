/**
 * VanceAI — **server-side** upscale adapter. Async unified jobs API: `POST /v1/jobs` (Bearer) returns
 * a job id, poll `GET /v1/jobs/{id}` until `succeeded`, then `GET /v1/jobs/{id}/result` for the
 * download link. The result link lives on a separate endpoint, so this uses a manual loop rather than
 * the generic submitPoll. Best-effort — the job request schema is approximate; verify live.
 * @module gui/providers/vanceai/code/upscale-server
 */

const BASE = "https://api.vanceai.com";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** @param {object} args `{ image (data URI), key, params: { scale? } }`. @returns {Promise<{images: string[]}>} */
export default async function upscaleServer({ image, key, params = {} }) {
  const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

  const subRes = await fetch(`${BASE}/v1/jobs`, {
    method: "POST",
    headers,
    body: JSON.stringify({ tool: "upscale", scale: params.scale || 4, image }),
  });
  const sub = await subRes.json().catch(() => ({}));
  if (!subRes.ok) throw new Error(sub?.message || sub?.error || `VanceAI returned ${subRes.status}`);
  const id = sub?.job_id || sub?.id || sub?.data?.job_id;
  if (!id) throw new Error("VanceAI did not return a job id.");

  const deadline = Date.now() + 240000;
  for (;;) {
    await sleep(3000);
    const st = await (await fetch(`${BASE}/v1/jobs/${id}`, { headers })).json().catch(() => ({}));
    const status = st?.status || st?.data?.status;
    if (status === "succeeded") {
      const rr = await (await fetch(`${BASE}/v1/jobs/${id}/result`, { headers })).json().catch(() => ({}));
      const url = rr?.url || rr?.download_url || rr?.data?.url || rr?.result;
      if (!url) throw new Error("VanceAI returned no result url.");
      return { images: [url] };
    }
    if (status === "failed" || status === "error") throw new Error("VanceAI job failed.");
    if (Date.now() > deadline) throw new Error("VanceAI job timed out.");
  }
}
