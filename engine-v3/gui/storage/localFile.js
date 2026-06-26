/**
 * Local-file storage backend — the **local / full-fidelity** persistence tier: a real
 * `.json` config file on disk, read/written through the `/api/storage` endpoint that the
 * Vite dev-server middleware serves while running locally (`npm run web`). If that endpoint
 * is unreachable (e.g. a static build with no server), it transparently falls back to the
 * browser backend so nothing is lost.
 * @module gui/storage/localFile
 */
import { browserStorage } from "./browser.js";

/**
 * @param {string} ns Namespace.
 * @returns {string} The storage endpoint URL for a namespace.
 */
const url = (ns) => `/api/storage?ns=${encodeURIComponent(ns)}`;

/** @type {import("./index.js").StorageBackend} */
export const localFileStorage = {
  id: "local-file",

  async get(ns) {
    try {
      const res = await fetch(url(ns));
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      return data?.value ?? null;
    } catch {
      return browserStorage.get(ns); // fallback: no server reachable
    }
  },

  async set(ns, obj) {
    try {
      const res = await fetch(url(ns), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: obj }),
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      await browserStorage.set(ns, obj); // fallback
    }
  },

  async remove(ns) {
    try {
      const res = await fetch(url(ns), { method: "DELETE" });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      await browserStorage.remove(ns); // fallback
    }
  },

  async keys() {
    try {
      const res = await fetch("/api/storage?keys=1");
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      return Array.isArray(data?.keys) ? data.keys : [];
    } catch {
      return browserStorage.keys(); // fallback
    }
  },
};
