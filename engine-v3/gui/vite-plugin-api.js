/**
 * Vite dev-server middleware — the LOCAL equivalent of the Netlify function, so `npm run web`
 * gets working hosted generation and local-file storage with nothing extra to start. It serves:
 *   - `POST /api/generate`  → the shared `server/dispatch.js` (same handler as online)
 *   - `/api/storage`        → a real `.json` config file on disk (the local-file storage tier)
 * @module gui/vite-plugin-api
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dispatch } from "./server/dispatch.js";

const guiRoot = fileURLToPath(new URL(".", import.meta.url));
const STORE_FILE = path.join(guiRoot, ".gui-storage.json");

/**
 * Read a request's JSON body.
 * @param {import("node:http").IncomingMessage} req The request.
 * @returns {Promise<object>} The parsed body (or `{}`).
 */
function readJson(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try {
        resolve(JSON.parse(data || "{}"));
      } catch {
        resolve({});
      }
    });
    req.on("error", () => resolve({}));
  });
}

/**
 * Send a JSON response.
 * @param {import("node:http").ServerResponse} res The response.
 * @param {number} status HTTP status.
 * @param {object} obj Body.
 * @returns {void}
 */
function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(obj));
}

/** @returns {object} The on-disk store (or `{}`). */
function readStore() {
  try {
    return JSON.parse(fs.readFileSync(STORE_FILE, "utf8"));
  } catch {
    return {};
  }
}
/**
 * @param {object} store The store to persist.
 * @returns {void}
 */
function writeStore(store) {
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
  } catch {
    // best-effort
  }
}

/**
 * The Vite plugin exposing `/api/*` during local dev.
 * @returns {import("vite").Plugin}
 */
export function apiPlugin() {
  return {
    name: "rap-api-middleware",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url) return next();
        const u = new URL(req.url, "http://localhost");

        // --- Hosted generation proxy ---
        if (u.pathname === "/api/generate" && req.method === "POST") {
          const body = await readJson(req);
          const { providerId, prompt, key, params } = body;
          if (!prompt) return send(res, 400, { error: "Missing prompt" });
          if (!key) return send(res, 400, { error: "Missing API key" });
          try {
            const out = await dispatch({ providerId, prompt, key, params });
            return send(res, 200, out);
          } catch (e) {
            return send(res, 502, { error: e.message || "Generation failed" });
          }
        }

        // --- local-direct forward proxy (avoids CORS for ComfyUI / A1111 etc.) ---
        // The browser can't call a local server that sends no CORS headers (Comfy Desktop,
        // default A1111). Forward the call server-side. Restricted to localhost to avoid an
        // open proxy.
        if (u.pathname === "/api/forward" && req.method === "POST") {
          const body = await readJson(req);
          const target = body?.url;
          let host = "";
          try {
            host = new URL(target).hostname;
          } catch {
            return send(res, 400, { error: "Invalid target URL" });
          }
          if (!["127.0.0.1", "localhost", "0.0.0.0", "::1"].includes(host)) {
            return send(res, 403, { error: "Forwarding is restricted to localhost" });
          }
          try {
            const init = { method: body.method || "GET" };
            if (body.body !== undefined) {
              init.headers = { "Content-Type": "application/json" };
              init.body = JSON.stringify(body.body);
            }
            const upstream = await fetch(target, init);
            const text = await upstream.text();
            let data;
            try {
              data = JSON.parse(text);
            } catch {
              data = { error: text || `Upstream returned ${upstream.status}` };
            }
            res.statusCode = upstream.ok ? 200 : upstream.status;
            res.setHeader("Content-Type", "application/json");
            return res.end(JSON.stringify(data));
          } catch (e) {
            return send(res, 502, { error: `Could not reach ${target}: ${e.message}` });
          }
        }

        // --- Local-file storage tier ---
        if (u.pathname === "/api/storage") {
          const store = readStore();
          if (req.method === "GET" && u.searchParams.get("keys")) {
            return send(res, 200, { keys: Object.keys(store) });
          }
          const ns = u.searchParams.get("ns");
          if (req.method === "GET") return send(res, 200, { value: store[ns] ?? null });
          if (req.method === "PUT") {
            const body = await readJson(req);
            store[ns] = body?.value;
            writeStore(store);
            return send(res, 200, { ok: true });
          }
          if (req.method === "DELETE") {
            delete store[ns];
            writeStore(store);
            return send(res, 200, { ok: true });
          }
        }

        return next();
      });
    },
  };
}
