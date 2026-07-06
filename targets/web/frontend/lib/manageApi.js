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
    // A static host (online build / `vite preview`) answers unknown routes with the SPA's index.html
    // (HTTP 200), so `res.ok` alone is a false positive. Require the real JSON `{ ok: true }` — only
    // the local-mode backend returns that; HTML fails the JSON parse and reports unavailable.
    const data = await res.json().catch(() => null);
    availability = res.ok && data?.ok === true;
  } catch {
    availability = false;
  }
  return availability;
}

/**
 * Read the raw folder tree of both data roots (lists + blocks), including `_`-markers
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
 * @param {("lists"|"blocks")} root Which data root.
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
 * @param {("lists"|"blocks")} root Which data root.
 * @param {string} path The relative path within the root.
 * @param {string} text The new file contents.
 * @returns {Promise<object>} The reply (affected path).
 */
export function writeFile(root, path, text) {
  return postJson("/api/manage/file", { root, path, text });
}

/**
 * Merge a `<name>.json` sidecar (a key set to null is removed).
 * @param {("lists"|"blocks")} root Which data root.
 * @param {string} name The logical key (generator/list path, or a folder).
 * @param {object} patch Keys to merge.
 * @returns {Promise<object>} The merged sidecar.
 */
export function saveSidecar(root, name, patch) {
  return postJson("/api/manage/sidecar", { root, name, patch });
}

/**
 * Toggle a folder `_`-marker.
 * @param {("lists"|"blocks")} root Which data root.
 * @param {string} dir The folder path.
 * @param {("_force-prefix"|"_enable-group-list"|"_disable-group-list")} marker The marker.
 * @param {boolean} on Whether it should exist.
 * @returns {Promise<object>} The reply.
 */
export function setMarker(root, dir, marker, on) {
  return postJson("/api/manage/marker", { root, dir, marker, on });
}

/**
 * A filesystem op on the content tree.
 * @param {("mkdir"|"mkfile"|"delete"|"move")} op The operation.
 * @param {object} args `{ root, path, to?, text? }`.
 * @returns {Promise<object>} The reply.
 */
export function fsOp(op, args) {
  return postJson("/api/manage/fs", { op, ...args });
}

/**
 * Restore a file to its repository default (the stable `master` branch), overwriting the local copy.
 * @param {("lists"|"blocks")} root Which data root.
 * @param {string} path The relative path within the root (with extension).
 * @returns {Promise<object>} The reply (`{ ok, deleted }`).
 */
export function restoreDefault(root, path) {
  return postJson("/api/manage/restore", { root, path });
}

/**
 * The stable-branch file manifest (for ghost / restorable entries). Returns null on failure (e.g. no
 * network or GitHub rate-limit) so ghosts just don't show.
 * @returns {Promise<{lists: string[], "blocks": string[]}|null>}
 */
export async function getRemoteManifest() {
  try {
    const res = await fetch("/api/manage/remote-manifest");
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
