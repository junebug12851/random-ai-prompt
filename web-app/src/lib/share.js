// Share links: encode the current settings (and prompt) into the URL so a setup
// can be shared without any server storage. API keys are never included.

function toBase64Url(str) {
  return btoa(unescape(encodeURIComponent(str))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromBase64Url(b64) {
  const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
  return decodeURIComponent(escape(atob(b64.replace(/-/g, "+").replace(/_/g, "/") + pad)));
}

export function shareUrl(settings) {
  // Drop secrets and bulky in-memory bits before sharing.
  const { keys, ...shareable } = settings;
  const encoded = toBase64Url(JSON.stringify(shareable));
  return `${location.origin}${location.pathname}#s=${encoded}`;
}

export function readSharedSettings(hash = location.hash) {
  const m = /[#&]s=([^&]+)/.exec(hash);
  if (!m) return null;
  try {
    return JSON.parse(fromBase64Url(m[1]));
  } catch {
    return null;
  }
}
