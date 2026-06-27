/**
 * Photo-gallery feed reader. Fetches the saved-image feed from the dev server (`/api/feed`),
 * where each entry is an image paired with its `.json` metadata sidecar (how it was made). The
 * feed is a local-only feature — it needs the dev server's filesystem access, so a static/online
 * build (no `/api/feed`) yields an empty gallery, which the UI surfaces gracefully.
 *
 * Sidecars store the prompt and negative each as three layers — DPL source, deterministic engine
 * roll, and (when auto-fix is on) the AI translation — plus `final` (what was actually sent):
 * `meta.prompt = { dpl, roll, ai, final }` and `meta.negative = { dpl, roll, ai, final }`. The
 * helpers below also accept the older flat shape (`meta.prompt` a string, `meta.aiTranslation`, …).
 * @module gui/lib/gallery
 */

/**
 * One gallery entry: a saved image and its parsed sidecar (or null if the sidecar is missing).
 * @typedef {object} GalleryItem
 * @property {string} path The served `/api/output/<file>` image path.
 * @property {string} file The image filename on disk.
 * @property {string} name The base name (no extension), shared with the sidecar.
 * @property {number} mtime The file modified time (ms epoch), used as a savedAt fallback.
 * @property {object|null} meta The parsed sidecar.
 */

/**
 * Normalize a sidecar's prompt to `{ dpl, roll, ai, final }`, accepting both the nested and the
 * older flat shape.
 * @param {object} meta The sidecar.
 * @returns {{dpl: ?string, roll: ?string, ai: ?string, final: ?string}}
 */
export function promptLayers(meta) {
  const m = meta || {};
  if (m.prompt && typeof m.prompt === "object") return m.prompt;
  return { dpl: m.dpl ?? null, roll: m.promptOriginal ?? null, ai: m.aiTranslation ?? null, final: m.prompt ?? null };
}

/**
 * Normalize a sidecar's negative prompt to `{ dpl, roll, ai, final }` (nested or flat).
 * @param {object} meta The sidecar.
 * @returns {{dpl: ?string, roll: ?string, ai: ?string, final: ?string}}
 */
export function negativeLayers(meta) {
  const m = meta || {};
  if (m.negative && typeof m.negative === "object") return m.negative;
  return { dpl: null, roll: null, ai: null, final: m.negativePrompt ?? null };
}

/**
 * The best single prompt string to label an image with (final → AI → roll → DPL).
 * @param {GalleryItem} item The gallery item.
 * @returns {string}
 */
export function promptText(item) {
  const p = promptLayers(item.meta);
  return p.final || p.ai || p.roll || p.dpl || "";
}

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
 * Build the lowercase searchable text for an item (every prompt/negative layer + provider).
 * @param {GalleryItem} item The gallery item.
 * @returns {string} A lowercase haystack for substring search.
 */
export function searchHaystack(item) {
  const m = item.meta || {};
  const p = promptLayers(m);
  const n = negativeLayers(m);
  return [
    p.final, p.roll, p.ai, p.dpl,
    n.final, n.roll, n.ai, n.dpl,
    Array.isArray(m.keywords) ? m.keywords.join(" ") : null,
    m.providerLabel, m.provider, item.file,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}
