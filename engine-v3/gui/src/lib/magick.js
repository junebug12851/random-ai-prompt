/**
 * ImageMagick bridge for the gallery. The dev server detects whether ImageMagick is installed and
 * which still (non-animated) formats it can write; the single-image page uses that to offer a
 * "Convert & download" menu. Local-only — a static/online build has no `/api/magick`, so this
 * reports "unavailable" and the menu is hidden.
 * @module gui/lib/magick
 */

let cache = null;

/**
 * Ask the dev server whether ImageMagick is available and which still formats it can write.
 * Cached for the page session.
 * @returns {Promise<{available: boolean, formats: string[]}>}
 */
export async function fetchMagick() {
  if (cache) return cache;
  try {
    const res = await fetch("/api/magick");
    if (!res.ok) return (cache = { available: false, formats: [] });
    const data = await res.json().catch(() => ({}));
    cache = {
      available: !!data.available,
      formats: Array.isArray(data.formats) ? data.formats : [],
    };
  } catch {
    cache = { available: false, formats: [] };
  }
  return cache;
}

/**
 * The download URL that converts a saved image to another still format.
 * @param {string} file The image filename (or its `/api/output/<file>` path).
 * @param {string} format The target extension (e.g. "jpg", "webp").
 * @returns {string} The `/api/image/convert` URL.
 */
export function convertUrl(file, format) {
  return `/api/image/convert?file=${encodeURIComponent(file)}&format=${encodeURIComponent(format)}`;
}
