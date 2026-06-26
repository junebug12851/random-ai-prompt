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
 * original source on failure).
 * @param {string} src A `data:` URL or a localhost image URL.
 * @returns {Promise<string>} The served `/api/output/<file>` path, or `src` on failure.
 */
export async function ingestImage(src) {
  try {
    const res = await fetch("/api/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ src }),
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

/** Delete an image file from disk. */
export const deleteImageFile = (p) => fileAction("delete", p);
/** Reveal an image in the OS file explorer. */
export const revealImageFile = (p) => fileAction("reveal", p);
/** Open an image in the OS default program. */
export const openImageFile = (p) => fileAction("open", p);
