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
