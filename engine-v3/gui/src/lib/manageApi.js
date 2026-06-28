/**
 * Client for the local-mode content-management API (`/api/manage/*`).
 *
 * These endpoints exist only in **local mode** (the file-API backend — the Vite dev middleware
 * today, a production local/desktop build tomorrow). In **online mode** (static host, no backend)
 * they're absent, so {@link managerAvailable} probes once and the Manage tab stays locked. None of
 * this is tied to a dev-vs-production release stage — only to whether the local backend is present.
 * @module gui/lib/manageApi
 */

/**
 * POST JSON to an endpoint and parse the JSON reply, throwing on a non-OK status.
 * @param {string} url The endpoint.
 * @param {object} body The JSON body.
 * @returns {Promise<object>} The parsed reply.
 */
async function postJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

/**
 * Fetch the full disk snapshot for the runtime loader.
 * @returns {Promise<object|null>} The snapshot, or null if the backend isn't present.
 */
export async function getSnapshot() {
  try {
    const res = await fetch("/api/manage/snapshot");
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null; // no local backend (online build / static host)
  }
}

let availability = null;
/**
 * Whether the local-mode management backend is present (probed once, cached).
 * @returns {Promise<boolean>}
 */
export async function managerAvailable() {
  if (availability != null) return availability;
  try {
    const res = await fetch("/api/manage/ping");
    availability = res.ok;
  } catch {
    availability = false;
  }
  return availability;
}

/**
 * Read the raw folder tree of both data roots (lists + dynamic-prompts), including `_`-markers
 * and `.json` sidecars, for the Manage left panel.
 * @returns {Promise<object>} The tree.
 */
export async function getTree() {
  const res = await fetch("/api/manage/tree");
  if (!res.ok) throw new Error(`Tree request failed (${res.status})`);
  return res.json();
}

/**
 * Read one file's text.
 * @param {("lists"|"dynamic-prompts")} root Which data root.
 * @param {string} path The relative path within the root (e.g. "scene/castle.dpl").
 * @returns {Promise<string>} The file text.
 */
export async function readFile(root, path) {
  const res = await fetch(
    `/api/manage/file?root=${encodeURIComponent(root)}&path=${encodeURIComponent(path)}`,
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Read failed (${res.status})`);
  return data.text ?? "";
}

/**
 * Write one file's text.
 * @param {("lists"|"dynamic-prompts")} root Which data root.
 * @param {string} path The relative path within the root.
 * @param {string} text The new file contents.
 * @returns {Promise<object>} The reply (affected path).
 */
export function writeFile(root, path, text) {
  return postJson("/api/manage/file", { root, path, text });
}
