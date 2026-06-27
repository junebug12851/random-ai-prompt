/**
 * Photo-gallery feed reader. Fetches the saved-image feed from the dev server (`/api/feed`),
 * where each entry is an image paired with its `.json` metadata sidecar (how it was made). The
 * feed is a local-only feature — it needs the dev server's filesystem access, so a static/online
 * build (no `/api/feed`) yields an empty gallery, which the UI surfaces gracefully.
 * @module gui/lib/gallery
 */

/**
 * One gallery entry: a saved image and its parsed sidecar (or null if the sidecar is missing).
 * @typedef {object} GalleryItem
 * @property {string} path The served `/api/output/<file>` image path.
 * @property {string} file The image filename on disk.
 * @property {string} name The base name (no extension), shared with the sidecar.
 * @property {number} mtime The file modified time (ms epoch), used as a savedAt fallback.
 * @property {object|null} meta The parsed sidecar (prompt, dpl, aiTranslation, provider, settings…).
 */

/**
 * Fetch the photo-gallery feed, newest first.
 * @returns {Promise<GalleryItem[]>} The feed items (empty when unavailable).
 */
export async function fetchGallery() {
  try {
    const res = await fetch("/api/feed");
    if (!res.ok) return [];
    const data = await res.json().catch(() => ({}));
    return Array.isArray(data.items) ? data.items : [];
  } catch {
    return []; // no dev server (static/online build) — gallery is simply empty
  }
}

/**
 * Build a flat list of the searchable text in an item (prompt, DPL, AI translation, provider).
 * @param {GalleryItem} item The gallery item.
 * @returns {string} A lowercase haystack for substring search.
 */
export function searchHaystack(item) {
  const m = item.meta || {};
  return [m.prompt, m.promptOriginal, m.aiTranslation, m.dpl, m.providerLabel, m.provider, item.file]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}
