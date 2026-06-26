/**
 * Share links — encode the current settings (minus secrets) into the URL hash so a
 * setup can be shared with no server storage.
 * @module gui/lib/share
 */
// Share links: encode the current settings (and prompt) into the URL so a setup
// can be shared without any server storage. API keys are never included.

/**
 * @param {string} str The string to encode.
 * @returns {string} URL-safe base64.
 */
function toBase64Url(str) {
  return btoa(unescape(encodeURIComponent(str))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
/**
 * @param {string} b64 URL-safe base64.
 * @returns {string} The decoded string.
 */
function fromBase64Url(b64) {
  const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
  return decodeURIComponent(escape(atob(b64.replace(/-/g, "+").replace(/_/g, "/") + pad)));
}

/**
 * Encode the settings (minus `keys`) into a shareable URL hash.
 * @param {object} settings The current settings.
 * @returns {string} The share URL.
 */
export function shareUrl(settings) {
  // Drop secrets and bulky in-memory bits before sharing.
  const { keys, ...shareable } = settings;
  const encoded = toBase64Url(JSON.stringify(shareable));
  return `${location.origin}${location.pathname}#s=${encoded}`;
}

/**
 * Decode settings from a share-link hash.
 * @param {string} [hash] The URL hash (defaults to `location.hash`).
 * @returns {(object|null)} The decoded settings, or null if none/invalid.
 */
export function readSharedSettings(hash = location.hash) {
  const m = /[#&]s=([^&]+)/.exec(hash);
  if (!m) return null;
  try {
    return JSON.parse(fromBase64Url(m[1]));
  } catch {
    return null;
  }
}
