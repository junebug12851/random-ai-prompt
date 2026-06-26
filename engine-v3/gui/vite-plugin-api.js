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
