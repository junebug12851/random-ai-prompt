/**
 * Central output folder helper. Any provider's generated image (a `data:` URL, a localhost
 * server URL like ComfyUI's `/view`, etc.) is funneled through here: the dev server saves it
 * to `engine-v3/output/` and returns a served `/api/output/<file>` path the browser can show.
 * One shared folder for every image provider. Falls back to the original source if the save
 * endpoint isn't available (e.g. a static build with no dev server).
 * @module gui/lib/output
 */

/**
 * Save one image source into the central output folder; returns the served path (or the
 * original source on failure). When `meta` is given, the server writes a `.json` sidecar next
 * to the image (how it was made — prompt, DPL, AI translation, provider + settings) that the
 * photo gallery reads back.
 * @param {string} src A `data:` URL or a localhost image URL.
 * @param {object} [meta] Metadata to persist alongside the image as a sidecar.
 * @returns {Promise<string>} The served `/api/output/<file>` path, or `src` on failure.
 */
export async function ingestImage(src, meta) {
  try {
    const res = await fetch("/api/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(meta ? { src, meta } : { src }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.path) return data.path;
  } catch {
    // fall through to the original source
  }
  return src;
}

/** True for a path that lives in our central output folder (so file actions apply). */
export const isOutputFile = (p) => typeof p === "string" && p.startsWith("/api/output/");

/**
 * Convert a `data:` URL to a Blob **synchronously** (no `await`, so a `window.open` right after it
 * still counts as a user gesture and isn't popup-blocked).
 * @param {string} dataUrl A `data:<mime>;base64,<payload>` URL.
 * @returns {Blob}
 */
function dataUrlToBlob(dataUrl) {
  const [head, b64] = dataUrl.split(",");
  const mime = (head.match(/data:([^;]+)/) || [])[1] || "image/png";
  const bin = atob(b64 || "");
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

/**
 * Open a generated image in a new browser tab — robustly. Browsers block top-level navigation to a
 * `data:` URL, so those are first turned into a `blob:` object URL (which opens fine and is the local
 * cached image, not a network fetch). Everything else (`blob:`, a served `/api/output/...` path, or
 * a remote `https:` URL) is opened directly. Used by the online build where there's no single view.
 * @param {string} img A `data:` / `blob:` / served / remote image URL.
 * @returns {void}
 */
export function openImageInNewTab(img) {
  if (!img) return;
  try {
    if (img.startsWith("data:")) {
      const url = URL.createObjectURL(dataUrlToBlob(img));
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      return;
    }
  } catch {
    // fall through to a direct open
  }
  window.open(img, "_blank", "noopener");
}

/**
 * @param {string} action `delete` | `reveal` | `open`.
 * @param {string} p A served `/api/output/<file>` path.
 * @returns {Promise<boolean>} Whether the action succeeded.
 */
async function fileAction(action, p) {
  if (!isOutputFile(p)) return false;
  try {
    const res = await fetch(`/api/image/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: p }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Patch an image's metadata sidecar on disk (shallow-merge), e.g. to persist an edited keyword list.
 * @param {string} p A served `/api/output/<file>` path.
 * @param {object} patch Top-level keys to merge into the sidecar JSON.
 * @returns {Promise<object|null>} The merged sidecar, or null on failure / no dev server.
 */
export async function updateImageMeta(p, patch) {
  if (!isOutputFile(p)) return null;
  try {
    const res = await fetch("/api/image/meta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: p, patch }),
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok && d.meta) return d.meta;
  } catch {
    // no dev server (static build) — sidecar updates simply aren't available
  }
  return null;
}

/** Delete an image file from disk. */
export const deleteImageFile = (p) => fileAction("delete", p);
/** Reveal an image in the OS file explorer. */
export const revealImageFile = (p) => fileAction("reveal", p);
/** Open an image in the OS default program. */
export const openImageFile = (p) => fileAction("open", p);
