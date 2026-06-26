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
import { exec } from "node:child_process";
import { dispatch, dispatchRewrite } from "./server/dispatch.js";

const guiRoot = fileURLToPath(new URL(".", import.meta.url));
const STORE_FILE = path.join(guiRoot, ".gui-storage.json");
// The central output folder — every provider's generated images land here on disk
// (engine-v3/output, the project's runtime output dir), served back via /api/output/<file>.
const OUTPUT_DIR = path.join(guiRoot, "..", "output");

const IMAGE_TYPES = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

/**
 * Resolve a served image path (`/api/output/<name>` or a bare name) to a safe absolute file in
 * the output folder. Rejects path traversal.
 * @param {string} p The served path or filename.
 * @returns {string|null} The absolute file path, or null if invalid.
 */
function resolveOutputFile(p) {
  if (typeof p !== "string") return null;
  const name = decodeURIComponent(p.replace(/^\/api\/output\//, ""));
  if (!name || name.includes("/") || name.includes("\\") || name.includes("..")) return null;
  return path.join(OUTPUT_DIR, name);
}

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

        // --- prompt rewrite (auto-fix) proxy ---
        if (u.pathname === "/api/rewrite" && req.method === "POST") {
          const body = await readJson(req);
          const { providerId, prompt, key } = body;
          if (!prompt) return send(res, 400, { error: "Missing prompt" });
          try {
            const out = await dispatchRewrite({ providerId, prompt, key });
            return send(res, 200, out);
          } catch (e) {
            return send(res, 502, { error: e.message || "Rewrite failed" });
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

        // --- ingest a generated image into the central output folder ---
        // Accepts { src } as a data: URL (decode) or a localhost URL (fetch server-side — also
        // sidesteps Comfy Desktop's 403 on the browser). Saves to engine-v3/output/ and returns
        // the served path. Any provider funnels its results through this for one shared folder.
        if (u.pathname === "/api/image" && req.method === "POST") {
          const body = await readJson(req);
          const src = body?.src;
          try {
            let buf;
            let ext = "png";
            const m = typeof src === "string" && src.match(/^data:([^;]+);base64,(.*)$/s);
            if (m) {
              ext = (m[1].split("/")[1] || "png").split("+")[0];
              buf = Buffer.from(m[2], "base64");
            } else {
              let host = "";
              try {
                host = new URL(src).hostname;
              } catch {
                return send(res, 400, { error: "Invalid image src" });
              }
              if (!["127.0.0.1", "localhost", "0.0.0.0", "::1"].includes(host)) {
                return send(res, 403, {
                  error: "Image ingest is restricted to localhost / data URLs",
                });
              }
              const up = await fetch(src);
              if (!up.ok)
                return send(res, up.status, { error: `Image fetch failed (${up.status})` });
              ext = ((up.headers.get("content-type") || "image/png").split("/")[1] || "png").split(
                "+",
              )[0];
              buf = Buffer.from(await up.arrayBuffer());
            }
            if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
            const name = `${new Date().toISOString().replace(/[:.]/g, "-")}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
            fs.writeFileSync(path.join(OUTPUT_DIR, name), buf);
            return send(res, 200, { path: `/api/output/${name}` });
          } catch (e) {
            return send(res, 502, { error: `Could not save image: ${e.message}` });
          }
        }

        // --- serve a saved image from the central output folder ---
        if (u.pathname.startsWith("/api/output/") && req.method === "GET") {
          const name = decodeURIComponent(u.pathname.slice("/api/output/".length));
          if (name.includes("/") || name.includes("\\") || name.includes("..")) {
            return send(res, 400, { error: "Invalid name" });
          }
          const fp = path.join(OUTPUT_DIR, name);
          if (!fs.existsSync(fp)) {
            res.statusCode = 404;
            return res.end();
          }
          const ext = path.extname(name).slice(1).toLowerCase();
          res.statusCode = 200;
          res.setHeader("Content-Type", IMAGE_TYPES[ext] || "application/octet-stream");
          return res.end(fs.readFileSync(fp));
        }

        // --- image file actions (delete from disk / reveal in Explorer / open with default app) ---
        if (u.pathname === "/api/image/delete" && req.method === "POST") {
          const fp = resolveOutputFile((await readJson(req))?.path);
          if (!fp) return send(res, 400, { error: "Invalid path" });
          try {
            if (fs.existsSync(fp)) fs.unlinkSync(fp);
            return send(res, 200, { ok: true });
          } catch (e) {
            return send(res, 502, { error: e.message });
          }
        }
        if (u.pathname === "/api/image/reveal" && req.method === "POST") {
          const fp = resolveOutputFile((await readJson(req))?.path);
          if (!fp || !fs.existsSync(fp)) return send(res, 404, { error: "Not found" });
          // explorer /select returns a non-zero exit code even on success — ignore it.
          exec(`explorer /select,"${fp}"`);
          return send(res, 200, { ok: true });
        }
        if (u.pathname === "/api/image/open" && req.method === "POST") {
          const fp = resolveOutputFile((await readJson(req))?.path);
          if (!fp || !fs.existsSync(fp)) return send(res, 404, { error: "Not found" });
          exec(`cmd /c start "" "${fp}"`); // open in the OS default program
          return send(res, 200, { ok: true });
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
